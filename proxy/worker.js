// Stacks lookup proxy: a Cloudflare Worker (free tier is plenty).
// These services don't allow browser requests from other sites (or need a secret key), so the app
// asks this worker instead. It only forwards these lookups, so it can't be abused as an open proxy.
//   GET /upc?code=<barcode>                -> UPCitemdb trial lookup (100/day, no key)
//   GET /ebay?code=<barcode>&m=EBAY_AU     -> eBay Browse API listings for that barcode (free key, see README)
//   GET /pc?code=<barcode>&t=<token>       -> PriceCharting product by UPC (paid token)
//   GET  /sync?since=<ms>                  -> collection changes since then   } cloud copy of your collection,
//   POST /sync  {items:[...]}              -> save changes (newest edit wins) } needs SYNC_KEY + a D1 binding "DB"
// eBay needs two Worker secrets: EBAY_CLIENT_ID and EBAY_CLIENT_SECRET (Settings → Variables and Secrets).
const MARKETS = ['EBAY_AU', 'EBAY_US', 'EBAY_GB', 'EBAY_CA', 'EBAY_IE', 'EBAY_DE', 'EBAY_FR', 'EBAY_IT', 'EBAY_ES', 'EBAY_NL'];

export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    const code = (u.searchParams.get('code') || '').replace(/\D/g, '');
    if (req.method === 'OPTIONS') return out('', 204);
    if (u.pathname === '/health') return out({ ok: true, ebay: !!(env.EBAY_CLIENT_ID && env.EBAY_CLIENT_SECRET), sync: !!(env.DB && env.SYNC_KEY) });
    if (u.pathname === '/sync') return sync(req, env, u);
    if (code.length < 8 || code.length > 14) return out({ error: 'bad code' }, 400);

    // cache every answer for a day: saves free quota when the same item is scanned again
    const cache = caches.default, key = new Request(u.toString().replace(/([?&])t=[^&]*/, '$1t=x'));
    const hit = await cache.match(key);
    if (hit) return hit;

    let res;
    if (u.pathname === '/upc') res = await pass(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`);
    else if (u.pathname === '/pc') {
      const t = u.searchParams.get('t');
      if (!t) return out({ error: 'missing token' }, 400);
      res = await pass(`https://www.pricecharting.com/api/product?t=${encodeURIComponent(t)}&upc=${code}`);
    } else if (u.pathname === '/ebay') {
      if (!env.EBAY_CLIENT_ID || !env.EBAY_CLIENT_SECRET) return out({ error: 'eBay keys not set on the worker' }, 501);
      const m = MARKETS.includes(u.searchParams.get('m')) ? u.searchParams.get('m') : 'EBAY_US';
      res = out(await ebay(env, code, m));
    } else return out({ error: 'not found' }, 404);

    if (res.status === 200) { const r = res.clone(); r.headers.set('cache-control', 'public, max-age=86400'); ctx.waitUntil(cache.put(key, r)); }
    return res;
  },
};

async function pass(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Stacks/1.0', Accept: 'application/json' } });
  return out(await r.text(), r.status);
}

let token = null, tokenExp = 0;
async function ebayToken(env) {
  if (token && Date.now() < tokenExp) return token;
  const r = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + btoa(`${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`) },
    body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('eBay auth failed: ' + (j.error_description || r.status));
  token = j.access_token; tokenExp = Date.now() + (j.expires_in - 120) * 1000;
  return token;
}

// Listing titles for this barcode, from your eBay country first, then the big ones.
// Sellers list by barcode all over the world, so this knows far more games/movies than any free UPC database.
async function ebay(env, code, market) {
  const tk = await ebayToken(env);
  const search = async (m, param) => {
    const r = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${param}&limit=30`, {
      headers: { Authorization: `Bearer ${tk}`, 'X-EBAY-C-MARKETPLACE-ID': m, 'Accept-Language': 'en' } });
    if (!r.ok) return [];
    return ((await r.json()).itemSummaries || []).map(i => ({
      title: i.title, price: i.price ? +i.price.value : null, currency: i.price?.currency, condition: i.condition,
      category: (i.categories || []).map(c => c.categoryName).join(' > '), image: i.image?.imageUrl || '', url: i.itemWebUrl, market: m,
    }));
  };
  const upc = code.length === 13 && code.startsWith('0') ? code.slice(1) : code;
  const order = [market, ...['EBAY_US', 'EBAY_GB', 'EBAY_AU'].filter(m => m !== market)];
  for (const m of order) {
    const [byText, byGtin] = await Promise.all([search(m, 'q=' + code), search(m, 'gtin=' + upc)]);
    const seen = new Set(), items = [...byGtin, ...byText].filter(i => !seen.has(i.url) && seen.add(i.url));
    if (items.length) return { market: m, items };
  }
  return { market, items: [] };
}

// One row per item. `seq` is the server's own clock, so devices with wrong clocks still pull every change.
async function sync(req, env, u) {
  if (!env.DB || !env.SYNC_KEY) return out({ error: 'sync not set up on the worker' }, 501);
  if (req.headers.get('Authorization') !== `Bearer ${env.SYNC_KEY}`) return out({ error: 'wrong sync key' }, 401);
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated INTEGER NOT NULL, seq INTEGER NOT NULL)`).run();

  if (req.method === 'POST') {
    const { items = [] } = await req.json();
    if (!Array.isArray(items) || items.length > 500) return out({ error: 'send 1-500 items per request' }, 400);
    const now = Date.now() * 1000; // room for a per-item counter within the same millisecond
    const stmts = items.filter(i => i && typeof i.id === 'string' && i.id.length < 64).map((i, n) => env.DB.prepare(
      `INSERT INTO items (id, data, updated, seq) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated = excluded.updated, seq = excluded.seq WHERE excluded.updated > items.updated`
    ).bind(i.id, JSON.stringify(i), +i.updatedAt || 0, now + n));
    if (stmts.length) await env.DB.batch(stmts);
    return out({ ok: true, saved: stmts.length });
  }

  const since = +u.searchParams.get('since') || 0;
  const { results } = await env.DB.prepare(`SELECT data, seq FROM items WHERE seq > ?1 ORDER BY seq LIMIT 2000`).bind(since).all();
  return out({ items: results.map(r => JSON.parse(r.data)), next: results.length ? results[results.length - 1].seq : since, more: results.length === 2000 });
}

function out(body, status = 200) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'Authorization, Content-Type' },
  });
}

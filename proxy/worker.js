// Stacks lookup proxy: a Cloudflare Worker (free tier is plenty).
// These services don't allow browser requests from other sites (or need a secret key), so the app
// asks this worker instead. It only forwards these lookups, so it can't be abused as an open proxy.
//   GET /upc?code=<barcode>                -> UPCitemdb trial lookup (100/day, no key)
//   GET /ebay?code=<barcode>&m=EBAY_AU     -> eBay Browse API listings for that barcode (free key, see README)
//   GET /pc?code=<barcode>&t=<token>       -> PriceCharting product by UPC (paid token)
// eBay needs two Worker secrets: EBAY_CLIENT_ID and EBAY_CLIENT_SECRET (Settings → Variables and Secrets).
const MARKETS = ['EBAY_AU', 'EBAY_US', 'EBAY_GB', 'EBAY_CA', 'EBAY_IE', 'EBAY_DE', 'EBAY_FR', 'EBAY_IT', 'EBAY_ES', 'EBAY_NL'];

export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    const code = (u.searchParams.get('code') || '').replace(/\D/g, '');
    if (req.method === 'OPTIONS') return out('', 204);
    if (u.pathname === '/health') return out({ ok: true, ebay: !!(env.EBAY_CLIENT_ID && env.EBAY_CLIENT_SECRET) });
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

function out(body, status = 200) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS' },
  });
}

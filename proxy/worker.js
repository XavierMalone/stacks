// Stacks lookup proxy: a Cloudflare Worker (free tier is plenty).
// UPCitemdb and PriceCharting don't allow browser requests from other sites, so the app asks this
// worker instead. It only forwards these two lookups, so it can't be abused as an open proxy.
//   GET /upc?code=<barcode>             -> UPCitemdb trial lookup (100/day, no key)
//   GET /pc?code=<barcode>&t=<token>    -> PriceCharting product by UPC (paid token)
export default {
  async fetch(req) {
    const u = new URL(req.url);
    const code = (u.searchParams.get('code') || '').replace(/\D/g, '');
    if (req.method === 'OPTIONS') return out('', 204);
    if (code.length < 8 || code.length > 14) return out({ error: 'bad code' }, 400);

    let target;
    if (u.pathname === '/upc') target = `https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`;
    else if (u.pathname === '/pc') {
      const t = u.searchParams.get('t');
      if (!t) return out({ error: 'missing token' }, 400);
      target = `https://www.pricecharting.com/api/product?t=${encodeURIComponent(t)}&upc=${code}`;
    } else return out({ error: 'not found' }, 404);

    const r = await fetch(target, { headers: { 'User-Agent': 'Stacks/1.0', Accept: 'application/json' }, cf: { cacheTtl: 86400, cacheEverything: true } });
    return out(await r.text(), r.status);
  },
};

function out(body, status = 200) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS' },
  });
}

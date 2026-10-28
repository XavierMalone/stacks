/* Stacks: scan-to-catalogue for physical media. Everything is stored on-device (IndexedDB). */
'use strict';

// ---------- formats ----------
const FORMATS = {
  music: ['CD', 'Vinyl LP', 'Vinyl 7"', 'Vinyl 12"', 'Cassette', 'MiniDisc', 'Other music'],
  movie: ['VHS', 'DVD', 'Blu-ray', '4K UHD', 'LaserDisc', 'HD DVD', 'Other video'],
  game: ['PS1', 'PS2', 'PS3', 'PS4', 'PS5', 'PSP', 'PS Vita', 'Xbox', 'Xbox 360', 'Xbox One', 'Xbox Series X|S',
    'NES', 'SNES', 'N64', 'GameCube', 'Wii', 'Wii U', 'Switch', 'Switch 2', 'Game Boy', 'Game Boy Color',
    'Game Boy Advance', 'DS', '3DS', 'Master System', 'Mega Drive / Genesis', 'Saturn', 'Dreamcast', 'Game Gear',
    'Atari', 'PC', 'Other game'],
  book: ['Book', 'Comic'],
  other: ['Console / hardware', 'Other'],
};
const CAT_LABEL = { music: 'Music', movie: 'Movies & TV', game: 'Games', book: 'Books', other: 'Other' };
const CAT_ICON = { music: '💿', movie: '📼', game: '🎮', book: '📚', other: '📦' };
const catOfFormat = f => Object.keys(FORMATS).find(c => FORMATS[c].includes(f)) || null;

const PLATFORM_RX = [
  [/\b(ps5|playstation ?5)\b/i, 'PS5'], [/\b(ps4|playstation ?4)\b/i, 'PS4'], [/\b(ps3|playstation ?3)\b/i, 'PS3'],
  [/\b(ps2|playstation ?2)\b/i, 'PS2'], [/\b(psp|playstation portable)\b/i, 'PSP'], [/\b(ps ?vita|playstation vita)\b/i, 'PS Vita'],
  [/\b(ps1|psx|psone|playstation(?! ?\d| portable| vita))\b/i, 'PS1'],
  [/\bxbox series\b/i, 'Xbox Series X|S'], [/\bxbox one\b/i, 'Xbox One'], [/\bxbox ?360\b/i, 'Xbox 360'], [/\bxbox\b/i, 'Xbox'],
  [/\bswitch ?2\b/i, 'Switch 2'], [/\b(nintendo switch|switch)\b/i, 'Switch'], [/\bwii ?u\b/i, 'Wii U'], [/\bwii\b/i, 'Wii'],
  [/\bgame ?cube\b/i, 'GameCube'], [/\b(n64|nintendo 64)\b/i, 'N64'], [/\b(snes|super nintendo)\b/i, 'SNES'],
  [/\b3ds\b/i, '3DS'], [/\b(nintendo ds|nds|ds)\b/i, 'DS'], [/\b(game ?boy advance|gba)\b/i, 'Game Boy Advance'],
  [/\b(game ?boy colou?r|gbc)\b/i, 'Game Boy Color'], [/\bgame ?boy\b/i, 'Game Boy'], [/\b(nes|nintendo entertainment system)\b/i, 'NES'],
  [/\bdreamcast\b/i, 'Dreamcast'], [/\bsaturn\b/i, 'Saturn'], [/\b(genesis|mega ?drive)\b/i, 'Mega Drive / Genesis'],
  [/\bgame ?gear\b/i, 'Game Gear'], [/\bmaster system\b/i, 'Master System'], [/\b(pc|windows|pc dvd|pc cd)\b/i, 'PC'],
];
const detectPlatform = s => { for (const [rx, p] of PLATFORM_RX) if (rx.test(s || '')) return p; return null; };
const PC_CONSOLE = { // PriceCharting console-name -> our format
  'Playstation': 'PS1', 'Playstation 2': 'PS2', 'Playstation 3': 'PS3', 'Playstation 4': 'PS4', 'Playstation 5': 'PS5',
  'PSP': 'PSP', 'Playstation Vita': 'PS Vita', 'Xbox': 'Xbox', 'Xbox 360': 'Xbox 360', 'Xbox One': 'Xbox One',
  'Xbox Series X': 'Xbox Series X|S', 'Nintendo Switch': 'Switch', 'Nintendo Switch 2': 'Switch 2', 'Wii': 'Wii', 'Wii U': 'Wii U',
  'Gamecube': 'GameCube', 'Nintendo 64': 'N64', 'Super Nintendo': 'SNES', 'NES': 'NES', 'Nintendo DS': 'DS', 'Nintendo 3DS': '3DS',
  'GameBoy': 'Game Boy', 'GameBoy Color': 'Game Boy Color', 'GameBoy Advance': 'Game Boy Advance', 'Sega Dreamcast': 'Dreamcast',
  'Sega Saturn': 'Saturn', 'Sega Genesis': 'Mega Drive / Genesis', 'Sega Game Gear': 'Game Gear', 'Sega Master System': 'Master System', 'PC Games': 'PC',
};
function discogsFormat(formats) {
  const f = (formats || [])[0]; if (!f) return null;
  const d = (f.descriptions || []).join(' ');
  if (f.name === 'Vinyl') return /7"/.test(d) ? 'Vinyl 7"' : /12"/.test(d) && !/LP/.test(d) ? 'Vinyl 12"' : 'Vinyl LP';
  return { CD: 'CD', CDr: 'CD', Cassette: 'Cassette', Minidisc: 'MiniDisc', VHS: 'VHS', DVD: 'DVD', 'Blu-ray': 'Blu-ray' }[f.name] || 'Other music';
}
function mbFormat(media) {
  const f = (media || [])[0]?.format || '';
  if (/vinyl|7"|12"/i.test(f)) return /7"/.test(f) ? 'Vinyl 7"' : 'Vinyl LP';
  if (/cassette/i.test(f)) return 'Cassette';
  if (/cd/i.test(f)) return 'CD';
  if (/minidisc/i.test(f)) return 'MiniDisc';
  return f ? 'Other music' : null;
}

// ---------- eBay countries ----------
const EBAY = {
  EBAY_AU: ['Australia', 'www.ebay.com.au'], EBAY_US: ['United States', 'www.ebay.com'], EBAY_GB: ['United Kingdom', 'www.ebay.co.uk'],
  EBAY_CA: ['Canada', 'www.ebay.ca'], EBAY_IE: ['Ireland', 'www.ebay.ie'], EBAY_DE: ['Germany', 'www.ebay.de'], EBAY_FR: ['France', 'www.ebay.fr'],
  EBAY_IT: ['Italy', 'www.ebay.it'], EBAY_ES: ['Spain', 'www.ebay.es'], EBAY_NL: ['Netherlands', 'www.ebay.nl'],
};
const guessMarket = () => { const r = (navigator.language || '').split('-')[1]; return { AU: 'EBAY_AU', NZ: 'EBAY_AU', GB: 'EBAY_GB', UK: 'EBAY_GB', CA: 'EBAY_CA', IE: 'EBAY_IE', DE: 'EBAY_DE', FR: 'EBAY_FR', IT: 'EBAY_IT', ES: 'EBAY_ES', NL: 'EBAY_NL' }[r] || 'EBAY_US'; };
const ebayHost = () => EBAY[S.ebayMarket]?.[1] || 'www.ebay.com';
const money = (v, cur) => v == null ? '–' : new Intl.NumberFormat(navigator.language || 'en', { style: 'currency', currency: cur || 'USD', maximumFractionDigits: 2 }).format(v);

// ---------- settings ----------
const S = Object.assign({ discogsToken: '', proxyUrl: '', pcToken: '', beep: true, autoAdd: true, mode: 'check', format: '', ebayMarket: guessMarket() },
  safeJSON(lsGet('stacks.settings')) || {});
function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function saveS() { try { localStorage.setItem('stacks.settings', JSON.stringify(S)); } catch {} }
function safeJSON(s) { try { return JSON.parse(s); } catch { return null; } }

// ---------- storage (IndexedDB) ----------
let items = [];
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('stacks', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('items', { keyPath: 'id' });
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  all() { return this.tx('readonly', s => s.getAll()); },
  put(it) { return this.tx('readwrite', s => s.put(it)); },
  del(id) { return this.tx('readwrite', s => s.delete(id)); },
  clear() { return this.tx('readwrite', s => s.clear()); },
  tx(mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction('items', mode); const req = fn(t.objectStore('items'));
      t.oncomplete = () => res(req.result); t.onerror = () => rej(t.error);
    });
  },
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
async function saveItem(it) { it.updatedAt = Date.now(); await DB.put(it); const i = items.findIndex(x => x.id === it.id); i >= 0 ? items[i] = it : items.unshift(it); refreshCounts(); }
async function removeItem(id) { await DB.del(id); items = items.filter(x => x.id !== id); refreshCounts(); }

// ---------- text matching ----------
const canon = c => String(c || '').replace(/\D/g, '').replace(/^0+/, ''); // UPC-A 012345 == EAN-13 0012345
const GAME_NOISE = /\b(greatest hits|platinum( hits)?|player'?s choice|nintendo selects|essentials|classics|game of the year|goty|complete edition|collector'?s edition|limited edition|special edition|launch edition|day one edition|standard edition|deluxe edition|edition|video ?game|pre-?owned|new|sealed)\b/g;
const MOVIE_NOISE = /\b(widescreen|full ?screen|special edition|collector'?s edition|anniversary edition|director'?s cut|extended|unrated|dvd|blu-?ray|4k|uhd|ultra hd|vhs|digital hd|digital copy|steelbook|2-?disc|two-?disc|\d+ discs?)\b/g;
function norm(s, cat) {
  let t = String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/\(.*?\)|\[.*?\]/g, ' ');
  if (cat === 'game') { t = t.replace(GAME_NOISE, ' '); for (const [rx] of PLATFORM_RX) t = t.replace(new RegExp(rx.source, 'gi'), ' '); t = t.replace(/\b(sony|microsoft|nintendo|sega|playstation)\b/g, ' '); }
  if (cat === 'movie') t = t.replace(MOVIE_NOISE, ' ');
  if (cat === 'music') t = t.replace(/\b(deluxe|remaster(ed)?|expanded|anniversary)( edition)?\b/g, ' ');
  return t.replace(/[^a-z0-9]+/g, ' ').replace(/^the /, '').trim();
}
function dice(a, b) {
  if (!a || !b) return 0; if (a === b) return 1;
  const bg = s => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const A = bg(a), B = bg(b); let n = 0;
  for (const [g, c] of A) n += Math.min(c, B.get(g) || 0);
  return (2 * n) / (Math.max(a.length - 1, 0) + Math.max(b.length - 1, 0) || 1);
}

function findMatches(cand, code) {
  const c = canon(code);
  const exact = c ? items.filter(it => [it.barcode, ...(it.altBarcodes || [])].some(b => canon(b) === c)) : [];
  const exIds = new Set(exact.map(x => x.id));
  const variants = [], similar = [];
  if (cand) {
    const tk = norm(cand.title, cand.category), ck = norm(cand.creator);
    for (const it of items) {
      if (exIds.has(it.id) || it.needsInfo) continue;
      if ((cand.masterId && it.masterId === cand.masterId) || (cand.rgid && it.rgid === cand.rgid)) { variants.push(it); continue; }
      if (it.category !== cand.category || !tk) continue;
      const ts = dice(tk, norm(it.title, it.category));
      const cs = ck && it.creator ? dice(ck, norm(it.creator)) : 1;
      if (ts >= 0.86 && cs >= 0.6) similar.push(it);
    }
  }
  return { exact, variants, similar };
}

// ---------- network ----------
async function getJSON(url, opts = {}, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, opts);
    if (r.status === 429 || r.status === 503) { await sleep(2500 * (i + 1)); continue; }
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
    return r.json();
  }
  throw new Error('rate limited');
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
let mbNext = 0; // MusicBrainz asks for max 1 request/second
async function mbGet(url) { const w = mbNext - Date.now(); mbNext = Math.max(Date.now(), mbNext) + 1100; if (w > 0) await sleep(w); return getJSON(url); }
const discogsHeaders = () => S.discogsToken ? { Authorization: `Discogs token=${S.discogsToken}` } : {};

async function srcDiscogs(code, wantFormat) {
  const d = await getJSON(`https://api.discogs.com/database/search?barcode=${code}&type=release&per_page=25`, { headers: discogsHeaders() });
  let rs = d?.results || [];
  if (!rs.length) return null;
  if (wantFormat) { const pref = rs.filter(r => discogsFormat(r.formats) === wantFormat); if (pref.length) rs = pref; }
  const r = rs[0], [artist, ...rest] = r.title.split(' - ');
  return {
    category: 'music', title: rest.join(' - ') || r.title, creator: rest.length ? artist.replace(/\s\(\d+\)$/, '') : '',
    format: discogsFormat(r.formats), year: r.year || '', country: r.country || '', publisher: (r.label || [])[0] || '',
    cover: r.cover_image && !/spacer/.test(r.cover_image) ? r.cover_image : '', discogsId: r.id, masterId: r.master_id ? 'd' + r.master_id : '',
    details: (r.formats || []).map(f => [f.name, ...(f.descriptions || []), f.text].filter(Boolean).join(', ')).join(' + '), source: 'Discogs',
  };
}
async function srcMB(code) {
  const d = await mbGet(`https://musicbrainz.org/ws/2/release/?query=barcode:${code}&fmt=json&limit=5`);
  const r = d?.releases?.[0]; if (!r) return null;
  return {
    category: 'music', title: r.title, creator: (r['artist-credit'] || []).map(a => a.name + (a.joinphrase || '')).join(''),
    format: mbFormat(r.media), year: (r.date || '').slice(0, 4), country: r.country || '',
    publisher: r['label-info']?.[0]?.label?.name || '', mbid: r.id, rgid: r['release-group']?.id ? 'm' + r['release-group'].id : '',
    cover: `https://coverartarchive.org/release/${r.id}/front-250`, source: 'MusicBrainz',
  };
}
async function srcOpenLibrary(code) {
  const d = await getJSON(`https://openlibrary.org/isbn/${code}.json`); if (!d) return null;
  let creator = '';
  if (d.authors?.[0]?.key) { try { creator = (await getJSON(`https://openlibrary.org${d.authors[0].key}.json`))?.name || ''; } catch {} }
  return { category: 'book', format: 'Book', title: d.title, creator, year: (d.publish_date || '').match(/\d{4}/)?.[0] || '',
    publisher: d.publishers?.[0] || '', cover: `https://covers.openlibrary.org/b/isbn/${code}-M.jpg?default=false`, source: 'Open Library',
    masterId: d.works?.[0]?.key ? 'w' + d.works[0].key : '' };
}
const proxy = () => S.proxyUrl.replace(/\/+$/, '');
async function srcUPC(code) {
  if (!proxy()) return null;
  const d = await getJSON(`${proxy()}/upc?code=${code}`);
  const it = d?.items?.[0]; if (!it) return null;
  const blob = `${it.title} ${it.category || ''} ${it.description || ''}`;
  const platform = detectPlatform(it.title) || (/video game/i.test(it.category) ? detectPlatform(blob) : null);
  let category = 'other', format = '';
  if (/video game/i.test(it.category || '') || platform && /game/i.test(blob)) { category = 'game'; format = platform || 'Other game'; }
  else if (/\b(4k|uhd)\b/i.test(blob) && /movie|film|blu/i.test(blob)) { category = 'movie'; format = '4K UHD'; }
  else if (/blu-?ray/i.test(blob)) { category = 'movie'; format = 'Blu-ray'; }
  else if (/\bvhs\b/i.test(blob)) { category = 'movie'; format = 'VHS'; }
  else if (/\bdvd\b/i.test(blob) || /movies|film/i.test(it.category || '')) { category = 'movie'; format = 'DVD'; }
  else if (/vinyl|\blp\b/i.test(blob)) { category = 'music'; format = 'Vinyl LP'; }
  else if (/cassette/i.test(blob)) { category = 'music'; format = 'Cassette'; }
  else if (/music|\bcd\b/i.test(it.category || '')) { category = 'music'; format = 'CD'; }
  else if (/book/i.test(it.category || '')) { category = 'book'; format = 'Book'; }
  let title = it.title;
  if (category === 'game') title = title.replace(/\s*[-–:]\s*([^-–:]+)$/, (m, tail) => detectPlatform(tail) ? '' : m);
  if (category === 'movie') title = title.replace(/(\s*[-–(]?\s*(dvd|blu-?ray|vhs|widescreen|full ?screen)( edition)?\)?)+\s*$/i, '');
  return { category, format, title, creator: category === 'game' ? '' : (it.brand || ''), publisher: it.brand || '',
    cover: it.images?.[0] || '', source: 'UPCitemdb', rawTitle: it.title };
}
// eBay listing titles are noisy ("Just Dance 3 Special Edition Game Nintendo Wii PAL With Manual (G4.6)").
// Strip the seller noise from each, then keep the title that agrees most with the others.
const LISTING_NOISE = /\b(pal|ntsc(-?[ujc])?|aus?|aust(ralian)?|uk|eu(ro)?|region ?free|with manual|w\/ ?manual|manual|inc(l|luding)?|complete|cib|boxed|tested|working|works|free (post(age)?|shipping)|fast (post|shipping)|video ?games?|games?|pre-?owned|used|brand new|new|sealed|factory sealed|disc only|disk only|vgc|exc(ellent)?|good|great|mint|condition|rare|htf|case|booklet|cover art|genuine|official|original|oz seller|aus seller|au stock|bundle|lot|retro|vintage|cd|dvd|blu-?ray|vhs|movie|film|region \d|r\d|\d{4})\b/gi;
function cleanListing(t) {
  let s = ' ' + t + ' ';
  s = s.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ');
  for (const [rx] of PLATFORM_RX) s = s.replace(new RegExp(rx.source, 'gi'), ' ');
  s = s.replace(/\b(nintendo|sony|playstation|microsoft|sega)\b/gi, ' ').replace(LISTING_NOISE, ' ');
  return s.replace(/\s+[-–|,:+\/]\s*(?=[-–|,:+\/]|$)/g, ' ').replace(/^[\s\-–|,:+\/]+|[\s\-–|,:+\/]+$/g, '').replace(/\s{2,}/g, ' ').trim();
}
function consensusTitle(titles) {
  const cands = titles.map(cleanListing).filter(t => t.length > 1);
  if (!cands.length) return '';
  let best = cands[0], bestScore = -1;
  for (const a of cands) {
    const score = cands.reduce((n, b) => n + dice(norm(a), norm(b)), 0) - a.length / 200; // prefer shorter on ties
    if (score > bestScore) { best = a; bestScore = score; }
  }
  return best;
}
const majority = arr => { const m = new Map(); for (const x of arr.filter(Boolean)) m.set(x, (m.get(x) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1])[0]?.[0] || null; };
async function srcEbay(code) {
  if (!proxy()) return null;
  const r = await fetch(`${proxy()}/ebay?code=${code}&m=${S.ebayMarket}`);
  if (r.status === 501 || r.status === 404) return null; // worker has no eBay keys yet
  if (!r.ok) throw new Error('eBay ' + r.status);
  const d = await r.json(), its = d.items || [];
  if (!its.length) return null;
  const blob = its.map(i => `${i.title} ${i.category}`).join(' ');
  const cats = its.map(i => i.category || '');
  const catOf = c => /video game/i.test(c) ? 'game' : /dvd|blu-?ray|vhs|movie|film|tv/i.test(c) ? 'movie' : /music|cd|record|vinyl|cassette/i.test(c) ? 'music' : /book|comic/i.test(c) ? 'book' : null;
  const category = majority(cats.map(catOf)) || (majority(its.map(i => detectPlatform(i.title))) ? 'game' : 'other');
  let format = '';
  if (category === 'game') format = majority(its.map(i => detectPlatform(i.title))) || 'Other game';
  else if (category === 'movie') format = /\b(4k|uhd)\b/i.test(blob) ? '4K UHD' : /blu-?ray/i.test(blob) ? 'Blu-ray' : /\bvhs\b/i.test(blob) ? 'VHS' : 'DVD';
  else if (category === 'music') format = /vinyl|\blp\b|record/i.test(blob) ? 'Vinyl LP' : /cassette|tape/i.test(blob) ? 'Cassette' : 'CD';
  const prices = its.filter(i => i.price != null && i.currency === its[0].currency).map(i => i.price).sort((a, b) => a - b);
  const region = /\bpal\b/i.test(blob) ? 'PAL' : /\bntsc\b/i.test(blob) ? 'NTSC' : '';
  return { category, format, title: consensusTitle(its.map(i => i.title)), cover: its.find(i => i.image)?.image || '', source: 'eBay',
    country: region, rawTitle: its[0].title,
    ebay: prices.length ? { n: its.length, low: prices[0], median: prices[Math.floor(prices.length / 2)], currency: its[0].currency, market: d.market } : null };
}
async function srcPC(code) {
  if (!proxy() || !S.pcToken) return null;
  const d = await getJSON(`${proxy()}/pc?code=${code}&t=${encodeURIComponent(S.pcToken)}`);
  if (!d || d.status !== 'success' || !d['product-name']) return null;
  const cents = v => v ? (v / 100).toFixed(2) : null;
  const fmt = PC_CONSOLE[d['console-name']] || detectPlatform(d['console-name']) || 'Other game';
  return { category: catOfFormat(fmt) || 'game', format: fmt, title: d['product-name'], pcId: d.id, source: 'PriceCharting',
    price: { loose: cents(d['loose-price']), cib: cents(d['cib-price']), new: cents(d['new-price']) } };
}

const isISBN = c => /^97[89]\d{10}$/.test(c);
// Combine every source into one best guess. Music sources run first since they are free and precise.
async function lookup(code, wantFormat) {
  const wantCat = catOfFormat(wantFormat);
  const tasks = [];
  if (isISBN(code) || wantCat === 'book') tasks.push(srcOpenLibrary(code));
  if (!wantCat || wantCat === 'music' || wantCat === 'movie') tasks.push(srcDiscogs(code, wantFormat), srcMB(code));
  if (wantCat !== 'music' && wantCat !== 'book') tasks.push(srcUPC(code), srcPC(code));
  if (wantCat !== 'book' || !isISBN(code)) tasks.push(srcEbay(code)); // eBay also gives local prices for everything
  const settled = await Promise.allSettled(tasks);
  const got = settled.filter(s => s.status === 'fulfilled' && s.value).map(s => s.value);
  const errors = settled.filter(s => s.status === 'rejected').map(s => s.reason?.message || 'error');
  if (!got.length) return { found: false, errors };
  const by = n => got.find(g => g.source === n);
  const pc = by('PriceCharting'), dg = by('Discogs'), mb = by('MusicBrainz'), up = by('UPCitemdb'), ol = by('Open Library'), eb = by('eBay');
  // UPCitemdb titles are cleaner than eBay's, but only if it agrees on what kind of thing this is
  const upOK = up && up.category !== 'other' && (!eb || up.category === eb.category);
  let best = pc || dg || mb || ol || (upOK ? up : null) || eb || up;
  best = { ...best };
  if (best.source === 'Discogs') { if (mb) { best.mbid = mb.mbid; best.rgid = mb.rgid; best.cover ||= mb.cover; } }
  if (pc && up) { best.cover ||= up.cover; best.publisher ||= up.publisher; }
  if (eb) { best.ebay = eb.ebay; best.cover ||= eb.cover; if (best.category === 'game' && (!best.format || best.format === 'Other game')) best.format = eb.format; if (!best.country && eb.country) best.country = eb.country; }
  if (wantFormat && catOfFormat(wantFormat) === best.category) best.format = wantFormat;
  best.sources = got.map(g => g.source);
  return { found: true, cand: best, errors };
}

// Prices for an item: Discogs marketplace is public; PriceCharting needs a token.
async function priceInfo(c) {
  const out = {};
  try {
    if (c.discogsId) {
      const s = await getJSON(`https://api.discogs.com/marketplace/stats/${c.discogsId}?curr_abbr=USD`, { headers: discogsHeaders() });
      if (s) out.discogs = { low: s.lowest_price?.value, n: s.num_for_sale };
    }
    if (c.masterId?.startsWith('d')) {
      const m = await getJSON(`https://api.discogs.com/masters/${c.masterId.slice(1)}`, { headers: discogsHeaders() });
      if (m) out.master = { low: m.lowest_price, n: m.num_for_sale };
    }
  } catch {}
  if (c.price) out.pc = c.price;
  if (c.ebay) out.ebay = c.ebay;
  return out;
}
const ebayFindUrl = code => `https://${ebayHost()}/sch/i.html?_nkw=${encodeURIComponent(code)}`;
const priceLinks = (c, code) => {
  const q = encodeURIComponent([c.creator, c.title, c.category === 'game' ? c.format : ''].filter(Boolean).join(' ') || code);
  const L = [[`https://${ebayHost()}/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1`, 'eBay sold']];
  if (c.discogsId) L.push([`https://www.discogs.com/sell/release/${c.discogsId}`, 'Discogs market']);
  if (c.category === 'game' || c.category === 'movie' || !c.discogsId) L.push([`https://www.pricecharting.com/search-products?q=${encodeURIComponent(code || c.title)}&type=prices`, 'PriceCharting']);
  return L;
};

// ---------- UI helpers ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2200); }
function flash(color) { const f = $('#flash'); f.style.background = color; f.style.opacity = .35; setTimeout(() => f.style.opacity = 0, 160); }
let actx;
function beep(kind) {
  if (!S.beep) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const tones = { own: [330, 220], sim: [520, 440], new: [880, 1320], add: [990] }[kind] || [880];
    tones.forEach((f, i) => { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = f; o.connect(g); g.connect(actx.destination);
      const t0 = actx.currentTime + i * .12; g.gain.setValueAtTime(.15, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + .11); o.start(t0); o.stop(t0 + .12); });
    navigator.vibrate?.(kind === 'own' ? [80, 60, 80] : 40);
  } catch {}
}
function itemRow(it, extra = '') {
  const img = it.cover ? `<img src="${esc(it.cover)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph',textContent:'${CAT_ICON[it.category] || '📦'}'}))">` : `<div class="ph">${CAT_ICON[it.category] || '📦'}</div>`;
  const sub = [it.creator, it.year, it.country].filter(Boolean).join(' · ');
  return `<button class="item" data-id="${it.id}">${img}<div class="meta"><div class="t">${esc(it.title || 'Untitled (' + (it.barcode || '?') + ')')}</div>
    <div class="s"><span class="pill">${esc(it.format || CAT_LABEL[it.category] || '?')}</span>${esc(sub)}${(it.copies || 1) > 1 ? ` · ×${it.copies}` : ''}</div>${extra}</div></button>`;
}
function bindItemClicks(root) { root.querySelectorAll('.item[data-id]').forEach(b => b.onclick = () => openEditor(items.find(x => x.id === b.dataset.id))); }
function fillFormatSelect(sel, value, withAuto) {
  sel.innerHTML = (withAuto ? `<option value="">Auto-detect</option>` : '') + Object.entries(FORMATS).map(([c, fs]) =>
    `<optgroup label="${CAT_LABEL[c]}">${fs.map(f => `<option${f === value ? ' selected' : ''}>${esc(f)}</option>`).join('')}</optgroup>`).join('');
  sel.value = value || '';
}

// ---------- scanner ----------
// Native BarcodeDetector where it exists (Android Chrome); otherwise zxing-cpp compiled to WebAssembly,
// which is far better at 1D product barcodes than pure-JS decoders (this is what iPhones use).
let decoder = null;
async function getDecoder() {
  if (decoder) return decoder;
  if ('BarcodeDetector' in window) {
    try {
      const fm = await BarcodeDetector.getSupportedFormats();
      if (fm.includes('ean_13')) {
        const bd = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'].filter(f => fm.includes(f)) });
        return decoder = async src => (await bd.detect(src)).map(r => r.rawValue);
      }
    } catch {}
  }
  ZXingWASM.prepareZXingModule({ overrides: { locateFile: (p, pre) => p.endsWith('.wasm') ? new URL('vendor/zxing_reader.wasm', location.href).href : pre + p }, fireImmediately: true });
  const opts = { formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE', 'Code128'], tryHarder: true, tryRotate: true }; // note: maxNumberOfSymbols:1 suppresses 1D results in zxing-cpp
  return decoder = async src => {
    const c = src instanceof HTMLCanvasElement ? src : toCanvas(src);
    const img = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);
    return (await ZXingWASM.readBarcodes(img, opts)).filter(r => r.isValid).map(r => r.text);
  };
}
function toCanvas(src, crop) {
  const w = src.videoWidth || src.width, h = src.videoHeight || src.height;
  const [sx, sy, sw, sh] = crop || [0, 0, w, h];
  const scale = Math.min(1, 1600 / sw);
  const c = document.createElement('canvas'); c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
  c.getContext('2d', { willReadFrequently: true }).drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}
// EAN/UPC check digit, so a misread never reaches the lookup
function validCode(code) {
  if (![8, 12, 13].includes(code.length)) return code.length >= 6; // Code 128 etc: accept as-is
  const d = code.split('').map(Number), chk = d.pop();
  const sum = d.reverse().reduce((a, n, i) => a + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === chk;
}

let stream = null, video = null, scanning = false, paused = false, busy = false, lastCode = '', lastAt = 0;
async function startCamera() {
  const host = $('#reader'); host.classList.remove('idle');
  host.innerHTML = `<video playsinline muted autoplay></video><div class="guide"></div>
    <div class="camtools"><button class="btn small" id="torchBtn" hidden>🔦</button><button class="btn small" id="zoomBtn" hidden>2×</button></div>
    <div class="camhint">Hold steady, a hand-span away · blurry? use 📷</div>`;
  video = host.querySelector('video');
  try {
    getDecoder();
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
      facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, advanced: [{ focusMode: 'continuous' }] } });
    video.srcObject = stream; await video.play();
    scanning = true; paused = false;
    setupCamTools(stream.getVideoTracks()[0]);
    scanLoop();
  } catch (e) {
    host.classList.add('idle'); host.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted)">Camera unavailable (${esc(e?.message || e)}).<br>Use 📷 Photo or type the barcode instead.<br><br><button class="btn primary" id="camBtn">Try again</button></div>`;
    $('#camBtn').onclick = startCamera;
  }
}
function setupCamTools(track) {
  const caps = track.getCapabilities?.() || {};
  if (caps.torch) { const b = $('#torchBtn'); b.hidden = false; let on = false; b.onclick = () => { on = !on; track.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {}); b.classList.toggle('primary', on); }; }
  if (caps.zoom && caps.zoom.max >= 2) { const b = $('#zoomBtn'); b.hidden = false; let z = 1; b.onclick = () => { z = z === 1 ? 2 : 1; track.applyConstraints({ advanced: [{ zoom: z }] }).catch(() => {}); b.textContent = z === 1 ? '2×' : '1×'; }; }
}
async function scanLoop() {
  if (!scanning) return;
  if (!paused && !busy && video.readyState >= 2 && !document.hidden) {
    busy = true;
    try {
      // map the on-screen guide box back to video pixels (the video is object-fit: cover), with some slack
      const vw = video.videoWidth, vh = video.videoHeight, cw = video.clientWidth, ch = video.clientHeight;
      const s = Math.max(cw / vw, ch / vh), visW = cw / s, visH = ch / s, x0 = (vw - visW) / 2, y0 = (vh - visH) / 2;
      const codes = await (await getDecoder())(toCanvas(video, [x0, y0 + visH * .15, visW, visH * .7]));
      for (const c of codes) onDecoded(c);
    } catch {}
    busy = false;
  }
  setTimeout(() => requestAnimationFrame(scanLoop), 90);
}
function pauseScanner() { paused = true; }
function resumeScanner() { paused = false; }
function onDecoded(text) {
  const code = String(text).replace(/\D/g, '');
  if (code.length < 6 || !validCode(code) || paused) return;
  if (code === lastCode && Date.now() - lastAt < 4000) return;
  lastCode = code; lastAt = Date.now();
  handleCode(code);
}
// iPhone stills are autofocused and full resolution, so a photo decodes even when live video won't.
async function decodePhoto(file) {
  toast('Reading photo…');
  try {
    const bmp = await createImageBitmap(file);
    const codes = await (await getDecoder())(toCanvas(bmp));
    if (!codes.length) return toast('No barcode found. Try closer and in focus');
    lastCode = ''; paused = false; onDecoded(codes[0]);
  } catch (e) { toast('Could not read photo'); }
}
document.addEventListener('visibilitychange', () => {
  // iOS ends the camera when the app is backgrounded; bring it back on return
  if (!document.hidden && scanning && stream && stream.getVideoTracks().every(t => t.readyState === 'ended')) startCamera();
});

// ---------- scan handling ----------
const recent = []; // session scan history
function handleCode(code) { return S.mode === 'add' ? catalogue(code) : check(code); }

async function check(code) {
  pauseScanner();
  const res = $('#result');
  const local = findMatches(null, code);
  if (local.exact.length) { renderVerdict({ code, cand: local.exact[0], m: local, offlineOK: true }); beep('own'); flash('var(--own)'); }
  else res.innerHTML = `<div class="verdict"><span class="spinner"></span>Looking up ${esc(code)}…</div>`;
  let r;
  try { r = await lookup(code, S.format); } catch (e) { r = { found: false, errors: [e.message] }; }
  const m = findMatches(r.cand, code);
  const kind = m.exact.length ? 'own' : (m.variants.length || m.similar.length) ? 'sim' : 'new';
  if (!local.exact.length) { beep(kind); flash(`var(--${kind})`); }
  renderVerdict({ code, cand: r.cand || m.exact[0], found: r.found, m, errors: r.errors });
  pushRecent(code, r.cand, kind);
}

function renderVerdict({ code, cand, found, m, errors = [] }) {
  const kind = m.exact.length ? 'own' : (m.variants.length || m.similar.length) ? 'sim' : 'new';
  const tag = { own: m.exact.length > 1 || (m.exact[0]?.copies || 1) > 1 ? `You own this (×${m.exact.reduce((a, b) => a + (b.copies || 1), 0)})` : 'You own this',
    sim: m.variants.length ? 'You own another version' : 'You might own this', new: 'Not in your collection' }[kind];
  const title = cand?.title || (found === false ? 'Unknown barcode' : code);
  const sub = cand ? [cand.creator, cand.format, cand.year, cand.country].filter(Boolean).join(' · ') : `Barcode ${code}`;
  const offline = !navigator.onLine || errors.some(e => /failed|network|load/i.test(e));
  const others = [...m.exact, ...m.variants, ...m.similar];
  const html = `<div class="verdict ${kind}">
    <div class="tag">${tag}</div><h2>${esc(title)}</h2><div class="sub">${esc(sub)}</div>
    ${cand?.details ? `<div class="sub">${esc(cand.details)}</div>` : ''}
    ${found === false && !m.exact.length ? `<div class="sub" style="margin-top:6px">${offline ? 'Offline: checked your collection only.' : 'No database knew this barcode. Tap <b>Find on eBay</b> to see what it is, then add it and type the name once.'}</div>` : ''}
    ${others.length ? `<div class="matches">${others.map(it => itemRow(it, m.exact.includes(it) ? '' : `<div class="s">${m.variants.includes(it) ? 'Same release family, different pressing/edition' : 'Similar title'}</div>`)).join('')}</div>` : ''}
    <div class="prices" id="priceBox"></div>
    <div class="actions">
      <button class="btn primary" id="vNext">Scan next</button>
      ${m.exact.length ? `<button class="btn" id="vCopy">+1 copy</button>` : `<button class="btn" id="vAdd">Add to collection</button>`}
      ${found === false && !m.exact.length ? `<a class="btn" href="${ebayFindUrl(code)}" target="_blank" rel="noopener">🔎 Find on eBay</a>` : ''}
    </div></div>`;
  $('#result').innerHTML = html;
  $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  bindItemClicks($('#result'));
  $('#vNext').onclick = () => { $('#result').innerHTML = ''; resumeScanner(); };
  if ($('#vAdd')) $('#vAdd').onclick = async () => { const it = newItem(code, found ? cand : null); await saveItem(it); toast('Added'); openEditor(it); };
  if ($('#vCopy')) $('#vCopy').onclick = async () => { const it = m.exact[0]; it.copies = (it.copies || 1) + 1; await saveItem(it); toast(`Now ×${it.copies}`); $('#vCopy').remove(); };
  if (cand && navigator.onLine) showPrices(cand, code);
}
async function showPrices(cand, code) {
  const box = $('#priceBox'); if (!box) return;
  const links = priceLinks(cand, code).map(([u, l]) => `<a href="${u}" target="_blank" rel="noopener">${l} ↗</a>`).join('');
  box.innerHTML = `<div class="links">${links}</div>`;
  const p = await priceInfo(cand);
  const parts = [];
  if (p.discogs?.low != null) parts.push(`This pressing: from <b>$${p.discogs.low.toFixed(2)}</b> (${p.discogs.n} for sale)`);
  if (p.master?.low != null) parts.push(`Any version: from <b>$${Number(p.master.low).toFixed(2)}</b> (${p.master.n} for sale)`);
  if (p.ebay) parts.push(`eBay ${EBAY[p.ebay.market]?.[0] || ''} listings: typical <b>${money(p.ebay.median, p.ebay.currency)}</b>, from ${money(p.ebay.low, p.ebay.currency)} (${p.ebay.n})`);
  if (p.pc) parts.push(`Loose <b>$${p.pc.loose ?? '–'}</b> · Complete <b>$${p.pc.cib ?? '–'}</b> · New <b>$${p.pc.new ?? '–'}</b>`);
  if (document.body.contains(box)) box.innerHTML = (parts.length ? parts.join('<br>') : '') + `<div class="links">${links}</div>`;
}

function newItem(code, cand) {
  const fmt = cand?.format || S.format || '';
  return {
    id: uid(), barcode: code || '', title: cand?.title || '', creator: cand?.creator || '', category: cand?.category || catOfFormat(fmt) || 'other',
    format: fmt, year: cand?.year || '', country: cand?.country || '', publisher: cand?.publisher || '', cover: cand?.cover || '',
    discogsId: cand?.discogsId || null, masterId: cand?.masterId || '', mbid: cand?.mbid || '', rgid: cand?.rgid || '', pcId: cand?.pcId || null,
    details: cand?.details || '', source: cand?.source || 'manual', copies: 1, notes: '', paid: '', needsInfo: !cand?.title,
    addedAt: Date.now(),
  };
}

// Catalogue mode: never block the camera. Lookups queue up and run one after another.
let queue = Promise.resolve(), pending = 0;
function catalogue(code) {
  const ex = findMatches(null, code).exact;
  if (ex.length) { beep('own'); toast(`Already have: ${ex[0].title || code}`); renderVerdict({ code, cand: ex[0], m: { exact: ex, variants: [], similar: [] } }); return; }
  const it = newItem(code, null); it.title = ''; it.needsInfo = true; it.looking = true;
  saveItem(it); beep('add'); pending++; renderQueue();
  queue = queue.then(async () => {
    try {
      const r = await lookup(code, S.format);
      if (r.found) {
        const filled = { ...newItem(code, r.cand), id: it.id, addedAt: it.addedAt };
        if (!S.autoAdd) { pending--; renderQueue(); await removeItem(it.id); check(code); return; }
        await saveItem(filled); pushRecent(code, filled, 'add');
      } else { delete it.looking; it.lookupFailed = r.errors?.length ? 'error' : 'notfound'; await saveItem(it); pushRecent(code, null, 'inbox'); }
    } catch { delete it.looking; await saveItem(it); }
    pending--; renderQueue();
  });
}
function renderQueue() { if (S.mode === 'add') $('#result').innerHTML = pending ? `<div class="verdict"><span class="spinner"></span>Looking up ${pending} item${pending > 1 ? 's' : ''}… keep scanning</div>` : ''; }
function pushRecent(code, cand, kind) { recent.unshift({ code, cand, kind, at: Date.now() }); recent.length = Math.min(recent.length, 12); renderRecent(); }
function renderRecent() {
  const its = recent.map(r => items.find(it => it.barcode === r.code)).filter(Boolean);
  const uniq = [...new Map(its.map(i => [i.id, i])).values()];
  $('#recentWrap').innerHTML = S.mode === 'add' && uniq.length ? `<h3>Just added</h3><div class="list">${uniq.map(i => itemRow(i)).join('')}</div>` : '';
  bindItemClicks($('#recentWrap'));
}

// Free-text search box on the scan page: barcode → lookup, words → search the collection.
async function manualGo() {
  const v = $('#manualCode').value.trim(); if (!v) return;
  $('#manualCode').blur();
  if (/^[\d\s-]{8,}$/.test(v)) { $('#manualCode').value = ''; return handleCode(v.replace(/\D/g, '')); }
  pauseScanner();
  const nv = norm(v);
  const hits = items.map(it => ({ it, s: Math.max(dice(nv, norm(it.title, it.category)), dice(nv, norm(it.title)), norm(`${it.creator} ${it.title}`).includes(nv) ? 1 : 0) }))
    .filter(x => x.s >= 0.55).sort((a, b) => b.s - a.s).slice(0, 15).map(x => x.it);
  $('#result').innerHTML = `<div class="verdict ${hits.length ? 'sim' : 'new'}"><div class="tag">${hits.length ? `${hits.length} possible match${hits.length > 1 ? 'es' : ''}` : 'Nothing like that in your collection'}</div>
    <h2>“${esc(v)}”</h2><div class="matches">${hits.map(i => itemRow(i)).join('')}</div>
    <div class="actions"><button class="btn primary" id="vNext">Scan next</button></div></div>`;
  bindItemClicks($('#result'));
  $('#vNext').onclick = () => { $('#result').innerHTML = ''; resumeScanner(); };
}

// ---------- editor sheet ----------
function openEditor(it) {
  if (!it) return;
  const sheet = $('#sheet');
  sheet.innerHTML = `${it.cover ? `<img class="cover-lg" src="${esc(it.cover)}" alt="" onerror="this.remove()">` : ''}
    <h2>${it.needsInfo ? 'Name this item' : 'Edit item'}</h2>
    <form class="form" id="edForm">
      <div class="full"><label>Title</label><input name="title" value="${esc(it.title)}" placeholder="Title"></div>
      <div class="full"><label>Artist / director / author</label><input name="creator" value="${esc(it.creator)}"></div>
      <div><label>Format</label><select name="format"></select></div>
      <div><label>Year</label><input name="year" inputmode="numeric" value="${esc(it.year)}"></div>
      <div><label>Barcode</label><input name="barcode" inputmode="numeric" value="${esc(it.barcode)}"></div>
      <div><label>Copies</label><input name="copies" type="number" min="1" value="${it.copies || 1}"></div>
      <div><label>Label / publisher</label><input name="publisher" value="${esc(it.publisher)}"></div>
      <div><label>Paid</label><input name="paid" inputmode="decimal" value="${esc(it.paid)}" placeholder="$"></div>
      <div class="full"><label>Notes (condition, edition, where bought…)</label><textarea name="notes">${esc(it.notes)}</textarea></div>
      <div class="full sub" style="color:var(--muted);font-size:12px">${esc([it.details, it.source && 'Source: ' + it.source, it.discogsId && 'Discogs #' + it.discogsId].filter(Boolean).join(' · '))}</div>
      <div class="full row">
        <button class="btn primary" type="submit" style="flex:1">Save</button>
        ${it.barcode ? `<button class="btn" type="button" id="edRelook">Look up again</button>` : ''}
        ${it.barcode && it.needsInfo ? `<a class="btn" href="${ebayFindUrl(it.barcode)}" target="_blank" rel="noopener">🔎 eBay</a>` : ''}
        <button class="btn danger" type="button" id="edDel">Delete</button>
      </div>
    </form>`;
  fillFormatSelect(sheet.querySelector('[name=format]'), it.format, false);
  sheet.querySelector('#edForm').onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const changedTitle = f.title !== it.title;
    Object.assign(it, f, { copies: Math.max(1, parseInt(f.copies) || 1), category: catOfFormat(f.format) || it.category });
    if (it.title) { it.needsInfo = false; delete it.lookupFailed; }
    if (changedTitle && it.source !== 'manual') it.source += ' (edited)';
    await saveItem(it); closeSheet(); toast('Saved'); renderAll();
  };
  sheet.querySelector('#edDel').onclick = async () => { if (confirm(`Delete “${it.title || it.barcode}”?`)) { await removeItem(it.id); closeSheet(); toast('Deleted'); renderAll(); } };
  const rl = sheet.querySelector('#edRelook');
  if (rl) rl.onclick = async () => {
    rl.innerHTML = '<span class="spinner"></span>…';
    const r = await lookup(it.barcode, it.format).catch(() => ({ found: false }));
    if (!r.found) { rl.textContent = 'Not found'; return; }
    Object.assign(it, { ...newItem(it.barcode, r.cand), id: it.id, addedAt: it.addedAt, copies: it.copies, notes: it.notes, paid: it.paid });
    await saveItem(it); openEditor(it); renderAll();
  };
  $('#sheetBg').classList.add('on'); sheet.classList.add('on');
}
function closeSheet() { $('#sheet').classList.remove('on'); $('#sheetBg').classList.remove('on'); }

// ---------- collection / inbox views ----------
let showN = 200;
function renderColl() {
  const q = norm($('#q').value), cat = $('#catFilter').value;
  let list = items.filter(i => !i.needsInfo);
  if (cat) list = list.filter(i => cat.startsWith('f:') ? i.format === cat.slice(2) : i.category === cat);
  if (q) list = list.filter(i => norm(`${i.title} ${i.creator} ${i.format} ${i.year} ${i.notes} ${i.barcode}`).includes(q));
  list.sort((a, b) => (a.creator || a.title || '').localeCompare(b.creator || b.title || '', undefined, { sensitivity: 'base' }) || (a.title || '').localeCompare(b.title || ''));
  $('#collList').innerHTML = list.length ? list.slice(0, showN).map(i => itemRow(i)).join('') + (list.length > showN ? `<button class="btn big" id="more">Show more (${list.length - showN})</button>` : '')
    : `<div class="empty">${items.length ? 'No matches.' : 'Nothing here yet.<br>Switch to <b>Catalogue</b> mode on the Scan tab and start scanning a shelf.'}</div>`;
  bindItemClicks($('#collList'));
  if ($('#more')) $('#more').onclick = () => { showN += 300; renderColl(); };
  const byCat = {}; for (const i of items) if (!i.needsInfo) byCat[i.category] = (byCat[i.category] || 0) + (i.copies || 1);
  $('#stats').innerHTML = Object.entries(byCat).map(([c, n]) => `<span>${CAT_ICON[c]} <b>${n}</b> ${CAT_LABEL[c]}</span>`).join('');
}
function renderCatFilter() {
  const sel = $('#catFilter'), cur = sel.value;
  const fmts = [...new Set(items.map(i => i.format).filter(Boolean))].sort();
  sel.innerHTML = `<option value="">All</option>` + Object.keys(FORMATS).map(c => `<option value="${c}">${CAT_LABEL[c]}</option>`).join('') +
    (fmts.length ? `<optgroup label="Format">${fmts.map(f => `<option value="f:${esc(f)}">${esc(f)}</option>`).join('')}</optgroup>` : '');
  sel.value = cur;
}
function renderInbox() {
  const list = items.filter(i => i.needsInfo).sort((a, b) => b.addedAt - a.addedAt);
  $('#inboxList').innerHTML = list.length ? list.map(i => itemRow(i, `<div class="s">${i.looking ? 'Looking up…' : 'Tap to add a title'}</div>`)).join('') : '<div class="empty">All caught up ✨</div>';
  bindItemClicks($('#inboxList'));
}
function refreshCounts() {
  const n = items.filter(i => !i.needsInfo).reduce((a, b) => a + (b.copies || 1), 0), inbox = items.filter(i => i.needsInfo && !i.looking).length;
  $('#hdrCount').textContent = `${n.toLocaleString()} item${n === 1 ? '' : 's'}`;
  const b = $('#inboxBadge'); b.hidden = !inbox; b.textContent = inbox;
  if (view === 'coll') renderColl(); if (view === 'inbox') renderInbox(); if (S.mode === 'add') renderRecent();
}
function renderAll() { renderCatFilter(); refreshCounts(); }

// ---------- import / export ----------
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const LIBIB = {
  music: { file: 'music', cols: 'title,creators,description,upc_isbn10,ean_isbn13,number_of_discs,tags,notes,group,price,added,publisher,publish_date,length_of,copies,call_number,ddc,lcc,rating,review,review_created,status,began_date,completed_date' },
  movie: { file: 'movie', cols: 'title,creators,description,upc_isbn10,ean_isbn13,number_of_discs,ensemble,aspect_ratio,tags,notes,group,price,added,publisher,publish_date,length_of,copies,call_number,ddc,lcc,rating,review,review_created,status,began_date,completed_date' },
  game: { file: 'videogame', cols: 'title,creators,description,upc_isbn10,ean_isbn13,esrb,tags,notes,group,price,added,publisher,publish_date,copies,call_number,ddc,lcc,rating,review,review_created,status,began_date,completed_date' },
  book: { file: 'book', cols: 'title,creators,description,upc_isbn10,ean_isbn13,group,tags,notes,price,added,publisher,publish_date,length_of,copies,call_number,lexile,ddc,lcc,lccn,oclc,rating,review,review_created,status,began_date,completed_date' },
};
const csvCell = v => /[",\n]/.test(v = String(v ?? '')) ? `"${v.replace(/"/g, '""')}"` : v;
function libibCSV(cat) {
  const { cols } = LIBIB[cat], keys = cols.split(',');
  const rows = items.filter(i => i.category === cat && !i.needsInfo).map(i => {
    const d = canon(i.barcode).length <= 12 ? canon(i.barcode).padStart(12, '0') : i.barcode.replace(/\D/g, '');
    const v = {
      title: i.title, creators: cat === 'game' ? i.format : i.creator, upc_isbn10: d.length === 12 ? d : '', ean_isbn13: d.length === 13 ? d : '',
      tags: [i.format, i.country].filter(Boolean).join(','), notes: [i.notes, i.details].filter(Boolean).join(' | '), price: i.paid,
      added: new Date(i.addedAt).toLocaleDateString('en-CA'), // YYYY-MM-DD in local time publisher: i.publisher, copies: i.copies || 1,
    };
    return keys.map(k => csvCell(v[k])).join(',');
  });
  return '﻿' + [cols, ...rows].join('\n');
}
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
async function importFile(file) {
  const text = (await file.text()).replace(/^﻿/, '');
  let added = 0;
  if (/\.json$/i.test(file.name)) {
    const data = safeJSON(text); const arr = Array.isArray(data) ? data : data?.items;
    if (!Array.isArray(arr)) return toast('Not a Stacks backup');
    for (const it of arr) if (it?.id) { await DB.put(it); added++; }
  } else {
    const [head, ...rows] = parseCSV(text); const h = head.map(x => x.trim().toLowerCase());
    const col = (r, ...names) => { for (const n of names) { const i = h.indexOf(n); if (i >= 0 && r[i]) return r[i].trim(); } return ''; };
    const guessCat = (t, r) => /video ?game/i.test(t) ? 'game' : /movie|film/i.test(t) ? 'movie' : /music|album/i.test(t) ? 'music' : /book/i.test(t) ? 'book' : null;
    const fileCat = guessCat(file.name);
    for (const r of rows) {
      const title = col(r, 'title'); if (!title) continue;
      const cat = guessCat(col(r, 'item_type', 'type')) || fileCat || 'other';
      const creators = col(r, 'creators', 'creator', 'artist');
      const fmt = cat === 'game' ? (detectPlatform(creators) || detectPlatform(col(r, 'tags')) || 'Other game') : (FORMATS[cat] || []).find(f => new RegExp(`\\b${f.split(' ')[0]}\\b`, 'i').test(col(r, 'tags', 'format'))) || '';
      await DB.put({ ...newItem(col(r, 'upc_isbn10', 'ean_isbn13', 'upc', 'ean', 'barcode'), null), title, creator: cat === 'game' ? '' : creators, category: cat, format: fmt,
        publisher: col(r, 'publisher'), year: col(r, 'publish_date').slice(0, 4), notes: col(r, 'notes'), copies: parseInt(col(r, 'copies')) || 1,
        paid: col(r, 'price'), needsInfo: false, source: 'CSV import' });
      added++;
    }
  }
  items = await DB.all(); renderAll(); toast(`Imported ${added} items`);
}

// ---------- wiring ----------
let view = 'scan';
function setView(v) {
  view = v; document.querySelectorAll('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + v));
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  if (v === 'scan') resumeScanner(); else pauseScanner();
  if (v === 'coll') { renderCatFilter(); renderColl(); } if (v === 'inbox') renderInbox();
  window.scrollTo(0, 0);
}
function setMode(m) {
  S.mode = m; saveS();
  document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  $('#result').innerHTML = ''; resumeScanner(); renderRecent();
}

async function init() {
  await DB.open(); items = await DB.all();
  navigator.storage?.persist?.();
  fillFormatSelect($('#fmtSelect'), S.format, true);
  $('#fmtSelect').onchange = e => { S.format = e.target.value; saveS(); };
  $('#camBtn').onclick = startCamera;
  $('#photoIn').onchange = e => { if (e.target.files[0]) decodePhoto(e.target.files[0]); e.target.value = ''; };
  $('#manualGo').onclick = manualGo;
  $('#manualCode').onkeydown = e => { if (e.key === 'Enter') manualGo(); };
  document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => setView(b.dataset.v));
  document.querySelectorAll('#modeSeg button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
  $('#sheetBg').onclick = closeSheet;
  $('#q').oninput = () => { showN = 200; renderColl(); };
  $('#catFilter').onchange = renderColl;
  // settings
  $('#discogsToken').value = S.discogsToken; $('#proxyUrl').value = S.proxyUrl; $('#pcToken').value = S.pcToken;
  $('#optBeep').checked = S.beep; $('#optAutoAdd').checked = S.autoAdd;
  $('#optBeep').onchange = e => { S.beep = e.target.checked; saveS(); };
  $('#optAutoAdd').onchange = e => { S.autoAdd = e.target.checked; saveS(); };
  $('#ebayMarket').innerHTML = Object.entries(EBAY).map(([k, [n]]) => `<option value="${k}">${n}</option>`).join('');
  $('#ebayMarket').value = S.ebayMarket;
  $('#ebayMarket').onchange = e => { S.ebayMarket = e.target.value; saveS(); };
  $('#saveSettings').onclick = () => { S.discogsToken = $('#discogsToken').value.trim(); S.proxyUrl = $('#proxyUrl').value.trim(); S.pcToken = $('#pcToken').value.trim(); saveS(); toast('Saved'); };
  $('#testSources').onclick = testSources;
  $('#expJson').onclick = () => download(`stacks-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: 'stacks', v: 1, exported: new Date().toISOString(), items }, null, 1), 'application/json');
  $('#impFile').onchange = e => { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ''; };
  $('#libibBtns').innerHTML = Object.keys(LIBIB).map(c => `<button class="btn small" data-c="${c}">${CAT_LABEL[c]}</button>`).join('');
  $('#libibBtns').querySelectorAll('button').forEach(b => b.onclick = () => download(`libib_${LIBIB[b.dataset.c].file}_import.csv`, libibCSV(b.dataset.c), 'text/csv'));
  $('#wipe').onclick = async () => { if (confirm('Delete every item on this device? Export a backup first!') && confirm('Really delete everything?')) { await DB.clear(); items = []; renderAll(); toast('Collection cleared'); } };
  setMode(S.mode); renderAll();
  // reset stuck lookups from a previous session
  for (const it of items.filter(i => i.looking)) { delete it.looking; await DB.put(it); }
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
async function testSources() {
  const out = $('#testOut'); out.innerHTML = '<span class="spinner"></span>Testing…';
  S.proxyUrl = $('#proxyUrl').value.trim(); S.discogsToken = $('#discogsToken').value.trim(); S.pcToken = $('#pcToken').value.trim();
  const t = async (name, fn) => { try { const r = await fn(); return `${r ? '✅' : '⚠️'} ${name}${r ? ': ' + esc(r.title) : ': no result'}`; } catch (e) { return `❌ ${name}: ${esc(e.message)}`; } };
  const lines = await Promise.all([
    t('Discogs', () => srcDiscogs('602537479870')), t('MusicBrainz', () => srcMB('602537479870')), t('Open Library', () => srcOpenLibrary('9780140449136')),
    S.proxyUrl ? t('UPC proxy', () => srcUPC('085391163329')) : 'ℹ️ UPC proxy not set',
    S.proxyUrl ? (async () => { try { const h = await getJSON(`${proxy()}/health`); if (!h?.ebay) return '⚠️ eBay: keys not set on the worker (see README)'; return await t('eBay', () => srcEbay('3307215601594')); } catch (e) { return `❌ eBay: ${esc(e.message)}`; } })() : 'ℹ️ eBay needs the proxy', S.pcToken ? t('PriceCharting', () => srcPC('045496740224')) : 'ℹ️ PriceCharting not set',
  ]);
  out.innerHTML = lines.join('<br>');
}
init();

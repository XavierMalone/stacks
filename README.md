# Stacks

A phone web app for cataloguing physical media (CDs, vinyl, cassettes, games for every console, VHS, DVD, Blu-ray, books) and checking for duplicates while you're out thrifting.

## Two modes

**🛒 Thrift check**: scan a barcode and get one of three answers:

| Colour | Meaning |
|---|---|
| 🔴 **You own this** | Same barcode is already in your collection. Works offline. |
| 🟠 **You own another version** | Same album, different pressing or format (e.g. you have the CD and this is the orange vinyl reissue). Matched with Discogs "master" and MusicBrainz "release group" IDs. |
| 🟠 **You might own this** | Similar title in the same category, e.g. the same game on another console, or a "Greatest Hits" / "Platinum" re-release. |
| 🟢 **Not in your collection** | Buy it 🙂 |

You also get recent prices: Discogs marketplace low for this exact pressing and for any version, PriceCharting loose/complete/new for games (with a token), and one-tap links to eBay *sold* listings.

**📦 Catalogue**: for bulk-scanning your shelves at home. Set **Format** first (e.g. "Vinyl LP" or "PS2"), then just keep scanning. Every item is saved immediately and lookups run in the background. Anything no database recognises goes to the **Inbox** with its barcode saved, so you can name it later. Once named, that barcode always matches.

You can also type a title in the scan box to search your own collection. That's handy for older items with no barcode (pre-1985 vinyl, cartridge games, early VHS).

## Where the data comes from

| Source | Covers | Key needed? |
|---|---|---|
| Discogs | CDs, vinyl, cassettes (best variant data) + marketplace prices | No (an optional token raises rate limits and adds cover art) |
| MusicBrainz + Cover Art Archive | Music, cover art | No |
| Open Library | Books (ISBN) | No |
| UPCitemdb (through the proxy) | Games, DVD, Blu-ray, VHS, general products | No, 100 lookups/day free |
| PriceCharting (through the proxy) | Games UPC → exact title, console, loose/CIB/new prices | Paid subscription |

There is no single free global database of every barcode. Games and movies are where free coverage is weakest, which is why the Inbox exists.

## Your data

Everything is stored on your phone (IndexedDB) and never leaves it. Use **Settings → Export backup** now and then. You can also export Libib-ready CSVs (one per type, matching Libib's own templates), or import a Libib CSV export or a backup file.

## Setup

### 1. Host it (needed for the camera, which requires HTTPS)

**GitHub Pages:** create a repo, upload everything in this folder (except `proxy/`, if you like), then go to Settings → Pages → deploy from `main`. Open the URL on your phone, then Share → **Add to Home Screen**. It then opens full-screen and works offline.

Netlify Drop or Cloudflare Pages also work: drag the folder in.

### 2. (Optional) The lookup proxy, for games and movies, ~2 minutes

1. Sign up free at dash.cloudflare.com → **Workers & Pages → Create → Worker**.
2. Name it `stacks-proxy`, click **Deploy**, then **Edit code**. Paste in `proxy/worker.js` and **Deploy** again.
3. Copy the `https://stacks-proxy.<you>.workers.dev` URL into Stacks **Settings → Lookup proxy URL**, then tap **Test sources**.

The worker only forwards the two lookups above, so it can't be used as an open proxy.

## Tips for a big collection

- Do one format per session. Set the Format dropdown once and scan a whole shelf. Starting with CDs and vinyl gives the best hit rate.
- Don't stop to fix misses. Clear the Inbox later from the couch.
- Rare variants: if the auto-picked pressing is wrong, tap the item and add a note (colour, country, catalogue number).

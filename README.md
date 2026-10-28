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
| **eBay (through the proxy)** | **Everything, worldwide: games (incl. PAL/Australian), DVD, VHS, music.** Title, console, region and live local prices | Free developer key, 5,000 lookups/day |
| PriceCharting (through the proxy) | Games UPC → exact title, console, loose/CIB/new prices | Paid subscription |

There's no free "barcode database" that covers games well (UPCitemdb is mostly US). eBay is effectively the world's biggest one, because sellers list items by barcode. Stacks reads the listings for a barcode and takes the title most of them agree on, e.g. 4 messy listings → "Just Dance 3 Special Edition · Wii · PAL".

**No setup?** Unknown barcodes get a **🔎 Find on eBay** button that opens eBay's barcode search, so you can see what it is and type the name once.

## Your data

Everything is stored on your phone (IndexedDB) and never leaves it. Use **Settings → Export backup** now and then. You can also export Libib-ready CSVs (one per type, matching Libib's own templates), or import a Libib CSV export or a backup file.

## Setup

### 1. Host it (needed for the camera, which requires HTTPS)

**GitHub Pages:** create a repo, upload everything in this folder (except `proxy/`, if you like), then go to Settings → Pages → deploy from `main`. Open the URL on your phone, then Share → **Add to Home Screen**. It then opens full-screen and works offline.

Netlify Drop or Cloudflare Pages also work: drag the folder in.

### 2. The lookup proxy, for automatic game and movie lookups, ~10 minutes, all free

**a) Get eBay keys** (lets the proxy search eBay)
1. Go to developer.ebay.com → **Join**, and sign in with your normal eBay account.
2. Open **Application Keys**, then create a **Production** keyset (call the app "Stacks").
3. eBay will ask about *Marketplace account deletion notifications*. Choose the **exemption**: Stacks doesn't store any eBay user data.
4. Copy the **App ID (Client ID)** and **Cert ID (Client Secret)**.

**b) Create the proxy**
1. Sign up at dash.cloudflare.com, then go to **Workers & Pages → Create → Worker**. Name it `stacks-proxy` and click **Deploy**.
2. Click **Edit code**, replace everything with `proxy/worker.js` from this repo, and click **Deploy**.
3. Go to the worker's **Settings → Variables and Secrets → Add**. Add a *Secret* `EBAY_CLIENT_ID` (your App ID) and a *Secret* `EBAY_CLIENT_SECRET` (your Cert ID), then **Deploy**.

**c) Connect Stacks**
In Stacks → **Settings**, paste `https://stacks-proxy.<you>.workers.dev` into **Lookup proxy URL**, pick your **eBay country**, then tap **Save** and **Test sources**.

The worker only forwards these specific lookups (it can't be used as an open proxy), and it caches answers for a day to save your free quota.

## Tips for a big collection

- Do one format per session. Set the Format dropdown once and scan a whole shelf. Starting with CDs and vinyl gives the best hit rate.
- Don't stop to fix misses. Clear the Inbox later from the couch.
- Rare variants: if the auto-picked pressing is wrong, tap the item and add a note (colour, country, catalogue number).

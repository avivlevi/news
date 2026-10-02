# אותו אירוע

A comparison instrument for Israeli news. It collects the current headlines of six
sites, finds the events that two or more of them reported, and documents how each
one reported it: the headline, what the article opens with, who acts in the
headline, how long it is, who is quoted, which facts appear where, and where the
versions contradict each other.

It passes no verdict. No outlet is labelled, scored or ranked; outlets are always
listed alphabetically. Everything shown is quoted or counted from the articles.

Live: https://israel-news-aggregator.netlify.app

## Sources

ynet, N12, חדשות 13, הארץ, i24NEWS, ערוץ 14.

### The front-page record

Every hour a scheduled function (`netlify/functions/scrape.ts`) reads each
outlet's front page and stores what it showed, in what order and in which block
(lead / top / main / ticker), in Supabase Postgres. One parser per site lives in
`netlify/lib/scrape/`; all of them read server HTML or the page's embedded data,
no browser needed. A background function then reads the full text of each new
news article once.

| Outlet | Page read | Notes |
|---|---|---|
| ynet | www.ynet.co.il | blocks ordered by their absolute position; flashes load client-side, so no ticker |
| N12 | www.n12.co.il | Next.js data; flashes load client-side |
| חדשות 13 | 13tv.co.il/news/ | Next.js data; plain user agent (bot-wall) |
| הארץ | www.haaretz.co.il | only the top screens are server-rendered |
| ערוץ 14 | www.c14.co.il | server HTML |
| i24 | www.i24news.tv/he | Redux state in the page; only the headline blocks |

For הארץ and i24, "not found on the front page" therefore means "not in its top part".

Tables (`supabase/migrations/`): `articles` (one row per URL, with text),
`snapshots` (one per outlet per scrape), `appearances` (article × snapshot,
with position and slot), `headline_versions` (every headline the front page gave
an article). RLS is on with no policies; only server code with the service-role
key reads or writes.

What the record adds to the site:
- **Per event**: where each outlet's front page put its article, for how long,
  who had it first, and whether the headline was changed.
- **עמוד ראשי**: each outlet's lead story, hour by hour, side by side.
- **אם קראת רק את…**: for one outlet, what others reported that it didn't, what
  others put at the top that it didn't, and the reverse.
- **שינויים**: rewritten front-page headlines (alternating A/B versions are
  marked), and prominent items gone by the next scrape.

### What a run compares

Front-page news articles from the last 24 hours first, then the newest
feed/sitemap articles fill each outlet up to 50 (`netlify/lib/collect.ts`).
"Did it report it" is measured on everything published; "did it display it" on
the front page. Feeds (`netlify/lib/feeds.ts`):

| Outlet | Feed |
|---|---|
| ynet, הארץ, ערוץ 14, i24 | Google-News sitemap |
| N12 | Five section RSS feeds, merged |
| חדשות 13 | Its news front page's embedded Next.js data |

Without a database configured, runs use feeds alone.

## How a run works

`netlify/lib/pipeline.ts`, in order:

1. **collect** — a fresh front-page scrape, then front-page articles plus feed
   articles, 50 per outlet. Text already read by the hourly job is reused.
2. **summarise + match** — in parallel: Claude writes a per-site digest of everything
   collected, and groups articles into single events. Matching is done by a model,
   not by title similarity: outlets word the same event differently, which is the
   whole subject.
3. **merge + read** — in parallel: a cheap model pass joins events the matcher split
   in two, while the full text of every matched article is downloaded (cached 24h).
   Any Google redirect links among matched articles are resolved here.
4. **compare** — one model call per event that is new since the previous run.
   Events whose member articles are unchanged reuse the previous analysis.
5. **exposure** — every take gets its front-page record attached, reused events too.
6. **store** — the payload becomes the latest, is kept under `runs/<id>`, and a
   compact summary is appended to `runs-index` for the lexicon and coverage views.

A run takes one to four minutes and only happens when someone presses the button.
Only the scrape is scheduled; it makes no model calls.

## Working on it

```bash
npm install
npm run pipeline            # run the pipeline from the terminal → data/latest.json
npm run pipeline -- --publish   # ...and show it in the local dev site
npm run scrape              # scrape every front page into Supabase (--bodies: also read texts, --dry: print only)
netlify dev                 # site + functions + local blob store on :8889
npm run typecheck
npm run lint
```

The API key is read from `ANTHROPIC_API_KEY`, then `.env`, then `netlify env:get`.
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` come from the environment or `.env`
(Supabase project `news`, ref `tbhwecywsmwcyumbeqfl`). Schema changes:
`supabase db push`.

`netlify dev` currently rewrites Vite's module requests to index.html; to try the
site locally, `npm run build` then `netlify dev --offline --dir dist --framework '#static'`.

## Deploying

There is no CI. The Netlify site is not linked to the repository; pushing to GitHub
does nothing. To ship:

```bash
npm run build
netlify deploy --prod --dir=dist
```

## Layout

- `shared/` — types and outlet metadata used by both the site and the functions.
- `netlify/lib/` — the pipeline: feeds, collector, Google News resolver, extractor, model passes, cache, history, db.
- `netlify/lib/scrape/` — one front-page parser per outlet.
- `netlify/functions/` — `refresh-background` (the run), `scrape` (hourly), `bodies-background`, `stories`, `runs`, `status`, `frontpage`, `edits`.
- `supabase/migrations/` — the front-page record schema and its query functions.
- `src/` — React app. Hand-written CSS in `src/app.css`.
- `scripts/run-pipeline.ts` — the terminal runner.

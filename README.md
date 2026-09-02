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

Where each outlet's current article list comes from (`netlify/lib/feeds.ts`):

| Outlet | Source | Why |
|---|---|---|
| ynet, הארץ, ערוץ 14, i24 | Google-News sitemap | Every article of the last two days, title, time, image, direct URL |
| N12 | Five section RSS feeds, merged | Each feed is only 20 items |
| חדשות 13 | Its news front page's embedded Next.js data | No feed, no sitemap, and its bot-wall serves a plain user agent but not a browser one |

Google News search RSS remains as a fallback kind for a site with none of the above;
its links are Google redirects and get resolved lazily, since Google rate-limits
the resolver after about a hundred lookups per IP.

Each outlet contributes its newest 50 fresh articles per run.

## How a run works

`netlify/lib/pipeline.ts`, in order:

1. **collect** — every outlet in parallel, 48-hour window, newest 50 each.
2. **summarise + match** — in parallel: Claude writes a per-site digest of everything
   collected, and groups articles into single events. Matching is done by a model,
   not by title similarity: outlets word the same event differently, which is the
   whole subject.
3. **merge + read** — in parallel: a cheap model pass joins events the matcher split
   in two, while the full text of every matched article is downloaded (cached 24h).
   Any Google redirect links among matched articles are resolved here.
4. **compare** — one model call per event that is new since the previous run.
   Events whose member articles are unchanged reuse the previous analysis.
5. **store** — the payload becomes the latest, is kept under `runs/<id>`, and a
   compact summary is appended to `runs-index` for the lexicon and coverage views.

A run takes one to three minutes and only happens when someone presses the button.
There is no schedule.

## Working on it

```bash
npm install
npm run pipeline            # run the pipeline from the terminal → data/latest.json
npm run pipeline -- --publish   # ...and show it in the local dev site
netlify dev                 # site + functions + local blob store on :8889
npm run typecheck
npm run lint
```

The API key is read from `ANTHROPIC_API_KEY`, then `.env`, then `netlify env:get`.

## Deploying

There is no CI. The Netlify site is not linked to the repository; pushing to GitHub
does nothing. To ship:

```bash
npm run build
netlify deploy --prod --dir=dist
```

## Layout

- `shared/` — types and outlet metadata used by both the site and the functions.
- `netlify/lib/` — the pipeline: feeds, Google News resolver, extractor, model passes, cache, history.
- `netlify/functions/` — `refresh-background` (the run), `stories`, `runs`, `status`.
- `src/` — React app. Hand-written CSS in `src/app.css`.
- `scripts/run-pipeline.ts` — the terminal runner.

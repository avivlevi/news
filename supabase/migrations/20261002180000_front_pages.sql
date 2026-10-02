-- Front-page record: every article each outlet displayed, where, and when.
--
-- A scrape writes one `snapshots` row per outlet and one `appearances` row per
-- article on that page. Articles are stored once; the headline is versioned
-- only when the front page shows it differently. Everything is server-side:
-- RLS is on with no policies, so only the service role can read or write.

create table articles (
  id              bigint generated always as identity primary key,
  source          text        not null,
  url             text        not null unique,
  -- Latest headline the front page showed. Earlier ones are in headline_versions.
  title           text        not null,
  blurb           text,
  section         text        not null default '',
  is_news         boolean     not null default true,
  image_url       text,
  published_at    timestamptz,
  first_seen_at   timestamptz not null,
  last_seen_at    timestamptz not null,
  best_position   smallint    not null,
  best_slot       text        not null,
  -- Full text, read once by the bodies job. 'failed' after a paywall or bot-wall.
  body            text,
  body_read       text check (body_read in ('full', 'failed')),
  body_fetched_at timestamptz,
  word_count      int
);
create index articles_source_seen on articles (source, last_seen_at desc);
create index articles_body_pending on articles (first_seen_at desc) where body_read is null and is_news;

create table snapshots (
  id         bigint generated always as identity primary key,
  source     text        not null,
  taken_at   timestamptz not null default now(),
  item_count int         not null,
  -- Set when the fetch failed or the parser found implausibly few items.
  error      text
);
create index snapshots_source_taken on snapshots (source, taken_at desc);
create index snapshots_taken on snapshots (taken_at);

create table appearances (
  snapshot_id bigint   not null references snapshots on delete cascade,
  article_id  bigint   not null references articles on delete cascade,
  position    smallint not null,
  slot        text     not null,
  primary key (snapshot_id, article_id)
);
create index appearances_article on appearances (article_id);

create table headline_versions (
  id         bigint generated always as identity primary key,
  article_id bigint      not null references articles on delete cascade,
  title      text        not null,
  seen_at    timestamptz not null
);
create index headline_versions_article on headline_versions (article_id, seen_at);

alter table articles          enable row level security;
alter table snapshots         enable row level security;
alter table appearances       enable row level security;
alter table headline_versions enable row level security;

-- Slot rank: a lower number is more prominent.
create function slot_rank(s text) returns int language sql immutable as $$
  select case s when 'lead' then 0 when 'top' then 1 when 'main' then 2 else 3 end
$$;

/*
 * One outlet's front page, in one round trip. `p_items` is the parser's list
 * in display order: [{url,title,slot,section,isNews,blurb?,imageUrl?,publishedAt?}].
 * Position is the item's index + 1.
 */
create function record_snapshot(p_source text, p_items jsonb, p_error text default null)
returns jsonb language plpgsql as $$
declare
  v_snapshot bigint;
  v_now timestamptz := now();
  v_new int;
  v_changed int;
begin
  insert into snapshots (source, taken_at, item_count, error)
  values (p_source, v_now, jsonb_array_length(p_items), p_error)
  returning id into v_snapshot;

  -- One row per URL (an upsert can't touch a row twice); the first appearance wins.
  create temp table incoming on commit drop as
  select distinct on (i.item->>'url')
         (i.ord)::smallint as position,
         i.item->>'url' as url,
         i.item->>'title' as title,
         nullif(i.item->>'blurb', '') as blurb,
         coalesce(i.item->>'slot', 'main') as slot,
         coalesce(i.item->>'section', '') as section,
         coalesce((i.item->>'isNews')::boolean, true) as is_news,
         nullif(i.item->>'imageUrl', '') as image_url,
         (nullif(i.item->>'publishedAt', ''))::timestamptz as published_at
  from jsonb_array_elements(p_items) with ordinality as i(item, ord)
  where coalesce(i.item->>'url', '') <> '' and coalesce(i.item->>'title', '') <> ''
  order by i.item->>'url', i.ord;

  -- Headlines that differ from what we last stored, before the upsert overwrites them.
  create temp table retitled on commit drop as
  select a.id, n.title from incoming n join articles a on a.url = n.url where a.title <> n.title;
  get diagnostics v_changed = row_count;

  with ins as (
    insert into articles as a (source, url, title, blurb, section, is_news, image_url, published_at,
                               first_seen_at, last_seen_at, best_position, best_slot)
    select p_source, url, title, blurb, section, is_news, image_url, published_at,
           v_now, v_now, position, slot
    from incoming
    on conflict (url) do update set
      title         = excluded.title,
      blurb         = coalesce(excluded.blurb, a.blurb),
      image_url     = coalesce(a.image_url, excluded.image_url),
      published_at  = coalesce(a.published_at, excluded.published_at),
      last_seen_at  = v_now,
      best_position = least(a.best_position, excluded.best_position),
      best_slot     = case when slot_rank(excluded.best_slot) < slot_rank(a.best_slot)
                           then excluded.best_slot else a.best_slot end
    returning a.id, a.url, (xmax = 0) as inserted
  )
  select count(*) filter (where inserted) into v_new from ins;

  insert into headline_versions (article_id, title, seen_at)
  select a.id, a.title, v_now from articles a join incoming n on n.url = a.url
  where a.first_seen_at = v_now
  union all
  select id, title, v_now from retitled;

  insert into appearances (snapshot_id, article_id, position, slot)
  select v_snapshot, a.id, n.position, n.slot from incoming n join articles a on a.url = n.url
  on conflict do nothing;

  return jsonb_build_object('snapshot', v_snapshot, 'new', v_new, 'retitled', v_changed);
end $$;

/*
 * How long and how prominently each URL was on its outlet's front page.
 * `snapshots_seen` counts scrapes it was present in; `snapshots_total` counts
 * that outlet's scrapes over the same span, so gaps are visible.
 */
create function article_exposure(p_urls text[])
returns table (
  url text, source text, first_seen_at timestamptz, last_seen_at timestamptz,
  best_position smallint, best_slot text, snapshots_seen int, snapshots_total int,
  lead_snapshots int, on_front_now boolean, titles jsonb
) language sql stable as $$
  select a.url, a.source, a.first_seen_at, a.last_seen_at, a.best_position, a.best_slot,
    (select count(*) from appearances ap where ap.article_id = a.id)::int,
    (select count(*) from snapshots s where s.source = a.source and s.error is null
       and s.taken_at between a.first_seen_at and a.last_seen_at)::int,
    (select count(*) from appearances ap where ap.article_id = a.id and ap.slot = 'lead')::int,
    a.last_seen_at >= (select max(s.taken_at) from snapshots s where s.source = a.source and s.error is null),
    (select coalesce(jsonb_agg(jsonb_build_object('title', h.title, 'at', h.seen_at) order by h.seen_at), '[]')
       from headline_versions h where h.article_id = a.id)
  from articles a where a.url = any(p_urls)
$$;

/* The top `p_top` items of every successful snapshot in a time range. */
create function front_timeline(p_from timestamptz, p_to timestamptz, p_top int default 10)
returns table (
  source text, taken_at timestamptz, "position" smallint, slot text,
  title text, url text, is_news boolean, section text
) language sql stable as $$
  select s.source, s.taken_at, ap.position, ap.slot, a.title, a.url, a.is_news, a.section
  from snapshots s
  join appearances ap on ap.snapshot_id = s.id and ap.position <= p_top
  join articles a on a.id = ap.article_id
  where s.taken_at >= p_from and s.taken_at < p_to and s.error is null
  order by s.taken_at, s.source, ap.position
$$;

/* Articles whose front-page headline changed, with every version. */
create function headline_changes(p_since timestamptz)
returns table (
  source text, url text, is_news boolean, best_slot text, best_position smallint,
  first_seen_at timestamptz, last_seen_at timestamptz, versions jsonb
) language sql stable as $$
  select a.source, a.url, a.is_news, a.best_slot, a.best_position, a.first_seen_at, a.last_seen_at,
    jsonb_agg(jsonb_build_object('title', h.title, 'at', h.seen_at) order by h.seen_at)
  from articles a join headline_versions h on h.article_id = a.id
  where a.last_seen_at >= p_since
  group by a.id
  having count(*) > 1
  order by max(h.seen_at) desc
$$;

/*
 * Prominent articles that left the front page quickly: shown in the lead or
 * top block, present in at most `p_max_snapshots` scrapes, and gone since.
 */
create function short_lived(p_since timestamptz, p_max_snapshots int default 1)
returns table (
  source text, url text, title text, is_news boolean, best_slot text, best_position smallint,
  first_seen_at timestamptz, last_seen_at timestamptz, snapshots_seen int
) language sql stable as $$
  select a.source, a.url, a.title, a.is_news, a.best_slot, a.best_position, a.first_seen_at, a.last_seen_at, x.n
  from articles a
  cross join lateral (select count(*)::int as n from appearances ap where ap.article_id = a.id) x
  where a.first_seen_at >= p_since
    and a.best_slot in ('lead', 'top')
    and x.n <= p_max_snapshots
    and a.last_seen_at < (select max(s.taken_at) from snapshots s where s.source = a.source and s.error is null)
  order by a.first_seen_at desc
$$;

/* Latest scrape per outlet, for a health line in the UI. */
create function latest_snapshots()
returns table (source text, taken_at timestamptz, item_count int, error text)
language sql stable as $$
  select distinct on (source) source, taken_at, item_count, error
  from snapshots order by source, taken_at desc
$$;

revoke execute on function record_snapshot, article_exposure, front_timeline, headline_changes,
  short_lived, latest_snapshots from public, anon, authenticated;

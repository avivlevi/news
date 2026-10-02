import { Fragment, useEffect, useMemo, useState } from 'react';
import type { FrontPayload, FrontRow, SourceId } from '@/types';
import { api } from '@/lib/api';
import { ORDERED_SOURCES, sourceColor, sourceName } from '@/lib/sources';
import { SLOT_LABEL } from '@/lib/exposure';
import { clock, stamp } from '@/lib/time';
import { OutletLogo } from './OutletLogo';

const DAYS = 7;
const DAY_LABEL = new Intl.DateTimeFormat('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });

/** The page's main story: the item marked lead, else whatever sits first. */
const leadOf = (page?: FrontRow[]) => page?.find(r => r.slot === 'lead') ?? page?.[0];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** One hour of the day: the last scrape of each outlet within it. */
interface Hour {
  key: string;
  label: string;
  pages: Partial<Record<SourceId, FrontRow[]>>;
}

/**
 * Hourly scrapes, plus any taken when someone ran the comparison. Within an
 * hour the latest scrape of each outlet stands for it.
 */
function byHour(rows: FrontRow[]): Hour[] {
  const latest = new Map<string, Map<SourceId, string>>();
  for (const r of rows) {
    const d = new Date(r.takenAt);
    const key = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).toISOString();
    const per = latest.get(key) ?? new Map<SourceId, string>();
    if (!per.has(r.source) || per.get(r.source)! < r.takenAt) per.set(r.source, r.takenAt);
    latest.set(key, per);
  }
  const hours = new Map<string, Hour>();
  for (const r of rows) {
    const d = new Date(r.takenAt);
    const key = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).toISOString();
    if (latest.get(key)?.get(r.source) !== r.takenAt) continue;
    const h = hours.get(key) ?? { key, label: clock(key), pages: {} };
    (h.pages[r.source] ??= []).push(r);
    hours.set(key, h);
  }
  return [...hours.values()].sort((a, b) => b.key.localeCompare(a.key));
}

/**
 * What each outlet put at the top of its front page, hour by hour. The same
 * hour, side by side: what one site led with while another led with something
 * else, or didn't show it at all.
 */
export function FrontPage() {
  const today = startOfDay(new Date());
  const [day, setDay] = useState(0);
  const [data, setData] = useState<FrontPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const from = addDays(today, -day);
    api.frontpage(from, addDays(from, 1))
      .then(d => { if (alive) { setData(d); setError(null); } })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  const hours = useMemo(() => (data ? byHour(data.rows) : []), [data]);
  const health = new Map((data?.health ?? []).map(h => [h.source, h]));

  return (
    <section className="front">
      <p className="lede">
        מה כל אתר הציג בראש העמוד הראשי שלו, שעה אחר שעה. העמודים נסרקים פעם בשעה, ולכן כותרת
        שעלתה וירדה בין שתי סריקות לא נקלטת. לחיצה על שעה פותחת את עשר הכותרות העליונות של כל אתר.
      </p>

      <div className="filter">
        <div className="filter__row">
          {Array.from({ length: DAYS }, (_, i) => (
            <button key={i} className={`chip${day === i ? ' chip--on' : ''}`} onClick={() => { setDay(i); setOpen(null); }}>
              {i === 0 ? 'היום' : i === 1 ? 'אתמול' : DAY_LABEL.format(addDays(today, -i))}
            </button>
          ))}
        </div>
      </div>

      {data && (
        <ul className="health">
          {ORDERED_SOURCES.map(s => {
            const h = health.get(s);
            return (
              <li key={s} className={h?.error ? 'health--bad' : undefined} title={h?.error ?? undefined}>
                <OutletLogo source={s} size={14} />
                {h ? (h.error ? 'הסריקה האחרונה נכשלה' : `${h.itemCount} פריטים · ${stamp(h.takenAt)}`) : 'עוד לא נסרק'}
              </li>
            );
          })}
        </ul>
      )}

      {error && <div className="notice"><p className="notice__lead">לא הצלחנו לטעון את העמודים הראשיים.</p><p>{error}</p></div>}
      {data && hours.length === 0 && (
        <div className="notice"><p className="notice__lead">אין סריקות ביום הזה.</p><p>הסריקה השעתית רצה מאז שהופעלה בלבד.</p></div>
      )}

      {hours.length > 0 && (
        <div className="matrix-wrap">
          <table className="leads">
            <thead>
              <tr>
                <th scope="col" className="leads__hour">שעה</th>
                {ORDERED_SOURCES.map(s => (
                  <th key={s} scope="col" style={{ '--brand': sourceColor(s) } as React.CSSProperties}>
                    <span className="version__source"><OutletLogo source={s} size={14} />{sourceName(s)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hours.map((h, i) => {
                const prev = hours[i + 1];
                const isOpen = open === h.key;
                return (
                  <Fragment key={h.key}>
                    <tr className={`leads__row${isOpen ? ' leads__row--open' : ''}`} onClick={() => setOpen(isOpen ? null : h.key)}>
                      <th scope="row" className="leads__hour">
                        <button aria-expanded={isOpen}>{h.label}</button>
                      </th>
                      {ORDERED_SOURCES.map(s => {
                        const lead = leadOf(h.pages[s]);
                        const same = lead && leadOf(prev?.pages[s])?.url === lead.url;
                        return (
                          <td key={s} className={same ? 'leads__cell leads__cell--same' : 'leads__cell'}>
                            {lead ? (
                              <>
                                <span className="leads__title">{lead.title}</span>
                                {!lead.isNews && <span className="tag">לא חדשות · {lead.section}</span>}
                              </>
                            ) : <span className="leads__none">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                    {isOpen && (
                      <tr className="leads__detail">
                        <td colSpan={ORDERED_SOURCES.length + 1}>
                          <div className="tops">
                            {ORDERED_SOURCES.map(s => (
                              <div key={s} className="tops__col" style={{ '--brand': sourceColor(s) } as React.CSSProperties}>
                                <span className="version__source"><OutletLogo source={s} size={14} />{sourceName(s)}</span>
                                <ol>
                                  {(h.pages[s] ?? []).map(r => (
                                    <li key={r.url} className={r.isNews ? undefined : 'tops__soft'}>
                                      <span className={`slot slot--${r.slot}`} title={SLOT_LABEL[r.slot]}>{r.position}</span>
                                      <a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

import { useEffect, useMemo, useState } from 'react';
import type { EditsPayload } from '@/types';
import { api } from '@/lib/api';
import { sourceColor, sourceName } from '@/lib/sources';
import { headlineVersions, SLOT_LABEL } from '@/lib/exposure';
import { stamp } from '@/lib/time';
import { OutletLogo } from './OutletLogo';

const RANGES = [1, 2, 7] as const;

/**
 * What changed on the front pages after publication: headlines rewritten
 * while the article stayed up, and prominent items that were gone by the next
 * hourly scrape. Both are recorded facts; the reasons aren't known here.
 */
export function Edits() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(2);
  const [newsOnly, setNewsOnly] = useState(true);
  const [data, setData] = useState<EditsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.edits(days)
      .then(d => { if (alive) { setData(d); setError(null); } })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [days]);

  const changes = useMemo(() => (data?.changes ?? [])
    .filter(c => !newsOnly || c.isNews)
    .map(c => ({ ...c, ...headlineVersions(c.versions) }))
    .filter(c => c.distinct.length > 1), [data, newsOnly]);
  const brief = useMemo(() => (data?.shortLived ?? []).filter(c => !newsOnly || c.isNews), [data, newsOnly]);

  return (
    <section className="edits">
      <p className="lede">
        כותרות שהעמוד הראשי שינה בזמן שהכתבה נשארה בו, וכתבות שהוצבו בראש העמוד ונעלמו ממנו עד הסריקה הבאה.
        שינוי כותרת יכול להיות עדכון, תיקון או מסגור מחדש — כאן מוצג רק מה השתנה ומתי.
      </p>

      <div className="filter">
        <div className="filter__row">
          {RANGES.map(d => (
            <button key={d} className={`chip${days === d ? ' chip--on' : ''}`} onClick={() => setDays(d)}>
              {d === 1 ? 'יממה' : d === 7 ? 'שבוע' : `${d} ימים`}
            </button>
          ))}
          <button className={`chip${newsOnly ? ' chip--on' : ''}`} onClick={() => setNewsOnly(n => !n)} aria-pressed={newsOnly}>
            חדשות בלבד
          </button>
        </div>
      </div>

      {error && <div className="notice"><p className="notice__lead">לא הצלחנו לטעון את השינויים.</p><p>{error}</p></div>}

      {data && (
        <>
          <h3 className="block__title">כותרות ששונו <span className="tab__count">{changes.length}</span></h3>
          {changes.length === 0 && <p className="notice">לא נרשמו שינויי כותרת בטווח הזה.</p>}
          <div className="changes">
            {changes.map(c => (
              <article key={c.url} className="change" style={{ '--brand': sourceColor(c.source) } as React.CSSProperties}>
                <header className="change__head">
                  <span className="version__source"><OutletLogo source={c.source} size={14} />{sourceName(c.source)}</span>
                  <span className={`slot slot--${c.bestSlot}`}>{SLOT_LABEL[c.bestSlot]}</span>
                  {c.alternating && <span className="tag" title="הכותרות חזרו והתחלפו ביניהן — ייתכן שהאתר בודק כמה נוסחים במקביל">מתחלפות</span>}
                  <a className="change__link" href={c.url} target="_blank" rel="noopener noreferrer">לכתבה</a>
                </header>
                <ol className="change__versions">
                  {c.distinct.map((v, i) => (
                    <li key={i}>
                      <time className="missed__when">{stamp(v.at)}</time>
                      {c.alternating || i === c.distinct.length - 1 ? <q>{v.title}</q> : <del><q>{v.title}</q></del>}
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>

          <h3 className="block__title edits__second">הוצבו בראש העמוד וירדו תוך שעה <span className="tab__count">{brief.length}</span></h3>
          {brief.length === 0 && <p className="notice">אין כאלה בטווח הזה.</p>}
          <ul className="brieflist">
            {brief.map(b => (
              <li key={b.url}>
                <span className="version__source"><OutletLogo source={b.source} size={14} />{sourceName(b.source)}</span>
                <time className="missed__when">{stamp(b.firstSeen)}</time>
                <span className={`slot slot--${b.bestSlot}`}>{SLOT_LABEL[b.bestSlot]}</span>
                <a href={b.url} target="_blank" rel="noopener noreferrer">{b.title}</a>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

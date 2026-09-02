import { useState } from 'react';
import type { SourceId } from '@/types';
import type { HistoryEvent, OutletCoverage } from '@/lib/history';
import { sourceColor, sourceName } from '@/lib/sources';
import { stamp } from '@/lib/time';
import { OutletLogo } from './OutletLogo';

const PAGE = 40;

/**
 * Every shared event from every kept run, against every outlet. A filled dot
 * is an article; an empty one is its absence. Below, what each outlet did not
 * run among the events three or more others did.
 */
export function Coverage({ events, coverage, outlets }: {
  events: HistoryEvent[];
  coverage: OutletCoverage[];
  outlets: SourceId[];
}) {
  const [limit, setLimit] = useState(PAGE);
  const [openMissed, setOpenMissed] = useState<SourceId | null>(null);

  if (events.length === 0) {
    return (
      <div className="notice">
        <p className="notice__lead">עדיין אין היסטוריה.</p>
        <p>טבלת הכיסוי מצטברת מכל איסוף. אחרי כמה איסופים תראה כאן מי דיווח על מה.</p>
      </div>
    );
  }

  return (
    <section className="coverage">
      <p className="lede">
        {events.length} אירועים משותפים מכל האיסופים שנשמרו. רק אירועים ששני אתרים ומעלה דיווחו עליהם
        נכנסים לכאן, ולכן אירוע שאתר אחד בלבד פרסם לא מופיע.
      </p>

      <div className="missed">
        {coverage.map(c => (
          <button
            key={c.source}
            className={`missed__card${openMissed === c.source ? ' missed__card--on' : ''}`}
            style={{ '--brand': sourceColor(c.source) } as React.CSSProperties}
            onClick={() => setOpenMissed(o => (o === c.source ? null : c.source))}
            aria-expanded={openMissed === c.source}
          >
            <span className="version__source">
              <OutletLogo source={c.source} size={16} />
              {sourceName(c.source)}
            </span>
            <span className="missed__nums">
              <span><b>{c.covered}</b> דיווח</span>
              <span><b>{c.missed.length}</b> לא דיווח <small>מתוך אירועים שדווחו ב-3+ אתרים</small></span>
            </span>
          </button>
        ))}
      </div>

      {openMissed && (
        <div className="missed__list">
          <h3 className="block__title">
            אירועים שדווחו בשלושה אתרים ומעלה ולא ב{sourceName(openMissed)}
          </h3>
          <ul>
            {coverage.find(c => c.source === openMissed)!.missed.map(e => (
              <li key={e.id}>
                <span className="missed__when">{stamp(e.reportedAt)}</span>
                <span>{e.headline}</span>
                <span className="missed__by">
                  {e.sources.map(s => <OutletLogo key={s} source={s} size={14} />)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="matrix-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col" className="matrix__eventhead">אירוע</th>
              {outlets.map(s => (
                <th key={s} scope="col" className="matrix__outlet" title={sourceName(s)}>
                  <OutletLogo source={s} size={16} />
                  <span className="sr-only">{sourceName(s)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.slice(0, limit).map(e => (
              <tr key={e.id}>
                <th scope="row" className="matrix__event">
                  <span className="matrix__when">{stamp(e.reportedAt)}</span>
                  <span className="matrix__headline">{e.headline}</span>
                </th>
                {outlets.map(s => {
                  const has = e.sources.includes(s);
                  return (
                    <td key={s} className="grid__cell">
                      <span className={has ? 'dot dot--yes' : 'dot'} style={has ? { background: sourceColor(s) } : undefined} />
                      <span className="sr-only">{has ? 'דיווח' : 'לא דיווח'}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {limit < events.length && (
        <button className="more" onClick={() => setLimit(l => l + PAGE)}>
          הצג עוד {Math.min(PAGE, events.length - limit)} אירועים
        </button>
      )}
    </section>
  );
}

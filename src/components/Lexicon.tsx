import { useMemo, useState } from 'react';
import type { LexiconEntry } from '@/lib/history';
import { sourceColor, sourceName } from '@/lib/sources';
import { OutletLogo } from './OutletLogo';

/**
 * Every "same thing, different words" row from every kept run, folded by the
 * thing being named. The count next to a term is how many events that outlet
 * used it in. Nothing here says which term is right.
 */
export function Lexicon({ entries, runs }: { entries: LexiconEntry[]; runs: number }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const needle = q.trim();
    if (!needle) return entries;
    return entries.filter(e =>
      e.concept.includes(needle) || e.byOutlet.some(o => o.terms.some(t => t.term.includes(needle)))
    );
  }, [entries, q]);

  if (entries.length === 0) {
    return (
      <div className="notice">
        <p className="notice__lead">המילון עדיין ריק.</p>
        <p>הוא מצטבר מכל איסוף: בכל פעם שאתרים קוראים לאותו דבר בשמות שונים, זה נרשם כאן.</p>
      </div>
    );
  }

  return (
    <section className="lexicon">
      <p className="lede">
        אותו אדם, מעשה או מקום, כפי שכל אתר כינה אותו — מצטבר מ-{runs} איסופים.
        המספר ליד ניסוח הוא מספר האירועים שבהם האתר השתמש בו.
      </p>
      <input
        className="search"
        type="search"
        placeholder="חיפוש מושג או ניסוח"
        value={q}
        onChange={e => setQ(e.target.value)}
        aria-label="חיפוש במילון"
      />
      <div className="lexicon__list">
        {shown.map(e => (
          <article key={e.concept} className="entry">
            <header className="entry__head">
              <h3 className="entry__concept">{e.concept}</h3>
              <span className="entry__count">{e.events === 1 ? 'אירוע אחד' : `${e.events} אירועים`}</span>
            </header>
            <ul className="entry__outlets">
              {e.byOutlet.map(o => (
                <li key={o.source} className="entry__outlet" style={{ '--brand': sourceColor(o.source) } as React.CSSProperties}>
                  <span className="version__source">
                    <OutletLogo source={o.source} size={15} />
                    {sourceName(o.source)}
                  </span>
                  <span className="entry__terms">
                    {o.terms.map(t => (
                      <q key={t.term} className="term">
                        {t.term}{t.count > 1 && <sup className="term__count">{t.count}</sup>}
                      </q>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
        {shown.length === 0 && <p className="notice">אין מושג או ניסוח שמתאים לחיפוש.</p>}
      </div>
    </section>
  );
}

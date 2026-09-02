import type { OutletDigest } from '@/types';
import { sourceColor, sourceName } from '@/lib/sources';
import { OutletLogo } from './OutletLogo';

/**
 * What each site published across the whole sweep — including everything no
 * other site ran. Sites appear alphabetically and are never compared here;
 * each paragraph stands on its own.
 */
export function Digest({ entries }: { entries?: OutletDigest[] }) {
  if (!entries?.length) return null;

  return (
    <section className="digest">
      <h2 className="digest__title">מה כל אתר פרסם</h2>
      <p className="digest__lede">
        סיכום של כלל הכתבות שנאספו מכל אתר, כולל אלה שאף אתר אחר לא דיווח עליהן.
      </p>

      <div className="digest__grid">
        {entries.map(e => (
          <article
            key={e.source}
            className="brief"
            style={{ '--brand': sourceColor(e.source) } as React.CSSProperties}
          >
            <header className="brief__head">
              <OutletLogo source={e.source} size={20} />
              <span className="brief__name">{sourceName(e.source)}</span>
              <span className="brief__count">{e.articleCount} כתבות</span>
            </header>
            <p className="brief__text">{e.summary}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

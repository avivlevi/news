import type { FactRow, SourceId } from '@/types';
import { alphabetical, sourceName } from '@/lib/sources';
import { OutletLogo } from './OutletLogo';

/**
 * Each claim carries the marks of the sites whose article contains it. Sites
 * that don't are still shown, faded — absence is half the information, and
 * dropping them would leave you counting logos to work out who was missing.
 * A faded mark states only that the claim isn't in that article.
 */
export function FactList({ facts, sources }: { facts: FactRow[]; sources: SourceId[] }) {
  if (facts.length === 0) return null;
  const all = [...sources].sort(alphabetical);

  return (
    <ul className="facts">
      {facts.map((f, i) => (
        <li key={i} className="fact">
          <p className="fact__claim">{f.claim}</p>
          <ul className="fact__marks">
            {all.map(s => {
              const has = f.reportedBy.includes(s);
              return (
                <li
                  key={s}
                  className={has ? 'mark mark--yes' : 'mark mark--no'}
                  title={`${sourceName(s)} — ${has ? 'מופיע' : 'לא מופיע'}`}
                >
                  <OutletLogo source={s} size={18} />
                  <span className="mark__name">{sourceName(s)}</span>
                  <span className="sr-only">{has ? 'מופיע' : 'לא מופיע'}</span>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

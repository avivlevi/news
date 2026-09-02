import type { Contradiction } from '@/types';
import { alphabetical, sourceColor, sourceName } from '@/lib/sources';
import { OutletLogo } from './OutletLogo';

/** Statements that cannot both be true — kept apart from mere omissions. */
export function Contradictions({ items }: { items: Contradiction[] }) {
  if (items.length === 0) return null;

  return (
    <div className="clash-list">
      {items.map((c, i) => (
        <div key={i} className="clash">
          <h4 className="clash__about">{c.about}</h4>
          <ul className="clash__versions">
            {[...c.versions].sort((a, b) => alphabetical(a.source, b.source)).map(v => (
              <li
                key={v.source}
                style={{ '--brand': sourceColor(v.source) } as React.CSSProperties}
              >
                <span className="clash__source">
                  <OutletLogo source={v.source} size={16} />
                  {sourceName(v.source)}
                </span>
                <span className="clash__claim">{v.claim}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

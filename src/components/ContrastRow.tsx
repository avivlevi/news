import type { TermContrast } from '@/types';
import { alphabetical, sourceColor, sourceName } from '@/lib/sources';
import { OutletLogo } from './OutletLogo';

/** The same thing, named differently. No claim about which naming is right. */
export function ContrastRow({ contrast }: { contrast: TermContrast }) {
  const variants = [...contrast.variants].sort((a, b) => alphabetical(a.source, b.source));

  return (
    <div className="contrast">
      <h4 className="contrast__concept">{contrast.concept}</h4>
      <ul className="contrast__variants">
        {variants.map(v => (
          <li
            key={v.source}
            className="variant"
            style={{ '--brand': sourceColor(v.source) } as React.CSSProperties}
          >
            <span className="variant__source">
              <OutletLogo source={v.source} size={16} />
              {sourceName(v.source)}
            </span>
            <q className="variant__term">{v.term}</q>
          </li>
        ))}
      </ul>
    </div>
  );
}

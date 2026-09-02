import type { TermContrast } from '@/types';
import { alphabetical, sourceColor, sourceName } from '@/lib/sources';
import { OutletLogo } from './OutletLogo';

/** The same thing, named differently. No claim about which naming is right. */
export function ContrastRow({ contrast }: { contrast: TermContrast }) {
  const variants = [...contrast.variants].sort((a, b) => alphabetical(a.source, b.source));
  return (
    <div className="contrast">
      <h4 className="contrast__concept">{contrast.concept}</h4>
      <ul className="versions">
        {variants.map(v => (
          <li key={v.source} className="version" style={{ '--brand': sourceColor(v.source) } as React.CSSProperties}>
            <span className="version__source">
              <OutletLogo source={v.source} size={15} />
              {sourceName(v.source)}
            </span>
            <q className="version__text version__text--quote">{v.term}</q>
          </li>
        ))}
      </ul>
    </div>
  );
}

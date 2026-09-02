import type { FactRow, SourceId } from '@/types';
import { alphabetical, sourceColor, sourceName } from '@/lib/sources';
import { OutletLogo } from './OutletLogo';

/**
 * Claims down the side, outlets across the top, a filled dot where the claim
 * appears in that outlet's article. An empty dot states only that the claim
 * isn't in that article — nothing about why.
 */
export function FactGrid({ facts, sources }: { facts: FactRow[]; sources: SourceId[] }) {
  if (facts.length === 0) return null;
  const all = [...sources].sort(alphabetical);

  return (
    <table className="grid" style={{ '--cols': all.length } as React.CSSProperties}>
      <thead>
        <tr>
          <th className="grid__claimhead" scope="col"><span className="sr-only">טענה</span></th>
          {all.map(s => (
            <th key={s} scope="col" className="grid__outlet" title={sourceName(s)}>
              <OutletLogo source={s} size={16} />
              <span className="sr-only">{sourceName(s)}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {facts.map((f, i) => (
          <tr key={i} className="grid__row">
            <th scope="row" className="grid__claim">{f.claim}</th>
            {all.map(s => {
              const has = f.reportedBy.includes(s);
              return (
                <td key={s} className="grid__cell">
                  <span
                    className={has ? 'dot dot--yes' : 'dot'}
                    style={has ? { background: sourceColor(s) } : undefined}
                    title={`${sourceName(s)} — ${has ? 'מופיע' : 'לא מופיע'}`}
                  />
                  <span className="sr-only">{has ? 'מופיע' : 'לא מופיע'}</span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

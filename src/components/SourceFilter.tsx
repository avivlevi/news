import type { SourceId } from '@/types';
import { sourceColor, sourceName } from '@/lib/sources';
import { OutletLogo } from './OutletLogo';

interface Props {
  /** Sites that appear anywhere in the current data, alphabetical. */
  available: SourceId[];
  /** Empty means no filter — every site is shown. */
  selected: Set<SourceId>;
  onToggle: (id: SourceId) => void;
  onClear: () => void;
  shown: number;
  total: number;
  unit?: string;
}

export function SourceFilter({ available, selected, onToggle, onClear, shown, total, unit = 'אירועים' }: Props) {
  const filtering = selected.size > 0;
  return (
    <section className="filter" aria-label="סינון לפי אתר">
      <div className="filter__row">
        <button
          className={`chip${filtering ? '' : ' chip--on'}`}
          onClick={onClear}
          aria-pressed={!filtering}
        >
          הכל
        </button>
        {available.map(id => {
          const on = selected.has(id);
          return (
            <button
              key={id}
              className={`chip${on ? ' chip--on' : ''}`}
              onClick={() => onToggle(id)}
              aria-pressed={on}
              style={{ '--brand': sourceColor(id) } as React.CSSProperties}
            >
              <OutletLogo source={id} size={16} />
              {sourceName(id)}
            </button>
          );
        })}
      </div>
      <p className="filter__count" role="status">
        {filtering ? `${shown} מתוך ${total} ${unit}` : `${total} ${unit}`}
        {selected.size > 1 && unit === 'אירועים' && (
          <span className="filter__hint"> · רק אירועים שכל האתרים שנבחרו דיווחו עליהם</span>
        )}
      </p>
    </section>
  );
}

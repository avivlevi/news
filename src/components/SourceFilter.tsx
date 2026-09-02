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
}

export function SourceFilter({ available, selected, onToggle, onClear, shown, total }: Props) {
  const filtering = selected.size > 0;

  return (
    <section className="filter" aria-label="סינון לפי אתר">
      <div className="filter__row">
        <button
          className={`chip-toggle${filtering ? '' : ' chip-toggle--on'}`}
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
              className={`chip-toggle${on ? ' chip-toggle--on' : ''}`}
              onClick={() => onToggle(id)}
              aria-pressed={on}
              style={{ '--brand': sourceColor(id) } as React.CSSProperties}
            >
              <OutletLogo source={id} size={17} />
              {sourceName(id)}
            </button>
          );
        })}
      </div>

      <p className="filter__count" role="status">
        {filtering ? `${shown} מתוך ${total} אירועים` : `${total} אירועים`}
      </p>
    </section>
  );
}

import type { OutletTake } from '@/types';
import { sourceColor, sourceName } from '@/lib/sources';
import { stamp } from '@/lib/time';
import { OutletLogo } from './OutletLogo';

/** One outlet's article, in its own words. Nothing here is our sentence. */
export function TakePanel({ take }: { take: OutletTake }) {
  return (
    <article className="take" style={{ '--brand': sourceColor(take.source) } as React.CSSProperties}>
      <header className="take__head">
        <span className="take__source">
          <OutletLogo source={take.source} size={22} />
          {sourceName(take.source)}
        </span>
        <time className="take__time">{stamp(take.publishedAt)}</time>
      </header>

      {take.imageUrl && (
        <img className="take__image" src={take.imageUrl} alt="" loading="lazy" />
      )}

      <a className="take__headline" href={take.url} target="_blank" rel="noopener noreferrer">
        {take.title}
      </a>

      {take.lede && <p className="take__lede">{take.lede}</p>}

      {take.approach && (
        <p className="take__approach">
          <span className="take__approachkey">מבנה הכתבה</span>
          {take.approach}
        </p>
      )}

      {(take.characterisations?.length ?? 0) > 0 && (
        <ul className="take__quotes">
          {take.characterisations!.map((q, i) => (
            <li key={i}><q>{q}</q></li>
          ))}
        </ul>
      )}

      {(take.voices?.length ?? 0) > 0 && (
        <p className="take__voices">
          <span className="take__voiceskey">מצוטטים</span>
          {take.voices!.join(' · ')}
        </p>
      )}
    </article>
  );
}

import type { OutletTake } from '@/types';
import { sourceColor, sourceName } from '@/lib/sources';
import { stamp } from '@/lib/time';
import { OutletLogo } from './OutletLogo';

/** One outlet's article, in its own words. Nothing here is our sentence. */
export function TakePanel({ take }: { take: OutletTake }) {
  const blurb = take.bodyRead === 'blurb';
  return (
    <article className="take" style={{ '--brand': sourceColor(take.source) } as React.CSSProperties}>
      <header className="take__head">
        <span className="take__source">
          <OutletLogo source={take.source} size={20} />
          {sourceName(take.source)}
        </span>
        <time className="take__time">{stamp(take.publishedAt)}</time>
      </header>

      {take.imageUrl && <img className="take__image" src={take.imageUrl} alt="" loading="lazy" />}

      <a className="take__headline" href={take.url} target="_blank" rel="noopener noreferrer">
        {take.title}
      </a>

      {take.lede && <p className="take__lede">{take.lede}</p>}

      {blurb && (
        <p className="take__blurbnote">
          רק תקציר הפיד נקרא לכתבה זו. לא ניתן להסיק ממנה מה הכתבה המלאה מכילה או משמיטה.
        </p>
      )}

      {take.approach && (
        <p className="take__approach">
          <span className="key">מבנה הכתבה</span>
          {take.approach}
        </p>
      )}

      {(take.characterisations?.length ?? 0) > 0 && (
        <ul className="take__quotes">
          {take.characterisations.map((q, i) => <li key={i}><q>{q}</q></li>)}
        </ul>
      )}

      {(take.voices?.length ?? 0) > 0 && (
        <p className="take__voices">
          <span className="key">מצוטטים</span>
          {take.voices.join(' · ')}
        </p>
      )}
    </article>
  );
}

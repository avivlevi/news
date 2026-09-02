import { useId, useState } from 'react';
import type { Story } from '@/types';
import { alphabetical, sourceColor, sourceName, TOTAL_SOURCES } from '@/lib/sources';
import { span } from '@/lib/time';
import { ContrastRow } from './ContrastRow';
import { Contradictions } from './Contradictions';
import { FactList } from './FactList';
import { TakePanel } from './TakePanel';
import { OutletLogo } from './OutletLogo';

export function StoryCard({ story }: { story: Story }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  // Tolerate payloads written by an earlier schema rather than crashing on them.
  const contradictions = story.contradictions ?? [];
  const differingFacts = story.differingFacts ?? [];
  const contrasts = story.contrasts ?? [];

  const takes = [...new Map((story.takes ?? []).map(t => [t.source, t])).values()]
    .sort((a, b) => alphabetical(a.source, b.source));
  if (takes.length === 0) return null;
  const when = span(takes.map(t => t.publishedAt));

  return (
    <section className="story">
      <div className="story__top">
        <span className="coverage">
          {takes.length} מתוך {TOTAL_SOURCES} אתרים
        </span>
        {when && <time className="story__when">{when}</time>}
      </div>

      <h2 className="story__headline">{story.headline}</h2>
      <p className="story__agreed">{story.agreed}</p>

      {/* Headlines are where framing shows first, so they are the card, not a detail. */}
      <ul className="heads">
        {takes.map(t => (
          <li key={t.source} style={{ '--brand': sourceColor(t.source) } as React.CSSProperties}>
            <a className="heads__item" href={t.url} target="_blank" rel="noopener noreferrer">
              <span className="heads__source">
                <OutletLogo source={t.source} size={16} />
                {sourceName(t.source)}
              </span>
              <span className="heads__title">{t.title}</span>
            </a>
          </li>
        ))}
      </ul>

      <button
        className="story__toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        {open ? 'סגור' : 'הצג את ההבדלים'}
      </button>

      {open && (
        <div className="story__panel" id={panelId}>
          {contradictions.length > 0 && (
            <div className="panel__block">
              <h3 className="panel__title">האתרים סותרים זה את זה</h3>
              <Contradictions items={contradictions} />
            </div>
          )}

          {differingFacts.length > 0 && (
            <div className="panel__block">
              <h3 className="panel__title">מה מופיע היכן</h3>
              <FactList facts={differingFacts} sources={takes.map(t => t.source)} />
            </div>
          )}

          {contrasts.length > 0 && (
            <div className="panel__block">
              <h3 className="panel__title">אותו דבר, במילים שונות</h3>
              <div className="contrasts">
                {contrasts.map((c, i) => <ContrastRow key={i} contrast={c} />)}
              </div>
            </div>
          )}

          <div className="panel__block">
            <h3 className="panel__title">הכתבות עצמן</h3>
            <div className="takes">
              {takes.map(t => <TakePanel key={t.source} take={t} />)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

import { useId, useState } from 'react';
import type { Story } from '@/types';
import { alphabetical, TOTAL_SOURCES } from '@/lib/sources';
import { span } from '@/lib/time';
import { OutletStrip } from './OutletStrip';
import { FactGrid } from './FactGrid';
import { ContrastRow } from './ContrastRow';
import { Contradictions } from './Contradictions';
import { TakePanel } from './TakePanel';

/** How many differing facts the card shows before you open it. */
const PREVIEW_FACTS = 5;

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
  const sources = takes.map(t => t.source);
  const when = span(takes.map(t => t.publishedAt));
  const hiddenFacts = Math.max(0, differingFacts.length - PREVIEW_FACTS);

  return (
    <article className={`story${open ? ' story--open' : ''}`}>
      <header className="story__head">
        <div className="story__meta">
          <span className="coverage">
            <b>{takes.length}</b> מתוך {TOTAL_SOURCES} אתרים
          </span>
          {when && <time className="story__when">{when}</time>}
          {contradictions.length > 0 && (
            <span className="clash-badge">
              {contradictions.length === 1 ? 'סתירה אחת' : `${contradictions.length} סתירות`}
            </span>
          )}
        </div>
        <h2 className="story__headline">{story.headline}</h2>
        {story.agreed && <p className="story__agreed">{story.agreed}</p>}
      </header>

      <OutletStrip takes={takes} />

      {differingFacts.length > 0 && (
        <section className="story__facts" aria-label="מה מופיע היכן">
          <FactGrid
            facts={open ? differingFacts : differingFacts.slice(0, PREVIEW_FACTS)}
            sources={sources}
          />
          {!open && hiddenFacts > 0 && (
            <p className="story__more">ועוד {hiddenFacts} טענות שנבדלות</p>
          )}
        </section>
      )}

      <button
        className="story__toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        {open ? 'סגור' : 'הכתבות עצמן, סתירות וניסוחים'}
      </button>

      {open && (
        <div className="story__panel" id={panelId}>
          {contradictions.length > 0 && (
            <section className="block">
              <h3 className="block__title">האתרים סותרים זה את זה</h3>
              <Contradictions items={contradictions} />
            </section>
          )}

          {contrasts.length > 0 && (
            <section className="block">
              <h3 className="block__title">אותו דבר, במילים שונות</h3>
              <div className="contrasts">
                {contrasts.map((c, i) => <ContrastRow key={i} contrast={c} />)}
              </div>
            </section>
          )}

          <section className="block">
            <h3 className="block__title">הכתבות עצמן</h3>
            <div className="takes">
              {takes.map(t => <TakePanel key={t.source} take={t} />)}
            </div>
          </section>
        </div>
      )}
    </article>
  );
}

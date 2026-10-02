import { useMemo, useState } from 'react';
import type { OutletTake, SourceId, Story } from '@/types';
import { ORDERED_SOURCES, PARTIAL_FRONT, alphabetical, notOnFront, sourceColor, sourceName } from '@/lib/sources';
import { hasFrontRecord, SLOT_LABEL } from '@/lib/exposure';
import { span } from '@/lib/time';
import { OutletLogo } from './OutletLogo';

/** Lead or top block: what a reader opening the page sees first. */
const prominent = (t?: OutletTake) => t?.exposure?.bestSlot === 'lead' || t?.exposure?.bestSlot === 'top';

interface Row { story: Story; others: OutletTake[]; own?: OutletTake }

/**
 * One outlet's reader, against everyone else, over the events of one run.
 * Three lists, all counted from the record: events the outlet didn't run;
 * events it ran but not at the top while others put them there; and the
 * reverse. Nothing here says which choice was right.
 */
function split(stories: Story[], source: SourceId) {
  const missed: Row[] = [], buried: Row[] = [], raised: Row[] = [];
  let front = false;
  for (const story of stories) {
    const own = story.takes.find(t => t.source === source);
    const others = story.takes.filter(t => t.source !== source).sort((a, b) => alphabetical(a.source, b.source));
    if (hasFrontRecord(story.takes)) front = true;
    const othersTop = others.filter(prominent).length;
    if (!own) {
      if (others.length >= 2) missed.push({ story, others });
      continue;
    }
    if (!hasFrontRecord(story.takes)) continue;
    // Absent from a front page we only see the top of is unknown, not buried.
    const known = !!own.exposure || !PARTIAL_FRONT.has(source);
    if (!prominent(own) && othersTop >= 2 && known) buried.push({ story, others, own });
    else if (prominent(own) && othersTop === 0 && others.length >= 1) raised.push({ story, others, own });
  }
  const byReach = (a: Row, b: Row) => b.others.length - a.others.length || b.story.reportedAt.localeCompare(a.story.reportedAt);
  return { missed: missed.sort(byReach), buried: buried.sort(byReach), raised: raised.sort(byReach), front };
}

function Where({ take }: { take?: OutletTake }) {
  if (!take) return <span className="where where--none">לא דיווח</span>;
  if (!take.exposure) return <span className="where where--none">{notOnFront(take.source)} בעמוד הראשי</span>;
  return (
    <span className={`where slot--${take.exposure.bestSlot}`}>
      {SLOT_LABEL[take.exposure.bestSlot]} · מקום {take.exposure.bestPosition}
    </span>
  );
}

function List({ title, note, rows, source }: { title: string; note: string; rows: Row[]; source: SourceId }) {
  if (rows.length === 0) return null;
  return (
    <section className="bubble__list">
      <h3 className="block__title">{title} <span className="tab__count">{rows.length}</span></h3>
      <p className="bubble__note">{note}</p>
      <ul>
        {rows.map(({ story, others, own }) => (
          <li key={story.id} className="bubble__item">
            <div className="bubble__head">
              <time className="missed__when">{span(story.takes.map(t => t.publishedAt))}</time>
              <span className="bubble__headline">{story.headline}</span>
            </div>
            <div className="bubble__where">
              <span className="bubble__outlet bubble__outlet--self" style={{ '--brand': sourceColor(source) } as React.CSSProperties}>
                <OutletLogo source={source} size={14} />{sourceName(source)}: <Where take={own} />
              </span>
              {others.map(t => (
                <span key={t.source} className="bubble__outlet">
                  <OutletLogo source={t.source} size={14} />{sourceName(t.source)}: <Where take={t} />
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Bubble({ stories }: { stories: Story[] }) {
  const [source, setSource] = useState<SourceId>(ORDERED_SOURCES[0]);
  const { missed, buried, raised, front } = useMemo(() => split(stories, source), [stories, source]);
  const name = sourceName(source);

  return (
    <section className="bubble">
      <p className="lede">
        בחר אתר. כך נראו האירועים המשותפים של האיסוף הזה למי שקרא רק אותו: מה לא הופיע בו,
        מה הופיע אצלו בשוליים בזמן שאחרים הציבו אותו בראש העמוד, ומה הוא הבליט כשאחרים לא.
      </p>

      <div className="filter">
        <div className="filter__row">
          {ORDERED_SOURCES.map(s => (
            <button
              key={s}
              className={`chip${s === source ? ' chip--on' : ''}`}
              style={{ '--brand': sourceColor(s) } as React.CSSProperties}
              onClick={() => setSource(s)}
            >
              <OutletLogo source={s} size={14} />{sourceName(s)}
            </button>
          ))}
        </div>
      </div>

      <dl className="ledger bubble__ledger">
        <div className="ledger__cell"><dd>{missed.length}</dd><dt>אירועים שאחרים דיווחו ו{name} לא</dt></div>
        {front && <div className="ledger__cell"><dd>{buried.length}</dd><dt>בראש העמוד אצל אחרים, לא אצל {name}</dt></div>}
        {front && <div className="ledger__cell"><dd>{raised.length}</dd><dt>בראש העמוד אצל {name} בלבד</dt></div>}
      </dl>

      {!front && (
        <p className="notice">לאיסוף הזה אין נתוני עמוד ראשי, ולכן מוצגים רק אירועים שלא דווחו. בחר איסוף חדש יותר.</p>
      )}

      <List
        source={source}
        title={`לא הופיע ב${name}`}
        note="אירועים ששני אתרים אחרים או יותר דיווחו עליהם באיסוף הזה. ייתכן שהאתר דיווח עליהם מחוץ לחלון האיסוף."
        rows={missed}
      />
      <List
        source={source}
        title={`הופיע ב${name}, אבל לא בראש העמוד`}
        note="לפחות שני אתרים הציבו את האירוע בכותרת הראשית או בבלוק העליון."
        rows={buried}
      />
      <List
        source={source}
        title={`בראש העמוד ב${name} בלבד`}
        note="האתר הציב את האירוע בכותרת הראשית או בבלוק העליון, ואף אתר אחר שדיווח עליו לא עשה זאת."
        rows={raised}
      />
    </section>
  );
}

import type { OutletTake } from '@/types';
import { notOnFront, sourceColor, sourceName } from '@/lib/sources';
import { hasFrontRecord, lagMinutes, lagText, onPage, retitles, SLOT_LABEL } from '@/lib/exposure';
import { OutletLogo } from './OutletLogo';

const FORM: Record<NonNullable<OutletTake['headlineForm']>, string> = {
  active: 'פעיל',
  passive: 'סביל',
  nominal: 'שמני',
};

/**
 * One column per outlet: its headline, what it opened with, who acts in the
 * headline, how long it is, who it quoted, and where its front page put it.
 * The angle, without opening anything. Everything here is quoted or counted;
 * nothing is our judgement.
 */
export function OutletStrip({ takes }: { takes: OutletTake[] }) {
  const front = hasFrontRecord(takes);
  return (
    <div className="strip" style={{ '--cols': takes.length } as React.CSSProperties}>
      {takes.map(t => {
        const blurb = t.bodyRead === 'blurb' || (!t.bodyRead && !t.wordCount);
        return (
          <div key={t.source} className="col" style={{ '--brand': sourceColor(t.source) } as React.CSSProperties}>
            <a className="col__head" href={t.url} target="_blank" rel="noopener noreferrer">
              <span className="col__source">
                <OutletLogo source={t.source} size={16} />
                {sourceName(t.source)}
              </span>
              <span className="col__title">{t.title}</span>
            </a>

            <dl className="col__angle">
              {t.leadsWith && (
                <div className="angle">
                  <dt>פותח ב</dt>
                  <dd>{t.leadsWith}</dd>
                </div>
              )}
              {t.headlineActor && (
                <div className="angle">
                  <dt>הפועל בכותרת</dt>
                  <dd>
                    {t.headlineActor}
                    {t.headlineForm && <span className="angle__form">{FORM[t.headlineForm]}</span>}
                  </dd>
                </div>
              )}
              {front && <FrontAngle take={t} takes={takes} />}
              <div className="angle angle--nums">
                <dd className={blurb ? 'num num--blurb' : 'num'} title={blurb ? 'רק תקציר הפיד נקרא' : undefined}>
                  {blurb ? 'תקציר בלבד' : <><b>{t.wordCount}</b> מילים</>}
                </dd>
                <dd className="num">
                  <b>{t.voices?.length ?? 0}</b> מצוטטים
                </dd>
              </div>
            </dl>
          </div>
        );
      })}
    </div>
  );
}

/** Where the outlet's own front page put this article, and for how long. */
function FrontAngle({ take, takes }: { take: OutletTake; takes: OutletTake[] }) {
  const e = take.exposure;
  if (!e) {
    return (
      <div className="angle angle--front">
        <dt>בעמוד הראשי</dt>
        <dd className="front-none">{notOnFront(take.source)}</dd>
      </div>
    );
  }
  const lag = lagMinutes(take, takes);
  const changed = retitles(e);
  return (
    <div className="angle angle--front">
      <dt>בעמוד הראשי</dt>
      <dd>
        <span className={`slot slot--${e.bestSlot}`}>{SLOT_LABEL[e.bestSlot]}</span>
        <span className="front-pos">מקום {e.bestPosition}</span>
      </dd>
      <dd className="front-meta">
        {onPage(e)}{e.onFrontNow ? ' · עדיין שם' : ''}
        {lag !== null && <> · {lagText(lag)}</>}
        {changed > 0 && <> · <span className="front-retitled">הכותרת שונתה {changed === 1 ? 'פעם אחת' : `${changed} פעמים`}</span></>}
      </dd>
    </div>
  );
}

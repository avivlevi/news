import type { OutletTake } from '@/types';
import { sourceColor, sourceName } from '@/lib/sources';
import { OutletLogo } from './OutletLogo';

const FORM: Record<NonNullable<OutletTake['headlineForm']>, string> = {
  active: 'פעיל',
  passive: 'סביל',
  nominal: 'שמני',
};

/**
 * One column per outlet: its headline, what it opened with, who acts in the
 * headline, how long it is, who it quoted. The angle, without opening anything.
 * Everything here is quoted or counted; nothing is our judgement.
 */
export function OutletStrip({ takes }: { takes: OutletTake[] }) {
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

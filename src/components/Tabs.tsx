export type View = 'events' | 'digest' | 'lexicon' | 'coverage';

const TABS: { id: View; label: string; hint: string }[] = [
  { id: 'events',   label: 'אירועים',          hint: 'מה שדווח בשני אתרים ומעלה' },
  { id: 'digest',   label: 'מה כל אתר פרסם',   hint: 'כל הכתבות, גם אלה שאף אחד אחר לא הריץ' },
  { id: 'lexicon',  label: 'מילון',            hint: 'אותו דבר, במילים שונות, לאורך זמן' },
  { id: 'coverage', label: 'כיסוי',            hint: 'מי דיווח על מה, ומי לא' },
];

export function Tabs({ view, onChange, counts }: {
  view: View;
  onChange: (v: View) => void;
  counts: Record<View, number>;
}) {
  return (
    <nav className="tabs" aria-label="תצוגות">
      {TABS.map(t => (
        <button
          key={t.id}
          className={`tab${view === t.id ? ' tab--on' : ''}`}
          onClick={() => onChange(t.id)}
          aria-current={view === t.id ? 'page' : undefined}
          title={t.hint}
        >
          <span className="tab__label">{t.label}</span>
          <span className="tab__count">{counts[t.id]}</span>
        </button>
      ))}
    </nav>
  );
}

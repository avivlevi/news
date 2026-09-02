const DATE = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long' });
const TIME = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' });

const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function dayLabel(d: Date): string {
  const days = Math.round(
    (startOfDay(new Date()).getTime() - startOfDay(d).getTime()) / 86_400_000
  );
  if (days === 0) return 'היום';
  if (days === 1) return 'אתמול';
  return DATE.format(d);
}

export const clock = (iso: string) => TIME.format(new Date(iso));

/** "היום · 08:56" for a single outlet. */
export function stamp(iso: string): string {
  const d = new Date(iso);
  return `${dayLabel(d)} · ${TIME.format(d)}`;
}

/**
 * When outlets published hours apart, that lag is itself part of the story —
 * so a story shows its span rather than one timestamp.
 */
export function span(isos: string[]): string {
  const dates = isos
    .map(s => new Date(s))
    .filter(d => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length === 0) return '';
  const first = dates[0];
  const last = dates[dates.length - 1];

  if (dates.length === 1 || TIME.format(first) === TIME.format(last)) {
    return `${dayLabel(first)} · ${TIME.format(first)}`;
  }
  if (isSameDay(first, last)) {
    return `${dayLabel(first)} · ${TIME.format(first)}–${TIME.format(last)}`;
  }
  return `${dayLabel(first)} ${TIME.format(first)} – ${dayLabel(last)} ${TIME.format(last)}`;
}

/**
 * The hourly front-page job, from the terminal.
 *
 *   npm run scrape               scrape every front page and record it in Supabase
 *   npm run scrape -- --bodies   ...then read the full text of new articles
 *   npm run scrape -- --dry      scrape and print, write nothing
 *
 * Supabase credentials come from the environment or .env.
 */
import { readPendingBodies } from '../netlify/lib/bodies.js';
import { scrapeAll, scrapeAndRecord } from '../netlify/lib/scrape/index.js';

const args = process.argv.slice(2);

if (args.includes('--dry')) {
  for (const r of await scrapeAll()) {
    const bySlot = new Map<string, number>();
    for (const i of r.items) bySlot.set(i.slot, (bySlot.get(i.slot) ?? 0) + 1);
    const slots = [...bySlot].map(([k, n]) => `${k} ${n}`).join(', ');
    const news = r.items.filter(i => i.isNews).length;
    console.log(`\n${r.source}: ${r.items.length} items (${news} news; ${slots}) in ${r.ms}ms${r.error ? ` — ${r.error}` : ''}`);
    for (const i of r.items.slice(0, 5)) console.log(`  ${i.slot.padEnd(6)} ${i.title}`);
  }
} else {
  const results = await scrapeAndRecord();
  const failed = results.filter(r => r.error);
  console.log(`recorded ${results.length - failed.length}/${results.length} front pages`);
  if (args.includes('--bodies')) await readPendingBodies();
}

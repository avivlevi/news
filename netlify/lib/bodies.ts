import { mapLimit } from './concurrency.js';
import { pendingBodies, saveBody } from './db.js';
import { countWords, readArticle } from './extract.js';

/** Long enough for any news article; stops a live blog from growing without bound. */
const ARCHIVE_CHARS = 40_000;

/**
 * Read the full text of every new news article, once. Each article is read
 * near the time it appeared, so later edits to the text aren't captured — the
 * headline history covers what changes most.
 */
export async function readPendingBodies(limit = 150, hours = 48): Promise<{ read: number; failed: number }> {
  const pending = await pendingBodies(hours, limit);
  let read = 0, failed = 0;
  await mapLimit(pending, 6, async a => {
    const body = await readArticle(a.url, ARCHIVE_CHARS);
    await saveBody(a.id, body ? { text: body.text, wordCount: countWords(body.text) } : null);
    if (body) read++; else failed++;
  });
  console.log(`  bodies: ${read} read, ${failed} failed, of ${pending.length} pending`);
  return { read, failed };
}

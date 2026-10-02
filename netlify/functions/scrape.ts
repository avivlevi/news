import type { Config } from '@netlify/functions';
import { scrapeAndRecord } from '../lib/scrape/index.js';

/**
 * Every hour, record what each outlet's front page shows. Plain HTTP and
 * parsing, no model calls — a few seconds for all six. Reading the new
 * articles' full text takes longer than a scheduled function may run, so it
 * is handed to a background function.
 */
export default async () => {
  const results = await scrapeAndRecord();
  const base = process.env.URL;
  if (base) {
    await fetch(`${base}/.netlify/functions/bodies-background`, { method: 'POST' })
      .catch(e => console.warn('bodies job not started:', e));
  }
  const failed = results.filter(r => r.error).map(r => `${r.source}: ${r.error}`);
  console.log(`scrape done — ${results.length - failed.length}/${results.length} ok${failed.length ? `; ${failed.join('; ')}` : ''}`);
};

export const config: Config = { schedule: '@hourly' };

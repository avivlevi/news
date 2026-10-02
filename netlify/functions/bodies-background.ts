import { readPendingBodies } from '../lib/bodies.js';

/** Started by the hourly scrape. Reads the text of articles that just appeared. */
export default async () => {
  await readPendingBodies();
};

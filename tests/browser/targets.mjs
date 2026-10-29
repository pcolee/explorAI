// What the browser checks open in this repo. Paths are from the repo root.
import { readdirSync, existsSync } from 'node:fs';

const find = (dir, re) => existsSync(dir)
  ? readdirSync(dir, { recursive: true }).map(String).filter((f) => re.test(f)).sort().map((f) => `${dir}/${f}`)
  : [];

// Meeting decks.
export const decks = find('meetings', /^meeting-\d+\/index\.html$/);
// Speaker notes and lab pages people open on a phone.
export const pages = find('meetings', /^meeting-\d+\/(notes\.html|lab\/index\.html)$/);

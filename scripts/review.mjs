#!/usr/bin/env node
// Live deck review from the command line: the same comments and slide owners people see
// with C in a deck (review.js), for Claude Code agents and for the shared-context brief.
// Shared, identical, by rcc-gdg, rcc-acm, and pcolee/explorAI (scripts/review.mjs).
//
//   node scripts/review.mjs brief                      open comments and owners for every deck in the repo
//   node scripts/review.mjs show <deck>                one deck: who covers each slide, every open thread
//   node scripts/review.mjs add <deck> <slide> <text>  comment on a slide (slide number or id)
//   node scripts/review.mjs reply <deck> <id> <text>   reply to a comment
//   node scripts/review.mjs resolve <deck> <id> [note] mark a comment done, saying what changed
//   node scripts/review.mjs assign <deck> <slides> <name|->   give slides to someone ("3", "3-7", "3,5,9"; - clears)
//   node scripts/review.mjs bake <built.html> <deck>   write data-owner on each slide of a built deck (publish step)
//   node scripts/review.mjs login [name]               save your name and the club passcode on this machine
//
// <deck> is the deck's HTML file in this repo. The passcode lives in ~/.config/rcc-review/key and
// your name in ~/.config/rcc-review/name, never in the repo (it is public). Everything an agent
// writes is marked "agent", so people can tell it from what they typed themselves.
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

const RELAY = 'https://deck-relay-954308885597.us-west1.run.app/review/';
const CONF = join(homedir(), '.config', 'rcc-review');
const TIMEOUT = Number(process.env.REVIEW_TIMEOUT_MS) || 6000;
const root = (() => { try { return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim(); } catch { return process.cwd(); } })();
const read = (f) => { try { return readFileSync(f, 'utf8').trim(); } catch { return ''; } };
const key = () => process.env.REVIEW_KEY || read(join(CONF, 'key'));
const me = () => {
  const n = process.env.REVIEW_NAME || read(join(CONF, 'name'));
  if (n) return n;
  try { return execFileSync('git', ['config', 'user.name'], { encoding: 'utf8' }).trim().split(/[\s.]+/)[0]; } catch { return ''; }
};
const die = (m, code = 1) => { console.error('review: ' + m); process.exit(code); };

// ---------- A deck file: its review key and its slides, the way review.js sees them.
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ', rsquo: '’', lsquo: '‘', hellip: '…', middot: '·', mdash: '—', ndash: '–' };
const decode = (t) => t.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e.toLowerCase()] ?? m));
const text = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const attr = (attrs, name) => { const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(attrs); return m ? decode(m[2] ?? m[3]) : null; };
export function slug(t) {
  return String(t).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
}
export function parseDeck(file) {
  const html = readFileSync(file, 'utf8');
  const main = /<(main|div)\b([^>]*\bclass="[^"]*\bdeck\b[^"]*"[^>]*|[^>]*\bid="stage"[^>]*)>/i.exec(html);
  let id = main ? attr(main[2], 'data-deck') : null;
  const rel = relative(root, resolve(file)).split('\\').join('/');
  // ExplorAI decks get their id at run time from explorai-presenter.js: explorai-<meeting folder>.
  if (!id) { const m = /(?:^|\/)meetings\/(meeting-\d+)\/index\.html$/.exec(rel); if (m) id = 'explorai-' + m[1]; }
  if (!id) return null;
  const deck = id.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  const club = (main && attr(main[2], 'data-club')) || (/^(acm|explorai)-/.exec(deck) || [])[1] || 'gdg';
  const ledger = main && attr(main[2], 'data-ledger');
  // Each <section>: its attributes and its first heading. Slides do not nest.
  const slides = [], seen = {};
  const re = /<section\b([^>]*)>([\s\S]*?)(?=<section\b|<\/main>|<\/body>|$)/gi;
  let m;
  while ((m = re.exec(html))) {
    const a = m[1], i = slides.length;
    if (main && main[1].toLowerCase() === 'main' && !/\bclass\s*=\s*"[^"]*\bslide\b/.test(a) && !/id="stage"/.test(main[2])) continue;
    const h = /<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/i.exec(m[2]);
    const heading = h ? text(h[1]) : '';
    const aria = attr(a, 'aria-label');
    let sid = attr(a, 'data-id') || attr(a, 'id') || slug(aria || heading) || 'slide-' + (i + 1);
    sid = slug(sid) || 'slide-' + (i + 1);
    const base = sid; let n = 2; while (seen[sid]) sid = base + '-' + n++;
    seen[sid] = true;
    slides.push({ n: i + 1, id: sid, label: aria || heading || 'Slide ' + (i + 1), start: m.index, tagEnd: m.index + m[0].indexOf('>') });
  }
  return { file: rel, deck, club, ledger, slides, html };
}
function deckFiles() {
  let files = [];
  try { files = execFileSync('git', ['ls-files', '*.html'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean); } catch { /* not a repo */ }
  return files.filter((f) => !/(^|\/)(deck-kit|templates|node_modules|site)\//.test(f) && !/\.bundle\.html$/.test(f))
    .map((f) => join(root, f)).filter((f) => { const h = read(f); return /class="deck"|id="stage"/.test(h.slice(0, 200000)); });
}

// ---------- The relay.
async function call(d, body) {
  const k = key(); if (!k) die('no passcode on this machine. Run: node scripts/review.mjs login', 3);
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const r = await fetch(RELAY + d.club + '/' + d.deck, body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Review-Key': k }, body: JSON.stringify({ ...body, author: me(), via: 'agent' }), signal: ctl.signal }
      : { headers: { 'X-Review-Key': k }, signal: ctl.signal });
    if (r.status === 401) die('the passcode on this machine was refused. Run: node scripts/review.mjs login', 3);
    if (!r.ok) throw new Error(`the relay said ${r.status}: ${await r.text()}`);
    return await r.json();
  } catch (e) { if (e.name === 'AbortError') throw new Error('the review relay did not answer in time'); throw e; } finally { clearTimeout(t); }
}
function load(arg) {
  if (!arg) die('name the deck file, e.g. semesters/2026-fall/decks/2026-10-08-story-and-vibe-coding.html', 2);
  const f = resolve(arg); if (!existsSync(f)) die('no such file: ' + arg, 2);
  const d = parseDeck(f); if (!d) die(arg + ' is not a deck (no data-deck id)', 2);
  return d;
}
function slideOf(d, s) {
  const byN = /^\d+$/.test(s) ? d.slides[+s - 1] : null;
  const hit = byN || d.slides.find((x) => x.id === s);
  if (!hit) die(`no slide "${s}" in ${d.file} (it has ${d.slides.length}; give a number or a slide id)`, 2);
  return hit;
}
const ago = (iso) => { const s = (Date.now() - Date.parse(iso)) / 1000; return s < 3600 ? Math.max(1, Math.round(s / 60)) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : iso.slice(0, 10); };
const by = (x) => x.author + (x.via === 'agent' ? ' (agent)' : '');
function where(d, c) { const k = d.slides.findIndex((s) => s.id === c.slide); return k >= 0 ? `slide ${k + 1} "${d.slides[k].label}"` : `a removed or renamed slide (was "${c.label || c.slide}")`; }
function thread(d, c, pad = '  ') {
  const out = [`${pad}[${c.id}] ${where(d, c)} · ${by(c)}, ${ago(c.at)}: ${c.text.replace(/\s*\n\s*/g, ' / ')}`];
  for (const r of c.replies) out.push(`${pad}    ↳ ${by(r)}: ${r.text.replace(/\s*\n\s*/g, ' / ')}`);
  return out.join('\n');
}
function owners(d, doc) {
  const runs = []; let cur = null;
  d.slides.forEach((s, i) => {
    const o = doc.owners[s.id]?.name || '';
    if (cur && cur.o === o) cur.to = i + 1; else runs.push(cur = { o, from: i + 1, to: i + 1 });
  });
  return runs.map((r) => (r.from === r.to ? `${r.from}` : `${r.from}-${r.to}`) + ' ' + (r.o || 'unassigned')).join(', ');
}

// ---------- Commands.
const main = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
const [cmd, ...args] = main ? process.argv.slice(2) : [];
const cmds = {
  async brief() {
    if (!key()) { console.log('  (no review passcode on this machine: node scripts/review.mjs login)'); return; }
    let any = false;
    // Every deck at once, so the brief costs one round trip, not one per deck.
    const decks = deckFiles().map((f) => parseDeck(f)).filter(Boolean);
    const docs = await Promise.all(decks.map((d) => call(d).catch(() => null)));
    if (decks.length && docs.every((x) => !x)) { console.log('  (review relay unreachable)'); return; }
    for (const [k, d] of decks.entries()) {
      const doc = docs[k]; if (!doc) continue;
      const open = doc.comments.filter((c) => !c.resolved);
      const assigned = Object.keys(doc.owners).length;
      if (!open.length && !assigned) continue;
      any = true;
      console.log(`  ${d.file} (${d.slides.length} slides): ${open.length} open comment${open.length === 1 ? '' : 's'}${assigned ? '. Speakers: ' + owners(d, doc) : ''}`);
      for (const c of open.slice(-8)) console.log(thread(d, c, '    '));
      if (open.length > 8) console.log(`    ... ${open.length - 8} more: node scripts/review.mjs show ${d.file}`);
    }
    if (!any) console.log('  (no open comments or speaker labels on any deck)');
  },
  async show(file) {
    const d = load(file), doc = await call(d);
    console.log(`${d.ledger || d.file} · ${d.club}/${d.deck} · rev ${doc.rev}`);
    console.log('Speakers: ' + owners(d, doc));
    const open = doc.comments.filter((c) => !c.resolved), done = doc.comments.filter((c) => c.resolved);
    console.log(`\nOpen (${open.length}):`); open.forEach((c) => console.log(thread(d, c)));
    if (done.length) { console.log(`\nResolved (${done.length}), newest 5:`); done.slice(-5).forEach((c) => console.log(thread(d, c) + `\n      resolved by ${c.resolved.by}${c.resolved.note ? ': ' + c.resolved.note : ''}`)); }
    console.log('\nSlide ids: ' + d.slides.map((s) => s.n + '=' + s.id).join(' '));
  },
  async add(file, s, ...words) {
    const d = load(file), sl = slideOf(d, s || ''), t = words.join(' ').trim(); if (!t) die('say what the comment is', 2);
    const doc = await call(d, { op: 'comment', slide: sl.id, label: sl.label, n: sl.n, text: t });
    console.log(`Commented on slide ${sl.n} "${sl.label}" [${doc.comments.at(-1).id}]`);
  },
  async reply(file, id, ...words) {
    const d = load(file), t = words.join(' ').trim(); if (!id || !t) die('usage: reply <deck> <comment id> <text>', 2);
    await call(d, { op: 'reply', id, text: t }); console.log(`Replied to ${id}`);
  },
  async resolve(file, id, ...words) {
    const d = load(file); if (!id) die('usage: resolve <deck> <comment id> [what changed]', 2);
    await call(d, { op: 'resolve', id, text: words.join(' ').trim() }); console.log(`Resolved ${id}`);
  },
  async assign(file, spec, ...who) {
    const d = load(file), name = who.join(' ').trim(); if (!spec || !name) die('usage: assign <deck> <slides: 3 | 3-7 | 3,5,9> <name | ->', 2);
    const nums = [];
    for (const part of spec.split(',')) { const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim()); if (!m) die('slides look like 3, 3-7, or 3,5,9', 2); for (let k = +m[1]; k <= +(m[2] || m[1]); k++) nums.push(k); }
    for (const k of nums) { const sl = slideOf(d, String(k)); await call(d, { op: 'assign', slide: sl.id, label: sl.label, n: sl.n, owner: name === '-' ? '' : name }); }
    console.log(`${name === '-' ? 'Cleared' : 'Gave ' + name} slide${nums.length > 1 ? 's' : ''} ${spec}`);
  },
  async bake(built, file) {
    if (!built || !file) die('usage: bake <built.html> <source deck.html>', 2);
    const d = load(file); if (!key()) { console.log('bake: no passcode on this machine, so the published deck carries no speaker labels'); return; }
    let doc; try { doc = await call(d); } catch { console.log('bake: relay unreachable, published without speaker labels'); return; }
    let html = readFileSync(built, 'utf8'), n = 0;
    const b = parseDeck(built); if (!b || b.slides.length !== d.slides.length) die('bake: the built deck does not match its source', 2);
    // Edit from the last slide back so earlier offsets stay valid.
    for (const s of [...b.slides].reverse()) {
      const o = doc.owners[s.id]?.name; if (!o) continue;
      const tag = html.slice(s.start, s.tagEnd).replace(/\sdata-owner="[^"]*"/, '');
      html = html.slice(0, s.start) + tag + ` data-owner="${o.replace(/[&"<>]/g, (c) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c]))}"` + html.slice(s.tagEnd); n++;
    }
    writeFileSync(built, html); console.log(`bake: ${n} slide${n === 1 ? '' : 's'} carry their speaker`);
  },
  async login(name) {
    mkdirSync(CONF, { recursive: true });
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise((r) => rl.question(q, r));
    const n = (name || (await ask(`Your name as people know you (${me() || 'none'}): `)) || me()).trim();
    const k = (await ask('Club review passcode: ')).trim(); rl.close();
    if (n) writeFileSync(join(CONF, 'name'), n + '\n');
    if (k) { writeFileSync(join(CONF, 'key'), k); chmodSync(join(CONF, 'key'), 0o600); }
    console.log(`Saved in ${CONF}. Agents on this machine now comment as "${n}" (marked agent).`);
  },
};
if (!main) { /* imported: parseDeck and slug only */ }
else if (!cmds[cmd]) { console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 15).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(cmd ? 2 : 0); }
else await cmds[cmd](...args).catch((e) => die(e.message, 4));

#!/usr/bin/env node
// Live deck review for agents: the same notes, suggestions, and speakers people make in a deck (press
// A there), read and changed from the command line. Shared, identical, by rcc-gdg, rcc-acm, and
// pcolee/explorAI (scripts/review.mjs). Talks to the club relay's review API as the person whose
// agent token is on this machine; everything it writes is marked agent.
//
//   node scripts/review.mjs brief                          open notes and speakers for every deck here
//   node scripts/review.mjs inbox <deck>                   open notes, each with the source line it points at
//   node scripts/review.mjs show <deck>                    inbox, speakers, recent resolved, slide ids
//   node scripts/review.mjs claim <deck> <id> [--release]  say you are working on a note (people see it)
//   node scripts/review.mjs resolve <deck> <id> [--commit <sha>] [what changed]
//   node scripts/review.mjs reply <deck> <id> <text>
//   node scripts/review.mjs edit <deck> <id> <text>        rewrite a note; merges with anyone typing in it
//   node scripts/review.mjs reopen <deck> <id>
//   node scripts/review.mjs annotate <deck> <slide> <text> [--quote "<words on the slide>"] [--kind task|comment] [--suggest "<replacement>"]
//   node scripts/review.mjs assign <deck> <slides> <name|->  speakers: "3", "3-7", "3,5,9"; - clears
//   node scripts/review.mjs status <deck> "<what you are doing>" [--slide <n>]   live status; "" clears
//   node scripts/review.mjs watch [deck]                   one line per change, as it happens (for Monitor)
//   node scripts/review.mjs bake <built.html> <deck>       write data-owner speakers into a built deck
//   node scripts/review.mjs login                          save this machine's agent token
//
// <deck> is the deck's HTML file in this repo. The agent token comes from "Connect an agent" in a deck
// (your avatar in the review toolbar) and lives in ~/.config/rcc-review/agent-token, never in the repo.
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

const RELAY = process.env.REVIEW_RELAY || 'https://deck-relay-954308885597.us-west1.run.app';
const CONF = join(homedir(), '.config', 'rcc-review');
const TIMEOUT = Number(process.env.REVIEW_TIMEOUT_MS) || 8000;
const root = (() => { try { return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return process.cwd(); } })();
const read = (f) => { try { return readFileSync(f, 'utf8').trim(); } catch { return ''; } };
const token = () => process.env.REVIEW_TOKEN || read(join(CONF, 'agent-token'));
const die = (m, code = 1) => { console.error('review: ' + m); process.exit(code); };

// ---------- A deck file: its review key and its slides, exactly as the deck page computes them.
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
    slides.push({ n: i + 1, id: sid, label: aria || heading || 'Slide ' + (i + 1), start: m.index, end: m.index + m[0].length, tagEnd: m.index + m[0].indexOf('>') });
  }
  return { file: rel, deck, club, ledger, slides, html };
}
function deckFiles() {
  let files = [];
  try { files = execFileSync('git', ['ls-files', '*.html'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean); } catch { /* not a repo */ }
  return files.filter((f) => !/(^|\/)(deck-kit|templates|node_modules|site)\//.test(f) && !/\.bundle\.html$/.test(f))
    .map((f) => join(root, f)).filter((f) => /class="deck"|id="stage"/.test(read(f).slice(0, 200000)));
}
// The source line a note points at: its words inside its slide's markup, else the slide's first line.
const lineAt = (html, idx) => html.slice(0, idx).split('\n').length;
function sourceLine(d, a) {
  const s = d.slides.find((x) => x.id === a.slide);
  if (!s) return null;
  const chunk = d.html.slice(s.start, s.end);
  const sel = (a.target && a.target.selectors) || [];
  const words = [(a.target && a.target.text) || '', ...(sel.filter((x) => x.type === 'TextQuote').map((x) => x.exact))].map((t) => String(t).replace(/\s+/g, ' ').trim()).filter(Boolean);
  for (const w of words) {
    for (const probe of [w, w.split(' ').slice(0, 4).join(' '), w.split(' ').slice(0, 2).join(' ')]) {
      if (probe.length < 3) continue;
      // Allow markup and line breaks between the words, as the source has them.
      const re = new RegExp(probe.split(' ').map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/’/g, "(?:’|&rsquo;|')")).join('(?:\\s|<[^>]*>)+'), 'i');
      const m = re.exec(chunk);
      if (m) return { line: lineAt(d.html, s.start + m.index), exact: probe === w };
    }
  }
  return { line: lineAt(d.html, s.start), exact: false, slideOnly: true };
}

// ---------- The relay.
async function call(d, body, path = '') {
  const t = token(); if (!t) die('no agent token on this machine. In a deck: your avatar in the review toolbar, Connect an agent. Then: node scripts/review.mjs login', 3);
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const r = await fetch(`${RELAY}/api/d/${d.club}/${d.deck}${path}`, body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body), signal: ctl.signal }
      : { headers: { Authorization: 'Bearer ' + t }, signal: ctl.signal });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) die('the relay refused this machine\'s agent token. Make a new one (Connect an agent) and run: node scripts/review.mjs login', 3);
    if (!r.ok) throw new Error(j.error || `the relay said ${r.status}`);
    return j;
  } catch (e) { if (e.name === 'AbortError') throw new Error('the review relay did not answer in time'); throw e; } finally { clearTimeout(timer); }
}
function load(arg) {
  if (!arg) die('name the deck file, e.g. semesters/2026-fall/decks/2026-10-08-story-and-vibe-coding.html', 2);
  const f = resolve(arg); if (!existsSync(f)) die('no such file: ' + arg, 2);
  const d = parseDeck(f); if (!d) die(arg + ' is not a deck (no data-deck id)', 2);
  return d;
}
function slideOf(d, s) {
  const hit = /^\d+$/.test(s) ? d.slides[+s - 1] : d.slides.find((x) => x.id === s);
  if (!hit) die(`no slide "${s}" in ${d.file} (it has ${d.slides.length}; give a number or a slide id)`, 2);
  return hit;
}
function flags(args) {
  const out = { _: [] };
  for (let k = 0; k < args.length; k++) { const a = args[k]; if (a.startsWith('--')) { const key = a.slice(2); out[key] = args[k + 1] && !args[k + 1].startsWith('--') ? args[++k] : true; } else out._.push(a); }
  return out;
}
const ago = (iso) => { const s = (Date.now() - Date.parse(iso)) / 1000; return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : String(iso).slice(0, 10); };
const by = (x) => (x ? x.name + (x.via === 'agent' ? "'s agent" : '') : '?');
const one = (t) => String(t || '').replace(/\s*\n\s*/g, ' / ');
function where(d, a) { const k = d.slides.findIndex((s) => s.id === a.slide); return k >= 0 ? `slide ${k + 1} "${d.slides[k].label}"` : `a removed or renamed slide (was "${a.label || a.slide}")`; }
function describe(d, a, pad = '  ') {
  const kind = a.kind === 'comment' ? '' : a.kind === 'task' ? 'TASK ' : 'SUGGESTED EDIT ';
  const src = sourceLine(d, a);
  const lines = [`${pad}[${a.id}] ${kind}${where(d, a)}${src ? ` · ${d.file}:${src.line}${src.slideOnly ? ' (slide start)' : ''}` : ''} · ${by(a.author)}, ${ago(a.created)}`];
  if (a.target && a.target.text) lines.push(`${pad}    on: "${one(a.target.text).slice(0, 140)}"`);
  if (a.body) lines.push(`${pad}    note: ${one(a.body)}`);
  if (a.kind === 'suggestion') lines.push(`${pad}    replace with: "${one(a.suggestion)}"${a.accepted ? `  (ACCEPTED by ${a.accepted.name}: apply it)` : '  (not accepted yet)'}`);
  if (a.claim) lines.push(`${pad}    in progress: ${by(a.claim)} since ${ago(a.claim.at)}`);
  for (const r of a.replies) lines.push(`${pad}    ↳ ${by(r.author)}: ${one(r.body)}`);
  return lines.join('\n');
}
function speakers(d, doc) {
  const runs = []; let cur = null;
  d.slides.forEach((s, i) => { const o = (doc.speakers[s.id] || {}).name || ''; if (cur && cur.o === o) cur.to = i + 1; else runs.push(cur = { o, from: i + 1, to: i + 1 }); });
  return runs.map((r) => (r.from === r.to ? `${r.from}` : `${r.from}-${r.to}`) + ' ' + (r.o || 'nobody')).join(', ');
}

// ---------- Commands.
const main = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
const cmds = {
  async brief() {
    if (!token()) { console.log('  (no agent token on this machine: Connect an agent in a deck, then node scripts/review.mjs login)'); return; }
    const decks = deckFiles().map((f) => parseDeck(f)).filter(Boolean);
    const docs = await Promise.all(decks.map((d) => call(d).catch(() => null)));
    if (decks.length && docs.every((x) => !x)) { console.log('  (review relay unreachable)'); return; }
    let any = false;
    for (const [k, d] of decks.entries()) {
      const doc = docs[k]; if (!doc) continue;
      const open = doc.annotations.filter((a) => a.status !== 'resolved'), named = Object.keys(doc.speakers).length;
      const busy = Object.values(doc.activity || {}).filter((v) => Date.now() - Date.parse(v.at) < 120000);
      if (!open.length && !named && !busy.length) continue;
      any = true;
      console.log(`  ${d.file} (${d.slides.length} slides): ${open.length} open${named ? '. Speakers: ' + speakers(d, doc) : ''}${doc.presence.length ? '. Here now: ' + doc.presence.map(by).join(', ') : ''}`);
      for (const v of busy) console.log(`    now: ${by(v)} ${v.doing}`);
      for (const a of open.slice(-6)) console.log(describe(d, a, '    '));
      if (open.length > 6) console.log(`    ... ${open.length - 6} more: node scripts/review.mjs inbox ${d.file}`);
    }
    if (!any) console.log('  (no open notes or speakers on any deck)');
  },
  async inbox(file) {
    const d = load(file), doc = await call(d), open = doc.annotations.filter((a) => a.status !== 'resolved');
    console.log(`${d.ledger || d.file}: ${open.length} open${doc.presence.length ? ' · here now: ' + doc.presence.map(by).join(', ') : ''}`);
    open.forEach((a) => console.log(describe(d, a)));
  },
  async show(file) {
    const d = load(file), doc = await call(d);
    await cmds.inbox(file);
    console.log('\nSpeakers: ' + speakers(d, doc));
    const done = doc.annotations.filter((a) => a.status === 'resolved').slice(-5);
    if (done.length) { console.log('\nRecently resolved:'); done.forEach((a) => console.log(describe(d, a) + `\n      resolved by ${by(a.resolved)}${a.resolved.commit ? ' in ' + a.resolved.commit : ''}${a.resolved.note ? ': ' + one(a.resolved.note) : ''}`)); }
    console.log('\nSlide ids: ' + d.slides.map((s) => s.n + '=' + s.id).join(' '));
  },
  async claim(file, ...rest) { const f = flags(rest), d = load(file), id = f._[0]; if (!id) die('usage: claim <deck> <id> [--release]', 2); await call(d, { op: 'claim', id, release: !!f.release }); console.log(f.release ? `Released ${id}` : `Claimed ${id}: people see you working on it`); },
  async resolve(file, ...rest) {
    const f = flags(rest), d = load(file), [id, ...note] = f._; if (!id) die('usage: resolve <deck> <id> [--commit <sha>] [what changed]', 2);
    await call(d, { op: 'resolve', id, commit: f.commit || null, note: note.join(' ') }); console.log(`Resolved ${id}`);
  },
  async reply(file, id, ...words) { const d = load(file), t = words.join(' ').trim(); if (!id || !t) die('usage: reply <deck> <id> <text>', 2); await call(d, { op: 'reply', id, text: t }); console.log(`Replied to ${id}`); },
  async edit(file, id, ...words) {
    const d = load(file), t = words.join(' ').trim(); if (!id || !t) die('usage: edit <deck> <id> <text>', 2);
    const cur = (await call(d)).annotations.find((a) => a.id === id); if (!cur) die('no note ' + id, 2);
    await call(d, { op: 'edit', id, text: t, base: cur.body }); console.log(`Edited ${id} (merged with any live typing)`);
  },
  async reopen(file, id) { const d = load(file); await call(d, { op: 'reopen', id }); console.log(`Reopened ${id}`); },
  async annotate(file, s, ...rest) {
    const f = flags(rest), d = load(file), sl = slideOf(d, s || ''), t = f._.join(' ').trim();
    const kind = f.suggest ? 'suggestion' : f.kind === 'task' ? 'task' : 'comment';
    if (!t && kind !== 'suggestion') die('say what the note is', 2);
    const target = f.quote ? { type: 'text', text: String(f.quote), selectors: [{ type: 'TextQuote', exact: String(f.quote) }] } : null;
    const r = await call(d, { op: 'annotate', slide: sl.id, label: sl.label, n: sl.n, kind, text: t, suggestion: f.suggest || null, target });
    console.log(`Added ${kind} on slide ${sl.n} "${sl.label}" [${r.id}]`);
  },
  async assign(file, spec, ...who) {
    const d = load(file), name = who.join(' ').trim(); if (!spec || !name) die('usage: assign <deck> <slides: 3 | 3-7 | 3,5,9> <name | ->', 2);
    const nums = [];
    for (const part of spec.split(',')) { const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim()); if (!m) die('slides look like 3, 3-7, or 3,5,9', 2); for (let k = +m[1]; k <= +(m[2] || m[1]); k++) nums.push(k); }
    for (const k of nums) { const sl = slideOf(d, String(k)); await call(d, { op: 'speaker', slide: sl.id, label: sl.label, name: name === '-' ? '' : name }); }
    console.log(`${name === '-' ? 'Cleared' : 'Gave ' + name} slide${nums.length > 1 ? 's' : ''} ${spec}`);
  },
  async status(file, ...rest) {
    const f = flags(rest), d = load(file), doing = f._.join(' ').trim();
    const sl = f.slide ? slideOf(d, String(f.slide)) : null;
    await call(d, { op: 'activity', doing, slide: sl ? sl.id : null });
    console.log(doing ? `Status: ${doing} (shows for two minutes; send again to keep it)` : 'Status cleared');
  },
  // One line per change, for the Monitor tool: new notes, replies, claims, resolves, accepted suggestions, speakers.
  async watch(file) {
    const decks = file ? [load(file)] : deckFiles().map((f) => parseDeck(f)).filter(Boolean);
    if (!token()) die('no agent token on this machine', 3);
    console.log(`watching ${decks.length} deck${decks.length > 1 ? 's' : ''}: ${decks.map((d) => d.file).join(', ')}`);
    await Promise.all(decks.map((d) => watchOne(d)));
  },
  async bake(built, file) {
    if (!built || !file) die('usage: bake <built.html> <source deck.html>', 2);
    const d = load(file); if (!token()) { console.log('bake: no agent token on this machine, so the published deck carries no speakers'); return; }
    let doc; try { doc = await call(d); } catch { console.log('bake: relay unreachable, published without speakers'); return; }
    let html = readFileSync(built, 'utf8'), n = 0;
    const b = parseDeck(built); if (!b || b.slides.length !== d.slides.length) die('bake: the built deck does not match its source', 2);
    for (const s of [...b.slides].reverse()) {
      const o = (doc.speakers[s.id] || {}).name; if (!o) continue;
      const tag = html.slice(s.start, s.tagEnd).replace(/\sdata-owner="[^"]*"/, '');
      html = html.slice(0, s.start) + tag + ` data-owner="${o.replace(/[&"<>]/g, (c) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c]))}"` + html.slice(s.tagEnd); n++;
    }
    writeFileSync(built, html); console.log(`bake: ${n} slide${n === 1 ? '' : 's'} carry their speaker`);
  },
  async login() {
    mkdirSync(CONF, { recursive: true });
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const t = (await new Promise((r) => rl.question('Paste the agent token from Connect an agent (a1_…): ', r))).trim(); rl.close();
    if (!/^a1_[\w-]{20,}$/.test(t)) die('that does not look like an agent token', 2);
    writeFileSync(join(CONF, 'agent-token'), t); chmodSync(join(CONF, 'agent-token'), 0o600);
    const me = await fetch(RELAY + '/api/me', { headers: { Authorization: 'Bearer ' + t } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    console.log(me ? `Saved. Agents on this machine now act as ${me.name}'s agent (${me.clubs.join(', ')}).` : 'Saved, but the relay did not accept it. Check the token.');
  },
};
async function watchOne(d) {
  let prev = null, backoff = 1000;
  const fmt = (a) => `${where(d, a)} [${a.id}]`;
  for (;;) {
    try {
      const r = await fetch(`${RELAY}/api/d/${d.club}/${d.deck}/watch`, { headers: { Authorization: 'Bearer ' + token() } });
      if (r.status === 401) die('the relay refused this machine\'s agent token', 3);
      if (!r.ok) throw new Error('relay ' + r.status);
      backoff = 1000;
      const dec = new TextDecoder(); let buf = '';
      for await (const chunk of r.body) {
        buf += dec.decode(chunk, { stream: true });
        let k; while ((k = buf.indexOf('\n\n')) >= 0) {
          const blk = buf.slice(0, k); buf = buf.slice(k + 2);
          if (!blk.startsWith('data: ')) continue;
          const doc = JSON.parse(blk.slice(6));
          if (prev) for (const line of changes(d, prev, doc, fmt)) console.log(`${new Date().toTimeString().slice(0, 8)} ${d.file}: ${line}`);
          prev = doc;
        }
      }
    } catch (e) { console.log(`${new Date().toTimeString().slice(0, 8)} ${d.file}: reconnecting (${e.message})`); }
    await new Promise((r) => setTimeout(r, backoff)); backoff = Math.min(30000, backoff * 2);
  }
}
function changes(d, a, b, fmt) {
  const out = [], old = new Map(a.annotations.map((x) => [x.id, x]));
  for (const n of b.annotations) {
    const o = old.get(n.id);
    if (!o) { out.push(`NEW ${n.kind} by ${by(n.author)} on ${fmt(n)}: ${one(n.body || n.suggestion).slice(0, 160)}${n.status === 'resolved' ? ' (already resolved)' : ''}`); continue; }
    if (n.replies.length > o.replies.length) for (const r of n.replies.slice(o.replies.length)) out.push(`REPLY by ${by(r.author)} on ${fmt(n)}: ${one(r.body).slice(0, 160)}`);
    if (n.status !== o.status) out.push(`${n.status.toUpperCase()} ${fmt(n)}${n.status === 'resolved' ? ` by ${by(n.resolved)}${n.resolved.commit ? ' in ' + n.resolved.commit : ''}` : n.claim ? ` by ${by(n.claim)}` : ''}`);
    if (n.accepted && !o.accepted) out.push(`ACCEPTED suggestion ${fmt(n)} by ${n.accepted.name}: replace "${one(n.target && n.target.text).slice(0, 80)}" with "${one(n.suggestion).slice(0, 80)}"`);
  }
  for (const [id, o] of old) if (!b.annotations.some((x) => x.id === id)) out.push(`DELETED ${fmt(o)}`);
  for (const [slide, s] of Object.entries(b.speakers)) if (!a.speakers[slide] || a.speakers[slide].name !== s.name) out.push(`SPEAKER slide ${d.slides.findIndex((x) => x.id === slide) + 1} is now ${s.name}`);
  for (const slide of Object.keys(a.speakers)) if (!b.speakers[slide]) out.push(`SPEAKER slide ${d.slides.findIndex((x) => x.id === slide) + 1} cleared`);
  return out;
}

if (!main) { /* imported: parseDeck and slug only */ }
else {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmds[cmd]) { console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 23).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(cmd ? 2 : 0); }
  await cmds[cmd](...args).catch((e) => die(e.message, 4));
}

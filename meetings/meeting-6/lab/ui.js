// Agent Lab page: levels, team tree, agent editor, run thread, key dialog, saving, share links.
// Every piece of model text, typed text, or link content is put on the page as text nodes, never as HTML.

import {
  runTeam, newAgent, byId, helpersOf, checkerOf, isChecker, checkedBy, roleOf, tops, topAgent,
  checkTeam, windowFor, buildInstructions, sanitizeTeam, depthOf, treeDepth, DEFAULT_LIMITS, COLORS, lines,
} from './engine.js';
import { PRESETS, DEFAULT_PRESET, getPreset, presetTeam, presetTask } from './presets.js';
import { createPracticeAdapter, loadRecordings } from './practice.js';

const STORE_TEAM = 'm6-lab-team';
const STORE_KEY = 'm6-lab-key';
const STORE_MODE = 'm6-lab-mode';
const L = DEFAULT_LIMITS;

// Each level's goal names the agents the preset loads, so it matches what is on screen.
const COUNT_WORD = ['no', 'one', 'two', 'three', 'four', 'five'];
const GOALS = {
  1: () => 'Give one agent a name, a one-line job, and a task. Press Run and see what the agent had to guess.',
  2: (p, main) => `${main.name} now has all six parts. Run the same task again and compare the two answers, then change one part and run again.`,
  3: p => `${p.lead.name} gives jobs to ${COUNT_WORD[p.helpers.length] || p.helpers.length} helpers, reads their reports, and makes the final call. Press Run, then add a helper of your own.`,
  4: (p, main) => `${p.checker.name} grades ${main.name}'s work on its Done when list and sends it back until it passes. Press Run, then change a Done when line.`,
};
function goalText(level, presetId) {
  const p = getPreset(presetId);
  return GOALS[level](p, p.helpers.find(h => h.id === p.main) || p.helpers[0]);
}

const PART_FIELDS = [
  { key: 'role', label: 'Role', hint: 'Who the agent is.', ph: 'Example: You write flyers for a college club\'s events.', rows: 2 },
  { key: 'goal', label: 'Goal', hint: 'What it should make, and why.', ph: 'Example: A flyer that gets students to come to game night.', rows: 2 },
  { key: 'steps', label: 'Steps', hint: 'The order to work in. One step per line.', ph: 'Example:\nFind the day, time, and room\nWrite a short headline\nEnd with one thing to do', rows: 4 },
  { key: 'rules', label: 'Rules', hint: 'What it must always or never do. One rule per line.', ph: 'Example:\nUse only facts from the task\nNo hashtags', rows: 3 },
  { key: 'output', label: 'Output', hint: 'What the answer should look like.', ph: 'Example: The flyer text only, ready to print.', rows: 2 },
  { key: 'doneWhen', label: 'Done when', hint: 'The checklist the work has to pass. One line each.', ph: 'Example:\nHas the day, time, and room\nUnder 40 words', rows: 3 },
];

const PHASE = { plan: 'Planning', work: 'Working', combine: 'Putting it together', check: 'Checking', revise: 'Fixing', ping: 'Checking' };
const KIND = { job: 'job', note: 'plan', draft: 'first draft', check: 'check', revise: 'new version', report: 'report', final: 'final answer' };
const NEW_EMOJI = ['🤖', '🧠', '🎨', '🔎', '💡', '🛠️', '📣', '🧾'];
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = id => document.getElementById(id);

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function svgEl(tag, attrs = {}) {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

// Storage can be blocked (private windows, previews); the page works without it.
const store = {
  get(area, k) { try { return globalThis[area].getItem(k); } catch { return null; } },
  set(area, k, v) { try { globalThis[area].setItem(k, v); } catch { /* ignore */ } },
  del(area, k) { try { globalThis[area].removeItem(k); } catch { /* ignore */ } },
};

// ---------- state ----------

const S = {
  presetId: DEFAULT_PRESET,
  level: 1,
  team: { agents: [] },
  task: '',
  dirty: false,
  taskDirty: false,
  selectedId: null,
  mode: 'practice',
  key: '',
  gemini: null,
  geminiReady: false,
  running: false,
  ctl: null,
  runNo: 0,
  last: null,
  recordings: [],
  recordingsReady: null,
  nodeState: new Map(),
  paths: new Map(),
};

const clampLevel = n => Math.min(4, Math.max(1, Math.round(Number(n)) || 1));
const selected = () => byId(S.team, S.selectedId) || topAgent(S.team) || S.team.agents[0] || null;

function defaultSelection() {
  const p = getPreset(S.presetId);
  if (S.level === 3) return topAgent(S.team)?.id;
  return (byId(S.team, p.main) || topAgent(S.team))?.id;
}

function loadPreset(id, level = S.level) {
  S.presetId = getPreset(id).id;
  S.level = clampLevel(level);
  S.team = presetTeam(S.presetId, S.level);
  S.task = presetTask(S.presetId, S.level);
  S.dirty = false;
  S.taskDirty = false;
  S.selectedId = defaultSelection();
  S.last = null;
}

function snapshot() {
  return JSON.stringify({ presetId: S.presetId, level: S.level, team: S.team, task: S.task, dirty: S.dirty, taskDirty: S.taskDirty, selectedId: S.selectedId });
}

function restore(snap) {
  const d = JSON.parse(snap);
  Object.assign(S, { presetId: d.presetId, level: d.level, team: sanitizeTeam(d.team), task: d.task, dirty: d.dirty, taskDirty: d.taskDirty, selectedId: d.selectedId });
}

let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    store.set('localStorage', STORE_TEAM, JSON.stringify({ v: 1, presetId: S.presetId, level: S.level, team: S.team, task: S.task, dirty: S.dirty, taskDirty: S.taskDirty, selectedId: S.selectedId }));
  }, 250);
}

function loadSaved() {
  const raw = store.get('localStorage', STORE_TEAM);
  if (!raw) return false;
  try {
    const d = JSON.parse(raw);
    if (!d || d.v !== 1) return false;
    const team = sanitizeTeam(d.team);
    if (!team.agents.length) return false;
    S.presetId = getPreset(d.presetId).id;
    S.level = clampLevel(d.level);
    S.team = team;
    S.task = typeof d.task === 'string' ? d.task.slice(0, 4000) : presetTask(S.presetId, S.level);
    S.dirty = Boolean(d.dirty);
    S.taskDirty = Boolean(d.taskDirty);
    S.selectedId = typeof d.selectedId === 'string' ? d.selectedId : null;
    return true;
  } catch {
    return false;
  }
}

// ---------- share links ----------

function toB64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s) {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b + '==='.slice((b.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

const SHARE_MAX = 40006; // '#team=' plus at most 40,000 characters

function shareUrl() {
  const data = { v: 1, preset: S.presetId, level: S.level, task: S.task, team: { agents: S.team.agents } };
  return `${location.origin}${location.pathname}#team=${toB64Url(JSON.stringify(data))}`;
}

function loadFromHash() {
  const m = location.hash.match(new RegExp(`^#team=([A-Za-z0-9_-]{1,${SHARE_MAX - 6}})$`));
  if (!m) return false;
  try {
    const d = JSON.parse(fromB64Url(m[1]));
    const team = sanitizeTeam(d?.team);
    if (!team.agents.length) return false;
    S.presetId = getPreset(d.preset).id;
    S.level = clampLevel(d.level);
    S.team = team;
    S.task = typeof d.task === 'string' ? d.task.slice(0, 4000) : '';
    S.dirty = true;
    S.taskDirty = true;
    S.selectedId = topAgent(team)?.id || null;
    return true;
  } catch {
    return false;
  } finally {
    try { history.replaceState(null, '', location.pathname + location.search); } catch { /* ignore */ }
  }
}

// ---------- rich text (model output) as DOM nodes ----------

function inline(text) {
  const frag = document.createDocumentFragment();
  const re = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\s][^*\n]*\*)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) frag.append(document.createTextNode(text.slice(last, m.index)));
    const t = m[0];
    if (t.startsWith('**') || t.startsWith('__')) frag.append(el('strong', null, t.slice(2, -2)));
    else frag.append(el('em', null, t.slice(1, -1)));
    last = m.index + t.length;
  }
  if (last < text.length) frag.append(document.createTextNode(text.slice(last)));
  return frag;
}

function rich(text) {
  const frag = document.createDocumentFragment();
  const blocks = String(text ?? '').replace(/\r/g, '').split(/\n\s*\n/);
  for (const block of blocks) {
    let list = null;
    let para = null;
    for (const raw of block.split('\n')) {
      const line = raw.trimEnd();
      if (!line.trim()) continue;
      let m;
      if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) {
        para = null;
        if (!list || list.tagName !== 'UL') { list = el('ul'); frag.append(list); }
        const li = el('li'); li.append(inline(m[1])); list.append(li);
      } else if ((m = line.match(/^\s*(\d+)[.)]\s+(.*)$/))) {
        para = null;
        if (!list || list.tagName !== 'OL') { list = el('ol'); list.start = Number(m[1]) || 1; frag.append(list); }
        const li = el('li'); li.append(inline(m[2])); list.append(li);
      } else if ((m = line.match(/^\s*#{1,6}\s+(.*)$/))) {
        list = null; para = null;
        const h = el('p', 'h'); h.append(inline(m[1].replace(/\*\*/g, ''))); frag.append(h);
      } else {
        list = null;
        if (!para) { para = el('p'); frag.append(para); } else para.append(el('br'));
        para.append(inline(line.trim()));
      }
    }
  }
  return frag;
}

// ---------- top bar and modes ----------

function renderModes() {
  const chip = $('modeChip');
  chip.replaceChildren();
  if (S.mode === 'gemini') {
    chip.className = 'chip gemini';
    chip.append(document.createTextNode('Gemini'));
    chip.append(el('span', 'model', S.geminiReady && S.gemini?.model ? `· ${S.gemini.model}` : '· key not checked yet'));
  } else {
    chip.className = 'chip practice';
    chip.append(document.createTextNode('Practice mode'));
  }
  $('keyBtn').textContent = S.key ? 'Your key' : 'Add a Gemini key';
  chip.disabled = S.running;
  $('keyBtn').disabled = S.running;
}

function setMode(mode) {
  S.mode = mode === 'gemini' && S.key ? 'gemini' : 'practice';
  store.set('sessionStorage', STORE_MODE, S.mode);
  renderModes();
}

// ---------- levels, presets, dirty note ----------

function renderLevels() {
  document.body.dataset.level = String(S.level);
  for (const b of document.querySelectorAll('.level')) b.setAttribute('aria-pressed', String(Number(b.dataset.level) === S.level));
  $('levelGoal').textContent = goalText(S.level, S.presetId);
  for (const b of $('presetSel').children) b.setAttribute('aria-pressed', String(b.dataset.preset === S.presetId));
  const p = getPreset(S.presetId);
  $('dirtyNote').hidden = !S.dirty;
  $('loadLevelBtn').textContent = `Load ${p.name} for level ${S.level}`;
}

function setLevel(n) {
  n = clampLevel(n);
  if (n === S.level && !S.dirty) return;
  S.level = n;
  if (!S.dirty) {
    S.team = presetTeam(S.presetId, n);
    S.selectedId = defaultSelection();
    S.last = null;
  }
  if (!S.taskDirty) S.task = presetTask(S.presetId, n);
  S.nodeState.clear();
  $('runStatus').textContent = '';
  renderAll();
  save();
}

function withUndo(label, fn) {
  const before = snapshot();
  fn();
  S.nodeState.clear();
  renderAll();
  save();
  toast(label, 'Undo', () => {
    if (S.running) return;
    restore(before); S.nodeState.clear(); renderAll(); save(); toast('Back to your team.');
  });
}

function markDirty() {
  if (!S.dirty) { S.dirty = true; renderLevels(); }
  save();
}

// ---------- team tree ----------

function roleLabel(role) {
  return { lead: 'Lead', helper: 'Helper', checker: 'Checker', solo: 'Agent' }[role];
}

function nodeEl(agent) {
  const role = roleOf(S.team, agent.id);
  const b = el('button', `node ${role}`);
  b.type = 'button';
  b.dataset.id = agent.id;
  b.style.setProperty('--c', agent.color);
  b.setAttribute('aria-pressed', String(agent.id === selected()?.id));
  const badge = el('span', `node-badge ${role}`, roleLabel(role));
  const av = el('span', 'node-av', agent.emoji || '🤖');
  av.setAttribute('aria-hidden', 'true');
  const name = el('span', 'node-name', agent.name || 'Agent');
  const job = el('span', 'node-job', agent.job || (role === 'checker' ? 'Grades the work' : 'No job line yet'));
  const st = el('span', 'node-state');
  b.append(badge, av, name, job, st);
  const lead = agent.parentId ? byId(S.team, agent.parentId) : null;
  b.setAttribute('aria-label', `${agent.name}, ${roleLabel(role)}${lead ? `, reports to ${lead.name}` : ''}. Select to edit.`);
  applyNodeState(b, S.nodeState.get(agent.id));
  b.addEventListener('click', () => { S.selectedId = agent.id; save(); renderTreeSelection(); renderEditor(); renderTools(); });
  return b;
}

function applyNodeState(b, st) {
  const tag = b.querySelector('.node-state');
  if (!st) { delete b.dataset.state; tag.textContent = ''; return; }
  b.dataset.state = st.state;
  tag.textContent = st.label;
}

function setNode(id, state, label) {
  if (!id) return;
  if (state) S.nodeState.set(id, { state, label }); else S.nodeState.delete(id);
  const b = document.querySelector(`.node[data-id="${CSS.escape(id)}"]`);
  if (b) applyNodeState(b, S.nodeState.get(id));
}

function subtree(agent, seen) {
  seen.add(agent.id);
  const wrap = el('div', 'sub');
  const row = el('div', 'sub-row');
  row.append(nodeEl(agent));
  const chk = checkerOf(S.team, agent);
  if (chk && !seen.has(chk.id)) { seen.add(chk.id); row.append(nodeEl(chk)); }
  wrap.append(row);
  const kids = helpersOf(S.team, agent.id).filter(h => !seen.has(h.id));
  if (kids.length) {
    const k = el('div', 'sub-kids');
    for (const h of kids) k.append(subtree(h, seen));
    wrap.append(k);
  }
  return wrap;
}

function renderTree() {
  const tree = $('tree');
  tree.replaceChildren();
  const seen = new Set();
  const row = el('div', 'sub-kids');
  row.style.marginTop = '0';
  const roots = tops(S.team);
  for (const t of roots) row.append(subtree(t, seen));
  tree.append(roots.length > 1 ? row : (row.firstChild || el('p', 'hint', 'No agents yet.')));
  requestAnimationFrame(fitTree);
}

// A wide team stacks each checker under its agent instead of beside it, so the tree fits without scrolling.
function fitTree() {
  const canvas = $('canvas');
  const box = $('treeBox');
  canvas.classList.remove('compact', 'tight');
  if (box.scrollWidth > canvas.clientWidth - 16) canvas.classList.add('compact');
  if (box.scrollWidth > canvas.clientWidth - 16) canvas.classList.add('tight');
  drawWires();
}

function renderTreeSelection() {
  const id = selected()?.id;
  for (const b of document.querySelectorAll('.node')) b.setAttribute('aria-pressed', String(b.dataset.id === id));
}

function rectIn(node, box) {
  const r = node.getBoundingClientRect();
  return { l: r.left - box.left, r: r.right - box.left, t: r.top - box.top, b: r.bottom - box.top, cx: (r.left + r.right) / 2 - box.left, cy: (r.top + r.bottom) / 2 - box.top };
}

function drawWires() {
  const svg = $('wires');
  const boxEl = $('treeBox');
  const box = boxEl.getBoundingClientRect();
  svg.replaceChildren();
  S.paths.clear();
  svg.setAttribute('width', String(Math.ceil(boxEl.scrollWidth)));
  svg.setAttribute('height', String(Math.ceil(boxEl.scrollHeight)));
  const defs = svgEl('defs');
  for (const [id, color] of [['arrow', '#3F5A2A'], ['arrowLoop', '#A8487A']]) {
    const mk = svgEl('marker', { id, viewBox: '0 0 10 10', refX: '8', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' });
    mk.append(svgEl('path', { d: 'M0 0L10 5L0 10z', fill: color }));
    defs.append(mk);
  }
  svg.append(defs);
  const nodeOf = id => boxEl.querySelector(`.node[data-id="${CSS.escape(id)}"]`);
  for (const a of S.team.agents) {
    if (!a.parentId || isChecker(S.team, a.id)) continue;
    const pn = nodeOf(a.parentId);
    const cn = nodeOf(a.id);
    if (!pn || !cn) continue;
    const p = rectIn(pn, box);
    const c = rectIn(cn, box);
    const y1 = p.b + 2;
    const y2 = c.t - 13;
    const my = (y1 + y2) / 2;
    const d = `M${p.cx} ${y1} C${p.cx} ${my}, ${c.cx} ${my}, ${c.cx} ${y2}`;
    const path = svgEl('path', { d, class: 'wire', 'marker-end': 'url(#arrow)' });
    svg.append(path);
    S.paths.set(`${a.parentId}>${a.id}`, { d, path });
  }
  for (const a of S.team.agents) {
    const chk = checkerOf(S.team, a);
    if (!chk) continue;
    const an = nodeOf(a.id);
    const kn = nodeOf(chk.id);
    if (!an || !kn) continue;
    const A = rectIn(an, box);
    const K = rectIn(kn, box);
    let fwd;
    let back;
    if (K.l >= A.r - 4) {
      const x1 = A.r + 3; const x2 = K.l - 3; const mx = (x1 + x2) / 2;
      fwd = `M${x1} ${A.cy - 10} Q${mx} ${A.cy - 46}, ${x2} ${K.cy - 10}`;
      back = `M${x2} ${K.cy + 10} Q${mx} ${K.cy + 46}, ${x1} ${A.cy + 10}`;
    } else {
      const y1 = A.b + 3; const y2 = K.t - 14; const my = (y1 + y2) / 2;
      fwd = `M${A.cx + 14} ${y1} Q${A.cx + 44} ${my}, ${K.cx + 14} ${y2}`;
      back = `M${K.cx - 14} ${y2} Q${K.cx - 44} ${my}, ${A.cx - 14} ${y1}`;
    }
    const pf = svgEl('path', { d: fwd, class: 'wire loop', 'marker-end': 'url(#arrowLoop)' });
    const pb = svgEl('path', { d: back, class: 'wire loop', 'marker-end': 'url(#arrowLoop)' });
    svg.append(pf, pb);
    S.paths.set(`${a.id}>${chk.id}`, { d: fwd, path: pf });
    S.paths.set(`${chk.id}>${a.id}`, { d: back, path: pb });
  }
}

function pulse(fromId, toId, cls) {
  let p = S.paths.get(`${fromId}>${toId}`);
  let reverse = false;
  if (!p) { p = S.paths.get(`${toId}>${fromId}`); reverse = true; }
  if (!p) return;
  p.path.classList.add('lit');
  setTimeout(() => p.path.classList.remove('lit'), 900);
  if (REDUCED) return;
  const svg = $('wires');
  const dot = svgEl('circle', { r: '7', class: `pulse ${cls}` });
  const anim = svgEl('animateMotion', { dur: '0.9s', begin: 'indefinite', fill: 'freeze', path: p.d, keyPoints: reverse ? '1;0' : '0;1', keyTimes: '0;1', calcMode: 'linear' });
  dot.append(anim);
  svg.append(dot);
  try { anim.beginElement(); } catch { /* old browsers: no pulse */ }
  setTimeout(() => dot.remove(), 1000);
}

// ---------- tree tools ----------

function toolState() {
  const a = selected();
  const n = S.team.agents.length;
  const out = { helper: '', lead: '', checker: '', remove: '' };
  if (!a) return { helper: 'Select an agent first.', lead: 'Select an agent first.', checker: 'Select an agent first.', remove: 'Select an agent first.' };
  const chk = isChecker(S.team, a.id);
  const full = n >= L.maxAgents ? `The lab's limit is ${L.maxAgents} agents per team.` : '';
  out.helper = chk ? 'A checker grades work. It has no helpers.'
    : full || (helpersOf(S.team, a.id).length >= L.maxHelpers ? `${a.name} already has ${L.maxHelpers} helpers, the lab's limit.` : '')
      || (depthOf(S.team, a.id) >= L.maxDepth ? `A helper here would make the team ${L.maxDepth + 1} levels deep. The limit is ${L.maxDepth}.` : '');
  out.lead = chk ? 'A checker sits beside its agent, not under a lead.'
    : full || (treeDepth(S.team) >= L.maxDepth ? `A new lead would make the team ${treeDepth(S.team) + 1} levels deep. The limit is ${L.maxDepth}.` : '');
  out.checker = chk ? 'A checker can\'t have its own checker in this lab.'
    : full || (checkerOf(S.team, a) ? `${a.name} already has a checker.` : '');
  const top = !a.parentId && !chk;
  out.remove = n <= 1 ? 'A team needs at least one agent.'
    : top && helpersOf(S.team, a.id).length > 1 ? `To remove ${a.name}, remove its helpers first.` : '';
  return out;
}

function renderTools() {
  const st = toolState();
  const a = selected();
  $('addHelperBtn').disabled = Boolean(st.helper) || S.running;
  $('addLeadBtn').disabled = Boolean(st.lead) || S.running;
  $('addCheckerBtn').disabled = Boolean(st.checker) || S.running;
  $('removeBtn').disabled = Boolean(st.remove) || S.running;
  $('addHelperBtn').title = st.helper || `Add a helper under ${a?.name}`;
  $('addLeadBtn').title = st.lead || `Add a lead above ${a?.name}`;
  $('addCheckerBtn').title = st.checker || `Add a checker for ${a?.name}`;
  $('removeBtn').title = st.remove || `Remove ${a?.name}`;
  if (S.running) $('treeHint').textContent = 'The team is locked while it runs.';
  else if (a) {
    const rows = [['+ Helper', st.helper], ['+ Lead above', st.lead], ['+ Checker', S.level >= 4 ? st.checker : ''], ['Remove', st.remove]]
      .filter(([, r]) => r);
    // When both add buttons are off for the depth limit, say it once.
    const deep = r => / levels deep\. The limit is /.test(r);
    const merged = rows.length >= 2 && deep(rows[0][1]) && rows[1][0] === '+ Lead above' && deep(rows[1][1]) && rows[0][0] === '+ Helper'
      ? [['+ Helper and + Lead above', `The team can be at most ${L.maxDepth} levels deep.`], ...rows.slice(2)]
      : rows;
    $('treeHint').textContent = [`Selected: ${a.name}.`, ...merged.map(([b, r]) => `${b}: ${r}`)].join('\n');
  }
}

function nextColor() {
  const used = new Set(S.team.agents.map(a => a.color));
  return COLORS.find(c => !used.has(c)) || COLORS[S.team.agents.length % COLORS.length];
}

function nextEmoji() {
  const used = new Set(S.team.agents.map(a => a.emoji));
  return NEW_EMOJI.find(e => !used.has(e)) || '🤖';
}

function uniqueName(base) {
  const names = new Set(S.team.agents.map(a => a.name.trim().toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  for (let i = 2; i < 50; i += 1) if (!names.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`;
  return base;
}

function afterStructureChange(focusName) {
  S.last = null;
  S.nodeState.clear();
  markDirty();
  renderTree();
  renderEditor();
  renderTools();
  if (focusName) requestAnimationFrame(() => $('f-name')?.focus());
}

function addHelper() {
  const a = selected();
  if (!a || toolState().helper) return;
  const h = newAgent({ name: uniqueName('Helper'), emoji: nextEmoji(), color: nextColor(), parentId: a.id });
  S.team.agents.push(h);
  S.selectedId = h.id;
  afterStructureChange(true);
}

function addLeadAbove() {
  const a = selected();
  if (!a || toolState().lead) return;
  const lead = newAgent({ name: uniqueName('Lead'), emoji: '🧭', color: nextColor(), parentId: a.parentId, job: '' });
  a.parentId = lead.id;
  S.team.agents.splice(S.team.agents.indexOf(a), 0, lead);
  S.selectedId = lead.id;
  afterStructureChange(true);
}

function addChecker() {
  const a = selected();
  if (!a || toolState().checker) return;
  const c = newAgent({ name: uniqueName(`${a.name} Checker`.slice(0, 40)), emoji: '✅', color: '#6B7F2A', job: `Checks ${a.name}'s work against its Done when list.` });
  a.checkerId = c.id;
  S.team.agents.push(c);
  afterStructureChange(false);
  requestAnimationFrame(() => $('f-doneWhen')?.focus());
}

function removeSelected() {
  const a = selected();
  if (!a || toolState().remove) return;
  withUndo(`Removed ${a.name}.`, () => {
    const team = S.team;
    if (isChecker(team, a.id)) {
      const target = checkedBy(team, a.id);
      if (target) target.checkerId = null;
      S.selectedId = target?.id || null;
    } else {
      const kids = helpersOf(team, a.id);
      for (const k of kids) k.parentId = a.parentId;
      const chk = checkerOf(team, a);
      if (chk) team.agents.splice(team.agents.indexOf(chk), 1);
      S.selectedId = a.parentId || kids[0]?.id || null;
    }
    team.agents.splice(team.agents.indexOf(a), 1);
    if (!byId(team, S.selectedId)) S.selectedId = topAgent(team)?.id || null;
    S.last = null;
    S.dirty = true;
  });
}

// ---------- editor ----------

function field({ id, label, hint, value, multiline, rows = 2, placeholder, wide, onInput, maxLength = 1500 }) {
  const f = el('div', `field${wide ? ' wide' : ''}`);
  const lab = el('label', null, label);
  lab.htmlFor = id;
  const h = el('p', 'hint', hint);
  h.id = `${id}-hint`;
  const input = multiline ? el('textarea') : el('input');
  if (!multiline) input.type = 'text';
  else input.rows = rows;
  input.id = id;
  input.value = value;
  input.maxLength = maxLength;
  if (placeholder) input.placeholder = placeholder;
  input.setAttribute('aria-describedby', h.id);
  input.addEventListener('input', () => onInput(input.value));
  f.append(lab, h, input);
  // A box grows to fit its text, so every step and rule shows without scrolling inside it.
  if (multiline) {
    input.addEventListener('input', () => growBox(input));
    requestAnimationFrame(() => growBox(input));
  }
  return f;
}

function growBox(t) {
  if (!t.isConnected || !t.offsetParent) return;
  t.style.height = 'auto';
  t.style.height = `${t.scrollHeight + 4}px`;
}

function growAll() {
  for (const t of document.querySelectorAll('#editor textarea')) growBox(t);
}

function relLine(a) {
  const role = roleOf(S.team, a.id);
  if (role === 'checker') {
    const t = checkedBy(S.team, a.id);
    return `Checker · grades ${t ? t.name : 'another agent'}'s work`;
  }
  const lead = a.parentId ? byId(S.team, a.parentId) : null;
  const helpers = helpersOf(S.team, a.id);
  const bits = [];
  if (helpers.length) bits.push(`Lead of ${helpers.map(h => h.name).join(', ')}`);
  if (lead) bits.push(`reports to ${lead.name}`);
  if (!lead && !helpers.length) bits.push('On its own, answers you');
  else if (!lead) bits.push('answers you');
  const s = bits.join(' · ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

let seesTimer = 0;
function refreshSoon() {
  clearTimeout(seesTimer);
  seesTimer = setTimeout(() => { const box = $('seesBox'); if (box) renderSees(box, selected()); }, 180);
}

function renderEditor() {
  const ed = $('editor');
  ed.replaceChildren();
  const a = selected();
  if (!a) { ed.append(el('p', 'hint', 'Select an agent in your team to edit it.')); return; }
  S.selectedId = a.id;
  const role = roleOf(S.team, a.id);
  ed.style.setProperty('--c', a.color);

  const hd = el('div', 'ed-hd');
  const av = el('div', 'ed-av', a.emoji || '🤖');
  av.setAttribute('aria-hidden', 'true');
  const hdText = el('div');
  const eyebrow = el('p', 'eyebrow', `Selected agent · ${roleLabel(role)}`);
  const h2 = el('h2', null, a.name || 'Agent');
  h2.id = 'edName';
  const rel = el('p', 'hint ed-rel', relLine(a));
  hdText.append(eyebrow, h2, rel);
  hd.append(av, hdText);
  ed.append(hd);

  const grid = el('div', 'fields');
  grid.append(field({
    id: 'f-name', label: 'Name', hint: 'What the team calls this agent.', value: a.name, maxLength: 40,
    onInput: v => { a.name = v; h2.textContent = v || 'Agent'; markDirty(); renderTree(); refreshSoon(); },
  }));

  const look = el('div', 'field');
  const lookLab = el('span', 'label', 'Look');
  const lookHint = el('p', 'hint', 'One emoji and a color for the chat.');
  const lookRow = el('div', 'look');
  const emo = el('input');
  emo.type = 'text';
  emo.id = 'f-emoji';
  emo.value = a.emoji;
  emo.maxLength = 8;
  emo.setAttribute('aria-label', 'Emoji');
  emo.addEventListener('input', () => { a.emoji = emo.value.trim() || '🤖'; av.textContent = a.emoji; markDirty(); renderTree(); });
  const sw = el('div', 'swatches');
  sw.setAttribute('role', 'group');
  sw.setAttribute('aria-label', 'Color');
  for (const c of COLORS) {
    const s = el('button', 'swatch');
    s.type = 'button';
    s.style.setProperty('--sw', c);
    s.setAttribute('aria-label', `Color ${c}`);
    s.setAttribute('aria-pressed', String(a.color === c));
    s.addEventListener('click', () => {
      a.color = c;
      for (const x of sw.children) x.setAttribute('aria-pressed', String(x === s));
      ed.style.setProperty('--c', c);
      markDirty();
      renderTree();
    });
    sw.append(s);
  }
  lookRow.append(emo, sw);
  look.append(lookLab, lookHint, lookRow);
  grid.append(look);

  grid.append(field({
    id: 'f-job', label: 'Job', wide: true, value: a.job, maxLength: 300,
    hint: a.parentId ? `One line: what this agent does. ${byId(S.team, a.parentId)?.name || 'Its lead'} reads this line too.` : 'One line: what this agent does.',
    placeholder: role === 'checker' ? 'Example: Checks the flyer against its Done when list.' : 'Example: Writes the game night flyer.',
    onInput: v => { a.job = v; markDirty(); renderTree(); refreshSoon(); },
  }));

  const parts = el('div', 'part-group need-2');
  parts.append(el('span', 'label', 'The six parts'), el('p', 'hint', 'Each part becomes a labeled section of the instructions. Empty parts are left out.'));
  const pg = el('div', 'fields');
  for (const p of PART_FIELDS) {
    if (p.key === 'doneWhen' && role === 'checker') {
      const t = checkedBy(S.team, a.id);
      const box = el('div', 'field wide');
      box.append(el('span', 'label', 'Done when'));
      const items = t?.doneWhen || [];
      box.append(el('p', 'hint', items.length ? `${a.name} grades ${t.name}'s Done when list, line by line:` : `${t ? t.name : 'Its agent'} has no Done when lines yet. Select ${t ? t.name : 'it'} and add two or three.`));
      if (items.length) {
        const ul = el('ul', 'hint');
        for (const it of items) ul.append(el('li', null, it));
        box.append(ul);
      }
      pg.append(box);
      continue;
    }
    const value = p.key === 'doneWhen' ? a.doneWhen.join('\n') : a[p.key];
    pg.append(field({
      id: `f-${p.key}`, label: p.label, hint: p.hint, value, multiline: true, rows: p.rows, placeholder: p.ph, wide: true,
      onInput: v => { a[p.key] = p.key === 'doneWhen' ? lines(v).slice(0, 8) : v; markDirty(); refreshSoon(); if (p.key === 'doneWhen') renderCheckBox(); },
    }));
  }
  parts.append(pg);
  grid.append(parts);

  if (role !== 'checker') {
    const cb = el('div', 'chk-box need-4');
    cb.id = 'chkBox';
    grid.append(cb);
  }
  ed.append(grid);
  renderCheckBox();

  const sees = el('details', 'sees need-2');
  sees.open = true;
  const sum = el('summary');
  sum.append(document.createTextNode('What it sees '), el('span', 'hint', 'The exact text the model gets, top to bottom. Lines that start with ## are headings.'));
  const box = el('div');
  box.id = 'seesBox';
  sees.append(sum, box);
  ed.append(sees);
  renderSees(box, a);
}

function renderCheckBox() {
  const cb = $('chkBox');
  const a = selected();
  if (!cb || !a) return;
  cb.replaceChildren();
  const chk = checkerOf(S.team, a);
  if (!chk) {
    cb.append(el('span', 'label', 'Check loop'), el('p', 'hint', `No checker yet. Press + Checker to add one that grades ${a.name}'s work against its Done when list.`));
    return;
  }
  cb.append(el('span', 'label', `Checked by ${chk.name}`));
  cb.append(el('p', 'hint', `${chk.name} grades every Done when line. If one fails, the work goes back to ${a.name} with notes.`));
  if (!a.doneWhen.length) cb.append(el('p', 'warn', `Add Done when lines above. Without them, ${chk.name} can only check "Does the job it was given".`));
  const lab = el('span', 'label', 'Max rounds');
  lab.id = 'roundsLabel';
  const hint = el('p', 'hint', 'The most check rounds before the run goes on with the last version.');
  const row = el('div', 'rounds');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-labelledby', 'roundsLabel');
  for (let n = 1; n <= L.maxRounds; n += 1) {
    const b = el('button', null, String(n));
    b.type = 'button';
    b.setAttribute('aria-pressed', String(a.maxRounds === n));
    b.setAttribute('aria-label', `${n} round${n === 1 ? '' : 's'}`);
    b.addEventListener('click', () => {
      a.maxRounds = n;
      for (const x of row.children) x.setAttribute('aria-pressed', String(x === b));
      markDirty();
    });
    row.append(b);
  }
  cb.append(lab, hint, row);
}

function blk(cls, title, small) {
  const b = el('div', `blk${cls ? ` ${cls}` : ''}`);
  const t = el('b', null, title);
  if (small) t.append(el('small', null, small));
  b.append(t);
  return b;
}

function renderSees(box, a) {
  if (!a || !box) return;
  box.replaceChildren();
  const current = buildInstructions(S.team, a);
  const conv = S.last && S.last.instructions?.[a.id] === current ? S.last.conversations?.[a.id] : null;
  const w = windowFor(S.team, a, S.task, conv);
  const win = el('div', 'win');
  const ins = blk('mine', 'Instructions', 'your parts, plus team lines the lab adds');
  ins.append(el('pre', null, w.instructions));
  win.append(ins);
  const chat = blk('', 'The whole chat so far', w.fromRun ? 'from the last run' : 'before a run');
  if (!w.messages.length) chat.append(el('p', 'txt', w.fromRun ? 'Nothing before this message.' : 'Nothing yet. This agent starts each run with an empty chat.'));
  for (const m of w.messages) {
    const t = el('div', 'turn');
    t.append(el('b', null, m.role === 'model' ? `${a.name} replied` : 'Message to it'), document.createTextNode(m.text));
    chat.append(t);
  }
  win.append(chat);
  const nm = blk('you', 'New message', w.fromRun ? 'its last one' : null);
  nm.append(el('p', 'txt', w.newMessage || ''));
  win.append(nm);
  if (w.reply) {
    const r = blk('next', 'Its reply');
    r.append(el('p', 'txt', w.reply));
    win.append(r);
  }
  box.append(win);
}

// ---------- task ----------

function renderTask() {
  const t = $('task');
  if (t.value !== S.task) t.value = S.task;
  growTask();
}

function growTask() {
  const t = $('task');
  t.style.height = 'auto';
  t.style.height = `${Math.min(280, t.scrollHeight + 4)}px`;
}

// ---------- thread ----------

const thread = () => $('thread');
let waitTimers = [];

function renderEmpty() {
  const li = el('li', 'empty');
  li.append(el('b', null, 'No messages yet'), document.createTextNode('Press Run to start.'));
  thread().replaceChildren(li);
  $('runStatus').textContent = '';
}

// During a run the list follows new messages unless the reader scrolls up to read.
let follow = false;
let autoScrolling = false;

function addItem(node) {
  const t = thread();
  t.querySelector('.empty')?.remove();
  const nearBottom = t.scrollHeight - t.scrollTop - t.clientHeight < 140;
  t.append(node);
  if ((follow || nearBottom) && t.scrollHeight > t.clientHeight + 4 && getComputedStyle(t).overflowY === 'auto') {
    autoScrolling = true;
    t.scrollTop = t.scrollHeight;
    requestAnimationFrame(() => { autoScrolling = false; });
  }
  return node;
}

// Brings the start of a new run into view, on the scrolling list (desktop) or the page (phone).
function showRunStart(div) {
  const t = thread();
  follow = true;
  if (getComputedStyle(t).overflowY === 'auto') {
    autoScrolling = true;
    t.scrollTop += div.getBoundingClientRect().top - t.getBoundingClientRect().top - 8;
    requestAnimationFrame(() => { autoScrolling = false; });
  } else {
    div.scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });
  }
}

function who(id, team) {
  if (id === 'you') return { name: 'You', emoji: '🙂', color: '#A8487A' };
  if (id === 'team') return { name: 'the team', emoji: '👥', color: '#4D5845' };
  if (id === 'lab') return { name: 'Lab', emoji: 'ℹ️', color: '#4D5845' };
  const a = byId(team, id);
  return a ? { name: a.name || 'Agent', emoji: a.emoji || '🤖', color: a.color } : { name: 'Agent', emoji: '🤖', color: '#4D5845' };
}

function addLabNote(text) {
  const li = el('li', 'labnote');
  li.append(el('b', null, 'Lab: '), document.createTextNode(text));
  return addItem(li);
}

function checklist(checks) {
  const ul = el('ul', 'checks');
  for (const c of checks) {
    const li = el('li', c.pass ? 'pass' : 'fail');
    const mk = el('span', 'mk', c.pass ? '✓' : '✗');
    mk.setAttribute('aria-hidden', 'true');
    const body = el('span');
    body.append(el('span', 'sr', c.pass ? 'Pass: ' : 'Fail: '), el('span', 'it', c.item));
    if (c.note) body.append(el('span', 'nt', c.note));
    li.append(mk, body);
    ul.append(li);
  }
  return ul;
}

function addMessage(m, run) {
  const team = run.team;
  if (m.lab) {
    if (m.text === run.lastLimitText) return;
    addLabNote(m.text);
    return;
  }
  const from = who(m.from, team);
  const to = who(m.to, team);
  if (m.kind === 'draft' || m.kind === 'revise') run.lastText.set(m.from, m.text);

  if (m.kind === 'final') {
    const li = el('li', 'final');
    const hd = el('div', 'final-hd');
    hd.append(el('b', null, `${from.emoji} Final answer from ${from.name}`));
    const copy = el('button', 'btn small', 'Copy');
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      const ok = await copyText(m.text);
      copy.textContent = ok ? 'Copied' : 'Copy failed';
      setTimeout(() => { copy.textContent = 'Copy'; }, 1600);
    });
    hd.append(copy);
    const bub = el('div', 'bub');
    bub.append(rich(m.text));
    li.append(hd, bub);
    addItem(li);
    return;
  }

  const li = el('li', `msg ${m.from === 'you' ? 'you' : ''} ${m.kind === 'note' ? 'note' : ''}`);
  li.style.setProperty('--c', from.color);
  li.style.setProperty('--c2', to.color);
  const av = el('div', 'msg-av', from.emoji);
  av.setAttribute('aria-hidden', 'true');
  const body = el('div', 'msg-body');
  const head = el('p', 'msg-from');
  head.append(el('span', 'who', from.name), el('span', 'arrow', '→'), el('span', 'to', to.name), el('span', `kind ${m.kind}`, m.from === 'you' ? 'task' : KIND[m.kind] || m.kind));
  body.append(head);
  const bub = el('div', 'bub');
  if (m.kind === 'check') {
    bub.append(checklist(m.checks || []));
    const v = el('div', 'verdict');
    v.append(el('span', 'round-badge', `Round ${m.round} of ${m.maxRounds}`));
    v.append(el('span', `res ${m.pass ? 'pass' : 'fail'}`, m.pass ? 'Passed' : m.capped ? 'Still failing at the round limit' : `Sent back to ${to.name}`));
    bub.append(v);
    if (m.text && !m.pass) {
      const fb = el('p', 'fb');
      fb.append(el('strong', null, 'What to fix: '), document.createTextNode(m.text));
      bub.append(fb);
    }
    if (m.pass) run.passed.add(m.to);
  } else if (m.kind === 'report' && m.checked && run.lastText.get(m.from) === m.text) {
    bub.append(el('p', null, run.passed.has(m.from) ? `Sends the version that passed to ${to.name}.` : `Sends its last version to ${to.name}.`));
    const more = el('details', 'more');
    more.append(el('summary', null, 'Show it'));
    const inner = el('div');
    inner.append(rich(m.text));
    more.append(inner);
    bub.append(more);
  } else {
    if (m.kind === 'revise') {
      const v = el('div', 'verdict');
      v.style.marginTop = '0';
      v.style.marginBottom = '6px';
      v.append(el('span', 'round-badge', `For round ${m.round} of ${m.maxRounds}`));
      bub.append(v);
    }
    bub.append(rich(m.text));
  }
  body.append(bub);
  li.append(av, body);
  addItem(li);
}

function addWait(ev, run) {
  const name = who(ev.agentId, run.team).name;
  const li = el('li', 'wait');
  const clock = el('span', 'clock');
  clock.setAttribute('aria-hidden', 'true');
  const txt = el('span');
  let left = ev.seconds;
  const why = ev.reason === 'pace' ? 'to stay under the free limit' : 'for Google\'s free limit';
  const paint = () => { txt.textContent = left > 0 ? `${name} is waiting ${left}s ${why}` : `${name} is done waiting`; };
  paint();
  li.append(clock, txt);
  addItem(li);
  const w = { done: false };
  w.timer = setInterval(() => {
    left -= 1;
    paint();
    if (left <= 0) {
      clearInterval(w.timer);
      w.done = true;
      clock.remove();
      // The wait is over and the request goes out, so the node shows it working again.
      if (S.nodeState.get(ev.agentId)?.state === 'waiting') setNode(ev.agentId, 'thinking', 'Working');
    }
  }, 1000);
  // Called when the run ends (Stop or an error) while this row is still counting.
  w.end = () => {
    clearInterval(w.timer);
    if (w.done) return;
    w.done = true;
    clock.remove();
    txt.textContent = `${name} stopped waiting`;
  };
  waitTimers.push(w);
}

function addAlert(kind, title, text, buttons = []) {
  const li = el('li', `alert ${kind}`);
  li.setAttribute('role', 'alert');
  li.append(el('b', null, title), el('p', null, text));
  if (buttons.length) {
    const row = el('div', 'btns');
    for (const [label, fn, cls] of buttons) {
      const b = el('button', `btn small${cls ? ` ${cls}` : ''}`, label);
      b.type = 'button';
      b.addEventListener('click', fn);
      row.append(b);
    }
    li.append(row);
  }
  return addItem(li);
}

function errorButtons(retryable, kind) {
  const out = [];
  if (retryable) out.push(['Retry', () => run(), 'primary']);
  if (kind === 'nokey' || kind === 'badKey' || kind === 'leaked' || kind === 'denied' || kind === 'disabled') out.push(['Change key', () => openKeyDialog()]);
  if (S.mode === 'gemini') out.push(['Switch to practice mode', () => { setMode('practice'); toast('Practice mode is on. Press Run.'); }, 'accent']);
  return out;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = el('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

// ---------- toast ----------

let toastTimer = 0;
function toast(text, actionLabel, action) {
  const t = $('toast');
  $('toastText').textContent = text;
  const b = $('toastBtn');
  b.hidden = !actionLabel;
  b.onclick = null;
  if (actionLabel) {
    b.textContent = actionLabel;
    b.onclick = () => { t.hidden = true; action(); };
  }
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, actionLabel ? 8000 : 3200);
}

// ---------- running ----------

async function practiceAdapter() {
  if (S.recordingsReady) {
    await Promise.race([S.recordingsReady, new Promise(r => setTimeout(r, 1500))]);
  }
  return createPracticeAdapter({ recordings: S.recordings });
}

async function geminiAdapter() {
  if (!S.gemini) {
    let mod;
    try {
      mod = await import('./gemini.js');
    } catch {
      const e = new Error('gemini.js missing');
      e.friendly = 'Gemini mode could not load on this page. Press Retry, or switch to practice mode.';
      e.kind = 'load';
      throw e;
    }
    S.gemini = mod.createGeminiAdapter({ key: S.key, onModel: onModelSwitch });
    S.geminiReady = false;
  }
  if (!S.geminiReady) {
    await S.gemini.checkKey({ ping: false, signal: S.ctl?.signal });
    S.geminiReady = true;
    renderModes();
  }
  return S.gemini;
}

function onModelSwitch(model, reason) {
  const why = { daily: 'the last model used up today\'s free requests', rate: 'the last model stayed at its per-minute limit', missing: 'the last model is not available to this key' }[reason] || 'the last model stopped working';
  addLabNote(`Switched to ${model}, because ${why}.`);
  renderModes();
}

function setRunning(on) {
  S.running = on;
  if (on) $('toast').hidden = true;
  $('runBtn').disabled = on;
  $('stopBtn').disabled = !on;
  for (const b of $('presetSel').children) b.disabled = on;
  $('resetBtn').disabled = on;
  $('loadLevelBtn').disabled = on;
  for (const b of document.querySelectorAll('.level')) b.disabled = on;
  $('fabRun').textContent = on ? 'See messages' : 'Run';
  renderModes();
  renderTools();
}

async function run() {
  if (S.running) return;
  const task = S.task.trim();
  if (!task) {
    $('runStatus').textContent = 'Type a task first.';
    $('task').focus();
    return;
  }
  const verdict = checkTeam(S.team);
  if (!verdict.ok) {
    const p = verdict.problems[0];
    addAlert(p.limit ? 'limit' : 'err', p.limit ? 'Limit reached' : 'This team can\'t run yet', p.message);
    return;
  }
  const team = JSON.parse(JSON.stringify(S.team));
  const runState = { team, lastText: new Map(), passed: new Set(), lastLimitText: '' };
  S.nodeState.clear();
  renderTree();
  setRunning(true);
  $('runStatus').textContent = S.mode === 'gemini' ? 'Connecting to Gemini…' : 'Running…';
  S.ctl = new AbortController();

  let adapter;
  try {
    adapter = S.mode === 'gemini' ? await geminiAdapter() : await practiceAdapter();
  } catch (err) {
    const stopped = S.ctl?.signal.aborted;
    S.ctl = null;
    setRunning(false);
    if (stopped) {
      $('runStatus').textContent = 'Stopped.';
      addLabNote('Stopped. Nothing else was sent.');
      return;
    }
    // The key check failed, so the next Run checks the key again from the start.
    S.gemini = null;
    S.geminiReady = false;
    $('runStatus').textContent = '';
    addAlert('err', 'Gemini mode could not start', err?.friendly || String(err?.message || err), errorButtons(err?.retryable !== false, err?.kind));
    renderModes();
    return;
  }

  S.runNo += 1;
  const div = el('li', 'divider');
  let source;
  if (adapter.mode === 'practice') {
    adapter.begin(team, task);
    const rec = adapter.replaying;
    div.append(el('span', null, `Run ${S.runNo} · Practice mode`));
    source = rec
      ? `Replaying a real run recorded with ${rec.model} on ${rec.date}.`
      : 'Sample replies: no recorded run matches this exact team and task. Add a Gemini key to see real replies.';
  } else {
    div.append(el('span', null, `Run ${S.runNo} · Gemini`));
    source = `Live replies from ${adapter.model}.`;
  }
  addItem(div);
  addItem(el('li', 'source', source));
  showRunStart(div);
  $('runStatus').textContent = 'Running…';

  const onEvent = ev => {
    switch (ev.type) {
      case 'agent-start': setNode(ev.agentId, 'thinking', PHASE[ev.phase] || 'Working'); break;
      case 'agent-idle': if (['thinking', 'waiting'].includes(S.nodeState.get(ev.agentId)?.state)) setNode(ev.agentId, null); break;
      case 'waiting': setNode(ev.agentId, 'waiting', `Waiting ${ev.seconds}s`); addWait(ev, runState); break;
      case 'message':
        addMessage(ev, runState);
        if (ev.kind === 'job' && ev.from !== 'you') pulse(ev.from, ev.to, 'down');
        else if (ev.kind === 'report') pulse(ev.from, ev.to, 'up');
        else if (ev.kind === 'draft' || ev.kind === 'revise' || ev.kind === 'check') pulse(ev.from, ev.to, 'check');
        break;
      case 'check-result':
        setNode(ev.checkerId, null);
        setNode(ev.agentId, ev.pass ? 'passed' : 'sent-back', ev.pass ? 'Passed' : 'Sent back');
        break;
      case 'limit':
        runState.lastLimitText = ev.message;
        addAlert('limit', ev.fatal ? 'Limit reached' : 'Round limit reached', ev.message);
        break;
      case 'error':
        if (ev.agentId) setNode(ev.agentId, 'error', 'Error');
        addAlert('err', ev.agentId ? `The run stopped at ${who(ev.agentId, runState.team).name}` : 'The run stopped', ev.message, errorButtons(ev.retryable, ev.kind));
        break;
      case 'agent-done': setNode(ev.agentId, 'done', 'Done'); break;
      default: break;
    }
  };

  let res;
  try {
    res = await runTeam(team, task, { adapter, signal: S.ctl.signal, onEvent });
  } catch (err) {
    res = { status: 'error', stats: {}, conversations: {}, instructions: {} };
    addAlert('err', 'The run stopped', `Something went wrong in the lab: ${err?.message || err}. Press Retry, or reload the page.`, errorButtons(true));
  }
  waitTimers.forEach(w => w.end());
  waitTimers = [];
  follow = false;
  for (const [id, st] of S.nodeState) if (st.state === 'thinking' || st.state === 'waiting') setNode(id, null);
  S.last = { conversations: res.conversations || {}, instructions: res.instructions || {} };
  setRunning(false);
  S.ctl = null;
  const st = res.stats || {};
  if (res.status === 'done') {
    const bits = [`Finished in ${(res.ms / 1000).toFixed(1)} s`, `${st.agents} agent${st.agents === 1 ? '' : 's'}`];
    if (st.agentMessages) bits.push(`${st.agentMessages} messages between agents`);
    if (st.checkRounds) bits.push(`${st.checkRounds} check round${st.checkRounds === 1 ? '' : 's'}`);
    if (st.sendBacks) bits.push(`sent back ${st.sendBacks} time${st.sendBacks === 1 ? '' : 's'}`);
    addItem(el('li', 'summary', bits.join(' · ')));
    $('runStatus').textContent = 'Done.';
  } else if (res.status === 'stopped') {
    addLabNote('Stopped. Nothing else was sent.');
    $('runStatus').textContent = 'Stopped.';
  } else {
    $('runStatus').textContent = res.status === 'limit' ? 'Stopped at a limit.' : 'Stopped by an error.';
  }
  const box = $('seesBox');
  if (box) renderSees(box, selected());
}

function stop() {
  if (S.ctl) {
    S.ctl.abort();
    $('runStatus').textContent = 'Stopping…';
  }
}

// ---------- key dialog ----------

function openKeyDialog() {
  const d = $('keyDialog');
  $('keyInput').value = '';
  $('keyInput').placeholder = S.key ? 'A key is saved. Paste a new one to change it.' : 'Paste your key';
  $('keyRemember').checked = Boolean(store.get('localStorage', STORE_KEY));
  $('keyStatus').textContent = S.mode === 'gemini' && S.gemini?.model ? `Using ${S.gemini.model}.` : '';
  $('keyStatus').className = 'key-status';
  $('keyForget').disabled = !S.key;
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  // On a phone, focusing the box opens the keyboard over the steps, so only a mouse or trackpad gets focus here.
  if (typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches) $('keyInput').focus();
}

function closeKeyDialog() {
  const d = $('keyDialog');
  if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
}

async function checkKeyFromDialog() {
  const input = $('keyInput').value.trim().replace(/^["']|["']$/g, '');
  const key = input || S.key;
  const status = $('keyStatus');
  if (!key) {
    status.className = 'key-status bad';
    status.textContent = 'Paste your key first, or use practice mode.';
    return;
  }
  status.className = 'key-status';
  status.textContent = 'Checking the key with Google…';
  $('keyCheck').disabled = true;
  try {
    const mod = await import('./gemini.js');
    const adapter = mod.createGeminiAdapter({ key, onModel: onModelSwitch });
    const info = await adapter.checkKey({ ping: true });
    S.key = key;
    S.gemini = adapter;
    S.geminiReady = true;
    store.set('sessionStorage', STORE_KEY, key);
    if ($('keyRemember').checked) store.set('localStorage', STORE_KEY, key); else store.del('localStorage', STORE_KEY);
    setMode('gemini');
    status.className = 'key-status ok';
    status.textContent = `The key works. Using ${info.model}.`;
    $('keyInput').value = '';
    $('keyForget').disabled = false;
    setTimeout(() => { closeKeyDialog(); toast(`Gemini is on: ${info.model}.`); }, 900);
  } catch (err) {
    status.className = 'key-status bad';
    status.textContent = err?.friendly || 'Gemini mode could not load on this page. Use practice mode for now.';
  } finally {
    $('keyCheck').disabled = false;
  }
}

function forgetKey() {
  store.del('sessionStorage', STORE_KEY);
  store.del('localStorage', STORE_KEY);
  S.key = '';
  S.gemini = null;
  S.geminiReady = false;
  setMode('practice');
  $('keyInput').value = '';
  $('keyRemember').checked = false;
  $('keyForget').disabled = true;
  $('keyStatus').className = 'key-status ok';
  $('keyStatus').textContent = 'Key forgotten on this device. Practice mode is on.';
}

// ---------- wiring ----------

function renderAll() {
  renderModes();
  renderLevels();
  renderTree();
  renderEditor();
  renderTools();
  renderTask();
}

function init() {
  const sel = $('presetSel');
  for (const p of PRESETS) {
    const b = el('button', null, `${p.emoji} ${p.name}`);
    b.type = 'button';
    b.dataset.preset = p.id;
    b.title = p.blurb;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      if (p.id === S.presetId && !S.dirty) return;
      withUndo(`Loaded ${p.name} for level ${S.level}.`, () => loadPreset(p.id));
    });
    sel.append(b);
  }

  const hadLink = location.hash.startsWith('#team=');
  const fromLink = loadFromHash();
  if (hadLink && !fromLink) {
    try { history.replaceState(null, '', location.pathname + location.search); } catch { /* ignore */ }
  }
  if (!fromLink && !loadSaved()) loadPreset(DEFAULT_PRESET, 1);

  S.key = store.get('sessionStorage', STORE_KEY) || store.get('localStorage', STORE_KEY) || '';
  const savedMode = store.get('sessionStorage', STORE_MODE);
  S.mode = S.key && savedMode !== 'practice' ? 'gemini' : 'practice';

  renderAll();
  renderEmpty();
  if (fromLink) toast('Loaded the team from the link.');
  else if (hadLink) toast('That link could not be read, so the lab opened your saved team.');

  for (const b of document.querySelectorAll('.level')) b.addEventListener('click', () => setLevel(Number(b.dataset.level)));
  $('resetBtn').addEventListener('click', () => {
    const p = getPreset(S.presetId);
    withUndo(`Reset to ${p.name} for level ${S.level}.`, () => loadPreset(p.id));
  });
  $('loadLevelBtn').addEventListener('click', () => {
    const p = getPreset(S.presetId);
    withUndo(`Loaded ${p.name} for level ${S.level}.`, () => loadPreset(p.id));
  });
  $('shareBtn').addEventListener('click', async () => {
    const url = shareUrl();
    if (url.length - url.indexOf('#') > SHARE_MAX) {
      toast('This team is too long for a link. Shorten some parts and try again.');
      return;
    }
    if (await copyText(url)) toast('Link copied. It holds the team and task, never your key.');
    else {
      try { history.replaceState(null, '', url); } catch { /* ignore */ }
      toast('Copy the link from the address bar. It holds the team and task, never your key.');
    }
  });
  $('task').addEventListener('input', e => {
    S.task = e.target.value;
    S.taskDirty = true;
    $('runStatus').textContent = '';
    growTask();
    save();
    refreshSoon();
  });
  $('task').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); }
  });
  $('runBtn').addEventListener('click', run);
  $('stopBtn').addEventListener('click', stop);
  $('clearBtn').addEventListener('click', () => { if (!S.running) renderEmpty(); });
  $('addHelperBtn').addEventListener('click', addHelper);
  $('addLeadBtn').addEventListener('click', addLeadAbove);
  $('addCheckerBtn').addEventListener('click', addChecker);
  $('removeBtn').addEventListener('click', removeSelected);

  $('modeChip').addEventListener('click', openKeyDialog);
  $('keyBtn').addEventListener('click', openKeyDialog);
  $('keyClose').addEventListener('click', closeKeyDialog);
  $('keyCheck').addEventListener('click', checkKeyFromDialog);
  $('keyInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); checkKeyFromDialog(); } });
  $('keyPractice').addEventListener('click', () => { setMode('practice'); closeKeyDialog(); toast('Practice mode is on.'); });
  $('keyForget').addEventListener('click', forgetKey);
  $('keyDialog').addEventListener('click', e => { if (e.target === $('keyDialog')) closeKeyDialog(); });

  // On a phone the Run button can be far from the editor; a floating one shows while it is off screen.
  const fab = $('fabRun');
  fab.addEventListener('click', () => {
    if (!S.running) run();
    $('runTitle').closest('section').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  });
  if (typeof IntersectionObserver === 'function') {
    new IntersectionObserver(([e]) => fab.classList.toggle('show', !e.isIntersecting)).observe($('runBtn'));
  }

  let rz = 0;
  let lastW = 0;
  const redraw = () => {
    cancelAnimationFrame(rz);
    rz = requestAnimationFrame(() => {
      const w = $('canvas').clientWidth;
      if (w !== lastW) { lastW = w; fitTree(); growAll(); } else drawWires();
    });
  };
  // Scrolling up during a run stops the list from jumping to each new message.
  thread().addEventListener('scroll', () => {
    if (autoScrolling || !S.running) return;
    const t = thread();
    follow = t.scrollHeight - t.scrollTop - t.clientHeight < 140;
  }, { passive: true });
  window.addEventListener('resize', redraw);
  if (typeof ResizeObserver === 'function') new ResizeObserver(redraw).observe($('canvas'));
  document.fonts?.ready?.then(redraw).catch(() => {});

  S.recordingsReady = loadRecordings(new URL('./examples/', import.meta.url)).then(r => { S.recordings = r; }).catch(() => { S.recordings = []; });
}

init();

// Agent Lab page: levels, team tree, agent editor, run thread, key dialog, saving, share links.
// Every piece of model text, typed text, or link content is put on the page as text nodes, never as HTML.

import {
  runTeam, newAgent, byId, helpersOf, checkerOf, isChecker, checkedBy, roleOf, tops, topAgent,
  checkTeam, windowFor, buildInstructions, sanitizeTeam, depthOf, treeDepth, DEFAULT_LIMITS, COLORS, lines,
} from './engine.js';
import { PRESETS, DEFAULT_PRESET, getPreset, presetTeam, presetTask } from './presets.js';
import { createPracticeAdapter, loadRecordings } from './practice.js';
import { recorder, stepsOf, stepTag, stepLabel, exampleTrace } from './walk.js';
import EXAMPLE_RUN from './example-run.js';

const STORE_TEAM = 'm6-lab-team';
const STORE_KEY = 'm6-lab-key';
const STORE_MODE = 'm6-lab-mode';
const L = DEFAULT_LIMITS;

// Each level's goal names the agents the preset loads, so it matches what is on screen.
const COUNT_WORD = ['no', 'one', 'two', 'three', 'four', 'five'];
const GOALS = {
  1: (p, main) => `${main.name} only has a name and a one-line job. Press Run and read what comes back. Then change the job line and run it again.`,
  2: (p, main) => `${main.name} now has all six parts. Run the same task and compare the answer with level 1. Then change one part and run again.`,
  3: p => `${p.lead.name} hands out jobs to ${COUNT_WORD[p.helpers.length] || p.helpers.length} helpers, puts their work together, and answers you. Press Run, then add a helper of your own.`,
  4: (p, main) => `${p.checker.name} checks ${main.name}'s work against its Done when lines. If a line fails, ${main.name} has to fix it and try again. Press Run, then change a Done when line.`,
};
const PART_KEYS = ['role', 'goal', 'steps', 'rules', 'output', 'doneWhen'];
function goalText(level, presetId) {
  const p = getPreset(presetId);
  // At level 2 a changed team may be the student's own bare agent from Build 1, so the line names that agent
  // and asks for the parts it is missing instead of saying they are already there.
  if (level === 1 && S.dirty) {
    const a = topAgent(S.team);
    if (a) return GOALS[1](p, a);
  }
  if (level === 2 && S.dirty) {
    const a = selected();
    const target = a && !isChecker(S.team, a.id) ? a : (topAgent(S.team) || a);
    if (target) {
      const empty = PART_KEYS.every(k => (Array.isArray(target[k]) ? !target[k].length : !String(target[k] || '').trim()));
      return empty
        ? `Fill in the six parts for ${target.name}, then run the same task again and compare the two answers.`
        : `Change one of ${target.name}'s six parts, then run the same task again and compare the two answers.`;
    }
  }
  return GOALS[level](p, p.helpers.find(h => h.id === p.main) || p.helpers[0]);
}

const PART_FIELDS = [
  { key: 'role', label: 'Role', hint: 'Who the agent is.', ph: 'Example: You write flyers for a college club\'s events.', rows: 2 },
  { key: 'goal', label: 'Goal', hint: 'What it should make, and why.', ph: 'Example: A flyer that gets students to come to game night.', rows: 2 },
  { key: 'steps', label: 'Steps', hint: 'What to do, in order. One step per line.', ph: 'Example:\nFind the day, time, and room\nWrite a short headline\nEnd with one thing to do', rows: 4 },
  { key: 'rules', label: 'Rules', hint: 'What it must always or never do. One rule per line.', ph: 'Example:\nUse only facts from the task\nNo hashtags', rows: 3 },
  { key: 'output', label: 'Output', hint: 'What the answer should look like.', ph: 'Example: The flyer text only, ready to print.', rows: 2 },
  { key: 'doneWhen', label: 'Done when', hint: 'The work is done when every line here passes. One line each.', ph: 'Example:\nHas the day, time, and room\nUnder 40 words', rows: 3 },
];

// The deck's part icons (slide 10 draws Done when the same way).
const PART_ICONS = {
  role: ['M12 11.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5z', 'M4.5 20.5a7.5 7.5 0 0 1 15 0'],
  goal: ['M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M12 12.2v-.4'],
  steps: ['M9.5 6.5h10M9.5 12h10M9.5 17.5h10', 'M4.5 6.5h.5M4.5 12h.5M4.5 17.5h.5'],
  rules: ['M12 3.2l7 2.8v5.2c0 4.3-2.9 7.6-7 9.6-4.1-2-7-5.3-7-9.6V6z', 'M9 12l2.2 2.2L15.5 10'],
  output: ['M6 3h8.5L19 7.5V21H6z', 'M14 3v5h5', 'M9 12.5h7M9 16.5h5'],
  doneWhen: ['M7.5 4h9A3.5 3.5 0 0 1 20 7.5v9a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 4 16.5v-9A3.5 3.5 0 0 1 7.5 4z', 'M8.5 12.2l2.4 2.4 4.8-5.2'],
};
function partIcon(key) {
  const svg = svgEl('svg', { class: 'ic', viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  for (const d of PART_ICONS[key] || []) svg.append(svgEl('path', { d }));
  return svg;
}

const PHASE = { plan: 'Planning', work: 'Working', combine: 'Putting it together', check: 'Checking', revise: 'Fixing', ping: 'Checking' };
const KIND = { job: 'job', note: 'plan', draft: 'first draft', check: 'check', revise: 'new version', report: 'report', final: 'final answer' };
const NEW_EMOJI = ['🤖', '🧠', '🎨', '🔎', '💡', '🛠️', '📣', '🧾'];
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = id => document.getElementById(id);
const PHONE = () => typeof matchMedia === 'function' && matchMedia('(max-width: 700px)').matches;
const WIDE = () => !PHONE() && innerWidth >= 1200;

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
  stats: { msgs: 0, rounds: 0, calls: 0 },
  unread: 0,
  nodeState: new Map(),
  paths: new Map(),
};

// The walk-through in progress (null when off). See walk.js and the walk-through section below.
let W = null;

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
  // During a walk-through the canvas shows the run's team, never saved over yours.
  if (W) return;
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
  const mp = $('modelPill');
  if (mp) { mp.textContent = modelPillText(); mp.hidden = S.mode !== 'gemini'; }
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
  const tag = `Level ${S.level}`;
  const note = $('goalNote');
  if ($('goalTag').textContent !== tag && !REDUCED) { note.classList.remove('swap'); void note.offsetWidth; note.classList.add('swap'); }
  $('goalTag').textContent = tag;
  $('levelGoal').textContent = goalText(S.level, S.presetId);
  for (const b of $('presetSel').children) b.setAttribute('aria-pressed', String(b.dataset.preset === S.presetId));
  const p = getPreset(S.presetId);
  $('teamMenuCur').replaceChildren(el('span', 'em', p.emoji), el('span', 'nm', ` ${p.name}`));
  $('dirtyNote').hidden = !S.dirty;
  $('loadLevelBtn').textContent = `Load ${p.name} for level ${S.level}`;
  renderTaskNote();
}

// A task typed at level 1 or 2 stays at every level; at a team level, say so and offer the preset's team task.
function renderTaskNote() {
  const p = getPreset(S.presetId);
  const teamTask = presetTask(S.presetId, S.level);
  const show = S.level >= 3 && S.taskDirty && S.task.trim() !== teamTask.trim();
  $('taskNote').hidden = !show;
  if (show) $('teamTaskBtn').textContent = `Use the ${p.name} team task`;
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
  // Levels 1 and 2 are about one agent's card; levels 3 and 4 are about the team, so the tree gets the room.
  if (n >= 3) closeSheet();
  else if (WIDE()) openSheet('agent');
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
  if (!S.dirty) { S.dirty = true; renderLevels(); } else if (S.level === 2) $('levelGoal').textContent = goalText(S.level, S.presetId);
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
  b.addEventListener('click', () => { if (W) return; S.selectedId = agent.id; save(); renderTreeSelection(); renderEditor(); renderTools(); openSheet('agent'); });
  return b;
}

// ---------- side sheet (the selected agent, or Messages) ----------

// The agent card and Messages are two floating panels on the right. Both stay open on a wide screen;
// on a smaller one (or a phone, where they are bottom sheets) opening one closes the other.
const BOTH_FIT = () => !PHONE() && innerWidth >= 1500;
const chatOpen = () => 'chat' in document.body.dataset;

function openSheet(tab) {
  if (tab === 'messages') {
    document.body.dataset.chat = '';
    if (!BOTH_FIT()) delete document.body.dataset.sheet;
    S.unread = 0;
    renderCount();
  } else {
    document.body.dataset.sheet = 'agent';
    if (!BOTH_FIT()) delete document.body.dataset.chat;
    requestAnimationFrame(growAll);
  }
  $('msgsBtn').setAttribute('aria-expanded', String(chatOpen()));
  requestAnimationFrame(fitTree);
}

function closeSheet() {
  delete document.body.dataset.sheet;
  requestAnimationFrame(fitTree);
}

function closeChat() {
  delete document.body.dataset.chat;
  $('msgsBtn').setAttribute('aria-expanded', 'false');
  requestAnimationFrame(fitTree);
}

function renderCount() {
  $('msgCount').textContent = S.unread > 0 && !chatOpen() ? String(S.unread) : '';
}

// ---------- run stats (the HUD tiles) ----------

function setStat(id, n) {
  const num = $(id);
  if (num.textContent === String(n)) return;
  num.textContent = String(n);
  const tile = num.closest('.tile');
  if (!REDUCED && tile) { tile.classList.remove('bump'); void tile.offsetWidth; tile.classList.add('bump'); }
}

function resetStats() {
  S.stats = { msgs: 0, rounds: 0, calls: 0 };
  if (S.runNo > 0) $('stats').hidden = false;
  setStat('statAgents', S.team.agents.length);
  setStat('statMsgs', 0);
  setStat('statRounds', 0);
  setStat('statCalls', 0);
  $('statCallsSub').textContent = 'times this run';
}

// Agents whose work a checker sent back this run stay pink until a check passes.
const sentBack = new Set();

function applyNodeState(b, st) {
  b.classList.toggle('back', sentBack.has(b.dataset.id));
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
  // "You" sits above the top agent, as on slide 18: your task goes down this line and the answer comes back up it.
  if (roots.length === 1) {
    const you = el('div', 'you-pill', 'You');
    you.id = 'youPill';
    tree.append(you);
  }
  // The built-in example is labeled on the canvas, above the team.
  if (W?.trace.example) {
    const badge = el('div', 'walk-badge', 'Example');
    badge.id = 'walkBadge';
    tree.prepend(badge);
  }
  tree.append(roots.length > 1 ? row : (row.firstChild || el('p', 'hint', 'No agents yet.')));
  requestAnimationFrame(fitTree);
  renderFaces();
  if (!S.running) setStat('statAgents', S.team.agents.length);
}

// The chat's title bar shows the team's faces, like the deck's group chat.
function renderFaces() {
  const faces = $('faces');
  faces.replaceChildren();
  const agents = S.team.agents;
  for (const a of agents.slice(0, 5)) {
    const f = el('span', null, a.emoji || '🤖');
    f.style.setProperty('--c', a.color);
    faces.append(f);
  }
  const n = agents.length;
  $('chatSub').textContent = n === 1 ? `You and ${agents[0].name || 'your agent'}` : `You and ${n} agents`;
}

function modelPillText() {
  return S.mode === 'gemini' ? `Model: ${S.geminiReady && S.gemini?.model ? S.gemini.model : 'Gemini'}` : 'Practice mode';
}

// A wide team stacks each checker under its agent instead of beside it, so the tree fits without scrolling.
// How much of the right edge the open panels take, in px.
function rightRoom() {
  const gap = PHONE() ? 8 : 14;
  if (PHONE()) return gap;
  let rw = gap;
  if (W) rw += $('walkCard').offsetWidth + gap;
  else if (document.body.dataset.sheet) rw += $('sheet').offsetWidth + gap;
  if (chatOpen()) rw += $('chatDock').offsetWidth + gap;
  return rw;
}

// Measure the floating cards, and move the top right buttons under the HUD when they would run into it.
function sizeVars() {
  const body = document.body;
  body.style.setProperty('--hud-h', `${Math.round($('hud').getBoundingClientRect().height)}px`);
  body.style.setProperty('--dock-h', `${Math.round((W ? $('walkBar') : $('dock')).getBoundingClientRect().height)}px`);
  if (PHONE()) { body.classList.remove('tools-under', 'tools-tight', 'dock-wide'); return; }
  const free = innerWidth - rightRoom();
  body.classList.toggle('tools-tight', free < 1150);
  body.classList.remove('tools-under');
  const hud = $('hud').getBoundingClientRect();
  const tools = $('topTools').getBoundingClientRect();
  body.classList.toggle('tools-under', tools.left < hud.right + 12);
  // Where the dock's left edge ends up (it slides when a panel opens, so work it out instead of measuring).
  body.classList.toggle('dock-wide', 14 + Math.max(0, (free - 14 - 720) / 2) < 190);
}

let userZoom = 1; // set by the − and + buttons and Ctrl or ⌘ plus scroll; Reset view puts it back to 1

function fitTree() {
  const canvas = $('canvas');
  const box = $('treeBox');
  const stage = $('stage');
  box.style.zoom = '';
  canvas.classList.remove('compact', 'tight');
  if (!PHONE()) {
    // The tree goes beside the HUD or below it, whichever leaves it bigger.
    sizeVars();
    const hud = $('hud').getBoundingClientRect();
    const tools = $('topTools').getBoundingClientRect();
    const under = document.body.classList.contains('tools-under');
    const padR = rightRoom() + 16;
    const padB = (W ? $('walkBar') : $('dock')).getBoundingClientRect().height + 14 + 14;
    const w = box.offsetWidth || 1, h = box.offsetHeight || 1;
    const beside = { l: Math.max(hud.right, under ? tools.right : 0) + 20, t: (under ? 14 : tools.bottom) + 16 };
    const top = Math.max(hud.bottom, under ? tools.bottom : 0) + 16;
    const opts = [beside, { l: 32, t: Math.max(top, tools.bottom + 16) }];
    // When Reset view sits under the HUD (the dock fills the bottom), keep the tree clear of it too.
    if (document.body.classList.contains('dock-wide')) {
      const vt = $('viewTools').getBoundingClientRect();
      opts[1] = { l: vt.right + 16, t: Math.max(top, tools.bottom + 16) };
      opts.push({ l: 32, t: Math.max(vt.bottom + 12, tools.bottom + 16) });
    }
    const score = p => Math.min(1, (canvas.clientWidth - p.l - padR) / w, (canvas.clientHeight - p.t - padB) / h);
    const pick = opts.reduce((a, b) => (score(b) > score(a) ? b : a));
    document.body.style.setProperty('--pad-l', `${Math.round(pick.l)}px`);
    document.body.style.setProperty('--pad-t', `${Math.round(pick.t)}px`);
  }
  const cs = getComputedStyle(stage);
  // The open area: right of or below the HUD, left of the open panels, above the dock.
  const availW = canvas.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const availH = canvas.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  // Too wide: first narrower cards, then each checker under its agent.
  if (box.offsetWidth > availW) canvas.classList.add('tight');
  if (box.offsetWidth * 0.8 > availW) canvas.classList.add('compact');
  // Then the whole team shrinks to fit the screen, like a camera zooming out (never below 35%),
  // and the − and + buttons zoom further out or in from there.
  const fit = PHONE() ? 1 : Math.max(0.35, Math.min(1, availW / box.offsetWidth, availH / box.offsetHeight));
  const z = Math.max(0.25, Math.min(1.6, fit * userZoom));
  if (Math.abs(z - 1) > 0.01) box.style.zoom = String(Math.round(z * 100) / 100);
  drawWires();
}

function renderTreeSelection() {
  const id = selected()?.id;
  for (const b of document.querySelectorAll('.node')) b.setAttribute('aria-pressed', String(b.dataset.id === id));
}

// Positions inside the tree box, in its own (unzoomed) units, so the wires line up at any zoom.
function rectIn(node, box) {
  const r = node.getBoundingClientRect();
  const k = box.k || 1;
  const l = (r.left - box.left) / k, t = (r.top - box.top) / k, w = r.width / k, h = r.height / k;
  return { l, r: l + w, t, b: t + h, cx: l + w / 2, cy: t + h / 2 };
}

function drawWires() {
  const svg = $('wires');
  const boxEl = $('treeBox');
  const box = boxEl.getBoundingClientRect();
  // Some browsers report zoomed sizes and some don't; measuring both handles either.
  box.k = boxEl.offsetWidth ? box.width / boxEl.offsetWidth : 1;
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
  const youEl = $('youPill');
  const topA = topAgent(S.team);
  if (youEl && topA && nodeOf(topA.id)) {
    const y = rectIn(youEl, box);
    const t = rectIn(nodeOf(topA.id), box);
    const d = `M${y.cx} ${y.b + 2} L${t.cx} ${t.t - 15}`;
    const path = svgEl('path', { d, class: 'wire you' });
    svg.append(path);
    S.paths.set(`you>${topA.id}`, { d, path });
  }
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
  if (W) litWalk();
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
    // Only the reasons a button is off; the pink ring already shows which agent is selected.
    $('treeHint').textContent = [...new Set(merged.map(([, r]) => r))].join('\n');
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

function field({ id, label, hint, value, multiline, rows = 2, placeholder, wide, onInput, maxLength = 1500, icon }) {
  const f = el('div', `field${wide ? ' wide' : ''}${icon ? ' part' : ''}`);
  if (icon) f.append(partIcon(icon));
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
  input.addEventListener('input', () => { onInput(input.value); warnIfKey(input.value); });
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
  const hdText = el('div', 'ed-title');
  const topLine = el('div', 'top-line');
  const pill = el('span', `role-pill ${role}`, roleLabel(role));
  const h2 = el('h2', null, a.name || 'Agent');
  h2.id = 'edName';
  topLine.append(pill, h2);
  const rel = el('p', 'hint ed-rel', relLine(a));
  hdText.append(el('span', 'sr', 'Selected agent: '), topLine, rel);
  const mp = el('span', 'model-pill', modelPillText());
  mp.id = 'modelPill';
  // The header chip already says Practice mode; the card names the model only with a key.
  mp.hidden = S.mode !== 'gemini';
  hd.append(av, hdText, mp);
  ed.append(hd);

  // Two columns at projector widths: Name, Look, Job, Role, Goal (and Steps at level 4) on the left;
  // the other parts and the check loop on the right. One column on a phone.
  const grid = el('div', 'ed-cols');
  const colA = el('div', 'ed-col');
  const colB = el('div', 'ed-col need-2');
  const basics = el('div', 'basics');
  basics.append(field({
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
  basics.append(look);

  basics.append(field({
    id: 'f-job', label: 'Job', wide: true, value: a.job, maxLength: 300,
    hint: a.parentId ? `One line: what this agent does. ${byId(S.team, a.parentId)?.name || 'Its lead'} reads this line too.` : 'One line: what this agent does.',
    placeholder: role === 'checker' ? 'Example: Checks the flyer against its Done when list.' : 'Example: Writes the game night flyer.',
    onInput: v => { a.job = v; markDirty(); renderTree(); refreshSoon(); },
  }));
  colA.append(basics);

  const parts = el('div', 'part-group need-2');
  parts.append(el('span', 'label', 'The six parts'), el('p', 'hint', 'Each part goes into the instructions under its own heading. Empty parts are skipped.'));
  const pgA = el('div', 'fields');
  parts.append(pgA);
  colA.append(parts);
  const partsB = el('div', 'part-group');
  const pgB = el('div', 'fields');
  partsB.append(pgB);
  colB.append(partsB);
  for (const p of PART_FIELDS) {
    // Steps sits on the right unless the check loop box fills that column, so the two stay close in height.
    const leftKeys = S.level >= 4 && role !== 'checker' ? ['role', 'goal', 'steps'] : ['role', 'goal'];
    const pg = leftKeys.includes(p.key) ? pgA : pgB;
    if (p.key === 'doneWhen' && role === 'checker') {
      const t = checkedBy(S.team, a.id);
      const box = el('div', 'field wide part');
      box.append(partIcon('doneWhen'), el('span', 'label', 'Done when'));
      const items = t?.doneWhen || [];
      box.append(el('p', 'hint', items.length ? `${a.name} checks ${t.name}'s Done when lines, one by one:` : `${t ? t.name : 'Its agent'} has no Done when lines yet. Select ${t ? t.name : 'it'} and add two or three.`));
      if (items.length) {
        const ul = el('ul', 'ck-list');
        for (const it of items) ul.append(el('li', null, it));
        box.append(ul);
      }
      pg.append(box);
      continue;
    }
    const value = p.key === 'doneWhen' ? a.doneWhen.join('\n') : a[p.key];
    pg.append(field({
      id: `f-${p.key}`, label: p.label, hint: p.hint, value, multiline: true, rows: p.rows, placeholder: p.ph, wide: true, icon: p.key,
      onInput: v => { a[p.key] = p.key === 'doneWhen' ? lines(v).slice(0, 8) : v; markDirty(); refreshSoon(); if (p.key === 'doneWhen') renderCheckBox(); },
    }));
  }

  if (role !== 'checker') {
    const cb = el('div', 'chk-box need-4');
    cb.id = 'chkBox';
    colB.append(cb);
  }
  grid.append(colA, colB);
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
    cb.append(el('span', 'label', 'Check loop'), el('p', 'hint', `No checker yet. Press + Checker to add a new agent that checks ${a.name}'s work against its Done when lines.`));
    return;
  }
  cb.append(el('span', 'label', `Checked by ${chk.name}`));
  cb.append(el('p', 'hint', `${chk.name} checks every Done when line. If one fails, ${a.name} gets the work back with notes.`));
  if (!a.doneWhen.length) cb.append(el('p', 'warn', `Add Done when lines above. Without them, ${chk.name} can only check "Does the job it was given".`));
  else {
    const ul = el('ul', 'ck-list');
    for (const it of a.doneWhen) ul.append(el('li', null, it));
    cb.append(ul);
  }
  const cap = el('div', 'cap');
  const lab = el('span', 'cap-pill', 'Max rounds');
  lab.id = 'roundsLabel';
  const row = el('div', 'rounds');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-labelledby', 'roundsLabel');
  const dots = el('span', 'dots');
  dots.setAttribute('aria-hidden', 'true');
  const paintDots = () => {
    dots.replaceChildren();
    for (let n = 1; n <= L.maxRounds; n += 1) dots.append(el('i', n <= a.maxRounds ? 'on' : null));
  };
  for (let n = 1; n <= L.maxRounds; n += 1) {
    const b = el('button', null, String(n));
    b.type = 'button';
    b.setAttribute('aria-pressed', String(a.maxRounds === n));
    b.setAttribute('aria-label', `${n} round${n === 1 ? '' : 's'}`);
    b.addEventListener('click', () => {
      a.maxRounds = n;
      for (const x of row.children) x.setAttribute('aria-pressed', String(x === b));
      paintDots();
      markDirty();
    });
    row.append(b);
  }
  paintDots();
  cap.append(lab, row, dots);
  const hint = el('p', 'hint', `After this many failed checks, the run moves on with ${a.name}'s last version.`);
  cb.append(cap, hint);
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
  t.style.paddingBottom = '';
  t.style.minHeight = '';
  t.style.height = 'auto';
  // Cap the box on a whole line, so it never ends with half a line showing.
  const cs = getComputedStyle(t);
  const lh = parseFloat(cs.lineHeight) || 23;
  const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const want = Math.min(280, t.scrollHeight + 4);
  t.style.height = `${want}px`;
  // The CSS max-height may have clamped the box; round what is left down to whole lines.
  const got = t.getBoundingClientRect().height;
  // Text shows through the bottom padding, so a capped box drops it and ends exactly on a line.
  if (got < t.scrollHeight + 3) {
    const lines = Math.max(2, Math.floor((got - pad) / lh));
    t.style.paddingBottom = '0px';
    t.style.minHeight = '0px';
    t.style.height = `${lines * lh + parseFloat(cs.paddingTop)}px`;
  }
}

// ---------- thread ----------

const thread = () => $('thread');
let waitTimers = [];

function renderEmpty() {
  const li = el('li', 'empty');
  li.append(el('b', null, 'No messages yet'), document.createTextNode('Press Run to start, or see a finished run first.'));
  const ex = el('button', 'btn small ex-btn', 'See an example');
  ex.type = 'button';
  ex.addEventListener('click', () => startExample(ex));
  li.append(el('br'), ex);
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
    li.style.setProperty('--c', from.color);
    const hd = el('div', 'final-hd');
    const ft = el('div', 'ft');
    const fav = el('span', 'msg-av', from.emoji);
    fav.setAttribute('aria-hidden', 'true');
    const fw = el('div');
    fw.append(el('span', 'tag', `${from.name} → You`), el('b', null, `Final answer from ${from.name}`));
    ft.append(fav, fw);
    hd.append(ft);
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

  const li = el('li', `msg ${m.from === 'you' ? 'you' : ''} ${m.kind === 'note' ? 'note' : ''} ${m.kind === 'check' ? 'check' : ''}`);
  li.style.setProperty('--c', from.color);
  li.style.setProperty('--c2', to.color);
  const av = el('div', 'msg-av', from.emoji);
  av.setAttribute('aria-hidden', 'true');
  const body = el('div', 'msg-body');
  const head = el('p', 'msg-from');
  head.append(el('span', 'who', from.name), el('span', 'arrow', '→'), el('span', 'to', to.name));
  // Check and fix messages say their round in the header, like the deck's group chat.
  if ((m.kind === 'check' || m.kind === 'revise') && m.round) head.append(el('span', 'rnd', `· round ${m.round}`));
  // A check already shows its ticks and round, so it needs no kind pill.
  if (m.kind !== 'check') head.append(el('span', `kind ${m.kind}`, m.from === 'you' ? 'task' : KIND[m.kind] || m.kind));
  body.append(head);
  const bub = el('div', 'bub');
  if (m.kind === 'check') {
    bub.append(checklist(m.checks || []));
    const v = el('div', 'verdict');
    const dots = el('span', 'dots');
    dots.setAttribute('aria-hidden', 'true');
    for (let n = 1; n <= m.maxRounds; n += 1) dots.append(el('i', n <= m.round ? 'on' : null));
    v.append(dots, el('span', 'round-badge', `Round ${m.round} of ${m.maxRounds}`));
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
  if (['nokey', 'badKey', 'leaked', 'denied', 'disabled', 'nomodel', 'request'].includes(kind)) out.push(['Change key', () => openKeyDialog()]);
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

// A key pasted into the task or a part would be saved with the team, sent to Google as text, and put in share links.
// Google's older keys start with AIza; a long run of letters and digits with no spaces gets the same warning.
// (No lookbehind: older iPhone Safari can't parse it, and a parse error would stop the whole page.)
const KEY_LIKE = /\bAIza[0-9A-Za-z_-]{30,}|(?:^|\s)(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{36,}(?:\s|$)/;
let keyWarned = false;
function warnIfKey(text) {
  const hit = KEY_LIKE.test(String(text || ''));
  if (hit && !keyWarned) toast('That looks like a Gemini key. Delete it here and paste it in "Add a Gemini key" instead.');
  keyWarned = hit;
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
  if (reason === 'back') {
    addLabNote(`Back to ${model}: a minute has passed since it hit its per-minute limit.`);
  } else {
    const why = { daily: 'the last model used up today\'s free requests', rate: 'the last model stayed at its per-minute limit', missing: 'the last model is not available to this key', noquota: 'the last model has no free requests for this key' }[reason] || 'the last model stopped working';
    addLabNote(`Switched to ${model}, because ${why}.`);
  }
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
  for (const b of document.querySelectorAll('.level')) b.disabled = on || !!W;
  $('exampleBtn').disabled = on;
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
  sentBack.clear();
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
  // Watches the messages and what each agent was sent, for Walk through. The calls and their order stay the same.
  const rec = recorder(adapter);
  S.lastTrace = null;
  renderWalkBtns();
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
  resetStats();
  S.unread = 0;
  // On a wide screen Messages opens beside the team; on a smaller one it opens when the run ends, so the team stays in view.
  if (WIDE()) openSheet('messages'); else { closeSheet(); renderCount(); }
  showRunStart(div);
  $('runStatus').textContent = 'Running…';

  const onEvent = ev => {
    switch (ev.type) {
      case 'agent-start': {
        const lab = PHASE[ev.phase] || 'Working';
        setNode(ev.agentId, 'thinking', ev.round > 1 && (ev.phase === 'check' || ev.phase === 'revise') ? `${lab}, round ${ev.round}` : lab);
        S.stats.calls += 1;
        setStat('statCalls', S.stats.calls);
        break;
      }
      case 'agent-idle': if (['thinking', 'waiting'].includes(S.nodeState.get(ev.agentId)?.state)) setNode(ev.agentId, null); break;
      case 'waiting': setNode(ev.agentId, 'waiting', `Waiting ${ev.seconds}s`); addWait(ev, runState); break;
      case 'message':
        rec.onMessage(ev);
        addMessage(ev, runState);
        if (!ev.lab) {
          if (ev.from !== 'you' && ev.to !== 'you' && ev.to !== 'team') { S.stats.msgs += 1; setStat('statMsgs', S.stats.msgs); }
          if (!chatOpen()) { S.unread += 1; renderCount(); }
        }
        if (ev.kind === 'job') pulse(ev.from, ev.to, 'down');
        else if (ev.kind === 'final') pulse(ev.from, ev.to, 'up');
        else if (ev.kind === 'report') pulse(ev.from, ev.to, 'up');
        else if (ev.kind === 'draft' || ev.kind === 'revise' || ev.kind === 'check') pulse(ev.from, ev.to, 'check');
        break;
      case 'check-result':
        S.stats.rounds += 1;
        setStat('statRounds', S.stats.rounds);
        if (ev.pass) sentBack.delete(ev.agentId); else sentBack.add(ev.agentId);
        // A checker whose check passed keeps a Done badge, like every other agent at the end.
        setNode(ev.checkerId, ev.pass ? 'done' : null, ev.pass ? 'Done' : undefined);
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
  const tr = rec.trace(team, task, { status: res.status });
  S.lastTrace = tr.messages.length > 1 ? tr : null;
  setRunning(false);
  renderWalkBtns();
  S.ctl = null;
  const st = res.stats || {};
  if (Number.isFinite(st.calls)) setStat('statCalls', st.calls);
  $('statCallsSub').textContent = `times this run (limit ${L.maxCalls})`;
  if (!WIDE() && res.status === 'done') openSheet('messages');
  if (res.status === 'done') {
    const bits = [`Finished in ${(res.ms / 1000).toFixed(1)} s`, `${st.agents} agent${st.agents === 1 ? '' : 's'}`];
    if (st.agentMessages) bits.push(`${st.agentMessages} messages between agents`);
    if (st.checkRounds) bits.push(`${st.checkRounds} check round${st.checkRounds === 1 ? '' : 's'}`);
    if (st.sendBacks) bits.push(`sent back ${st.sendBacks} time${st.sendBacks === 1 ? '' : 's'}`);
    addItem(el('li', 'summary', bits.join(' · ')));
    if (S.lastTrace) {
      // On a phone this sheet covers the dock, so Walk through is offered here too.
      const li = el('li', 'summary');
      const wb = el('button', 'btn small walk-again', 'Walk through this run');
      wb.type = 'button';
      wb.addEventListener('click', () => startWalk(S.lastTrace, $('walkBtn')));
      li.append(wb);
      addItem(li);
    }
    $('runStatus').textContent = 'Done. The final answer is at the end of Messages.';
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

// ---------- walk-through and the built-in example ----------
// One code path: a trace (your last run, or the recorded Game Night example) becomes steps, one message per step.
// While walking, the canvas shows the trace's team. Your team, task, panels, and numbers come back on Exit.

const EXAMPLE_LINE = 'Example: a real run of the Game Night team, recorded Oct 27 with Gemini. Your own runs show up here when you press Run.';
const WALK_MS = 2500;

function renderWalkBtns() {
  const show = !!S.lastTrace && !S.running && !W;
  $('walkBtn').hidden = !show;
  $('walkBtn2').hidden = !show;
}

async function startExample(from) {
  if (S.running || W) return;
  let trace;
  try {
    trace = await exampleTrace(EXAMPLE_RUN);
  } catch (err) {
    toast(`The example could not load: ${err?.message || err}`);
    return;
  }
  startWalk(trace, from);
}

function startWalk(trace, from) {
  if (S.running || W || !trace) return;
  const steps = stepsOf(trace);
  if (!steps.length) return;
  W = {
    trace, steps, i: 0, timer: 0, from,
    saved: {
      team: S.team, selectedId: S.selectedId, nodeState: new Map(S.nodeState), sentBack: new Set(sentBack),
      sheet: document.body.dataset.sheet, chat: chatOpen(), statsHidden: $('stats').hidden,
      stats: ['statAgents', 'statMsgs', 'statRounds', 'statCalls', 'statCallsSub'].map(id => [id, $(id).textContent]),
      thread: null, level: document.body.dataset.level,
    },
  };
  // The example is a level 4 team, so its message and check-round tiles show at any level.
  if (trace.example) document.body.dataset.level = '4';
  S.team = trace.team;
  S.selectedId = null;
  S.nodeState.clear();
  sentBack.clear();
  document.body.dataset.walk = trace.example ? 'example' : 'run';
  closeSheet();
  if (trace.example) {
    // The example gets its own thread in Messages, labeled; yours is put back on Exit.
    const frag = document.createDocumentFragment();
    frag.append(...thread().childNodes);
    W.saved.thread = frag;
    const line = el('li', 'ex-line');
    line.append(el('b', null, 'Example'), document.createTextNode(EXAMPLE_LINE));
    thread().replaceChildren(line);
    const runState = { team: trace.team, lastText: new Map(), passed: new Set(), lastLimitText: '' };
    for (const m of trace.messages) addMessage(m, runState);
    $('chatTitle').textContent = 'Messages · Example';
  }
  if (!BOTH_FIT() || !trace.example) closeChat();
  for (const b of document.querySelectorAll('.level')) b.disabled = true;
  $('teamMenuBtn').disabled = true;
  $('exampleBtn').disabled = true;
  const ex = $('walkEx');
  ex.hidden = !trace.example;
  ex.replaceChildren(el('b', null, 'Example'), document.createTextNode(EXAMPLE_LINE));
  $('stats').hidden = false;
  setStat('statAgents', trace.team.agents.length);
  $('statCallsSub').textContent = 'times so far';
  $('walkCard').hidden = false;
  $('walkBar').hidden = false;
  renderWalkBtns();
  renderTree();
  renderTools();
  // The bar can wrap to two rows on a phone, so keep the card's bottom edge above it whenever its height changes.
  const setBar = () => document.documentElement.style.setProperty('--walkbar', `${$('walkBar').offsetHeight || 72}px`);
  setBar();
  if (!startWalk.barObserver && 'ResizeObserver' in window) { startWalk.barObserver = new ResizeObserver(setBar); startWalk.barObserver.observe($('walkBar')); }
  requestAnimationFrame(() => { walkTo(0); $('walkNext').focus({ preventScroll: true }); });
}

function exitWalk() {
  if (!W) return;
  const { saved, from } = W;
  clearInterval(W.timer);
  W = null;
  delete document.body.dataset.walk;
  document.body.dataset.level = saved.level;
  S.team = saved.team;
  S.selectedId = saved.selectedId;
  S.nodeState = saved.nodeState;
  sentBack.clear();
  for (const id of saved.sentBack) sentBack.add(id);
  if (saved.thread) {
    thread().replaceChildren(saved.thread);
    $('chatTitle').textContent = 'Messages';
  }
  for (const [id, v] of saved.stats) $(id).textContent = v;
  $('stats').hidden = saved.statsHidden;
  $('walkCard').hidden = true;
  $('walkBar').hidden = true;
  $('teamMenuBtn').disabled = false;
  setRunning(false);
  if (saved.sheet) openSheet('agent');
  if (saved.chat) openSheet('messages'); else closeChat();
  renderTree();
  renderEditor();
  renderTools();
  renderWalkBtns();
  const back = from && !from.hidden && from.isConnected ? from : $('exampleBtn');
  back.focus({ preventScroll: true });
}

function setPlaying(on) {
  if (!W) return;
  clearInterval(W.timer);
  W.timer = 0;
  if (on && W.i >= W.steps.length - 1) walkTo(0);
  if (on) W.timer = setInterval(() => { if (!W) return; if (W.i >= W.steps.length - 1) setPlaying(false); else walkTo(W.i + 1); }, WALK_MS);
  $('walkPlay').textContent = on ? 'Pause' : 'Play';
  $('walkPlay').setAttribute('aria-pressed', String(on));
}

function walkNode(id) {
  if (id === 'you') return $('youPill');
  if (id === 'team') return null;
  return document.querySelector(`.node[data-id="${CSS.escape(id)}"]`);
}

function walkTo(i) {
  if (!W) return;
  W.i = Math.max(0, Math.min(W.steps.length - 1, i));
  const step = W.steps[W.i];
  const team = W.trace.team;
  // Agents whose latest check up to this step failed show pink, as in a live run.
  sentBack.clear();
  for (const s of W.steps.slice(0, W.i + 1)) if (s.kind === 'check') { if (s.pass) sentBack.delete(s.to); else sentBack.add(s.to); }
  for (const b of document.querySelectorAll('.node')) { b.classList.remove('w-on', 'w-to'); applyNodeState(b, null); }
  $('youPill')?.classList.remove('w-on');
  const fromEl = walkNode(step.from);
  const toEl = step.to === 'team' ? null : walkNode(step.to);
  fromEl?.classList.add('w-on');
  toEl?.classList.add('w-on', 'w-to');
  if (step.to === 'team') for (const a of team.agents) if (a.parentId === step.from) walkNode(a.id)?.classList.add('w-on');
  litWalk();
  if (step.to !== 'team') {
    pulse(step.from, step.to, step.kind === 'job' ? 'down' : ['draft', 'revise', 'check'].includes(step.kind) ? 'check' : 'up');
  }

  $('walkTag').textContent = stepTag(step, team);
  $('walkLabel').textContent = stepLabel(step, team);
  const msg = $('walkMsg');
  msg.replaceChildren();
  if (step.kind === 'check') {
    msg.append(checklist(step.checks || []));
    if (step.text && !step.pass) {
      const fb = el('p', 'fb');
      fb.append(el('strong', null, 'What to fix: '), document.createTextNode(step.text));
      msg.append(fb);
    }
  } else {
    msg.append(rich(step.text || ''));
  }
  msg.scrollTop = 0;
  const sawBtn = $('walkSawBtn');
  const saw = $('walkSaw');
  sawBtn.hidden = !step.saw;
  const open = !!step.saw && sawBtn.getAttribute('aria-expanded') === 'true';
  saw.hidden = !open;
  if (open) renderSaw(step);

  $('walkCount').textContent = `Step ${W.i + 1} of ${W.steps.length}`;
  $('walkBack').disabled = W.i === 0;
  $('walkNext').disabled = W.i === W.steps.length - 1;
  setStat('statMsgs', step.stats.msgs);
  setStat('statRounds', step.stats.rounds);
  setStat('statCalls', step.stats.calls);
  // On a phone the card covers the lower half, so bring the agent getting the message into view.
  if (PHONE()) {
    const node = toEl || fromEl;
    if (node) {
      const r = node.getBoundingClientRect();
      const mid = ($('hud').getBoundingClientRect().bottom + $('walkCard').getBoundingClientRect().top) / 2;
      $('canvas').scrollBy({ top: r.top + r.height / 2 - mid, left: r.left + r.width / 2 - innerWidth / 2, behavior: REDUCED ? 'auto' : 'smooth' });
    }
  }
}

// The line between this step's two agents stays lit (drawWires calls this again after a redraw).
function litWalk() {
  for (const p of document.querySelectorAll('.wire.w-lit')) p.classList.remove('w-lit');
  if (!W) return;
  const step = W.steps[W.i];
  const p = S.paths.get(`${step.from}>${step.to}`) || S.paths.get(`${step.to}>${step.from}`);
  p?.path.classList.add('w-lit');
}

function renderSaw(step) {
  const box = $('walkSaw');
  box.replaceChildren();
  if (!step.saw) return;
  const name = who(step.to, W.trace.team).name;
  const win = el('div', 'win');
  const ins = blk('mine', 'Instructions', 'your parts, plus team lines the lab adds');
  ins.append(el('pre', null, step.saw.instructions));
  win.append(ins);
  const chat = blk('', 'The whole chat so far');
  if (!step.saw.before.length) chat.append(el('p', 'txt', 'Nothing before this message.'));
  for (const m of step.saw.before) {
    const t = el('div', 'turn');
    t.append(el('b', null, m.role === 'model' ? `${name} replied` : 'Message to it'), document.createTextNode(m.text));
    chat.append(t);
  }
  win.append(chat);
  const nm = blk('you', 'New message');
  nm.append(el('p', 'txt', step.saw.message));
  win.append(nm);
  box.append(win);
}

function walkKey(e) {
  if (!W || $('keyDialog').open) return;
  if (e.target.closest?.('input, textarea')) return;
  const onButton = e.target.closest?.('button');
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); exitWalk(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); setPlaying(false); walkTo(W.i + 1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); setPlaying(false); walkTo(W.i - 1); }
  else if (e.key === ' ' && !onButton) { e.preventDefault(); setPlaying(!W.timer); }
}

function initWalk() {
  $('exampleBtn').addEventListener('click', () => startExample($('exampleBtn')));
  $('walkBtn').addEventListener('click', () => startWalk(S.lastTrace, $('walkBtn')));
  $('walkBtn2').addEventListener('click', () => startWalk(S.lastTrace, $('walkBtn2')));
  $('walkBack').addEventListener('click', () => { setPlaying(false); walkTo(W.i - 1); });
  $('walkNext').addEventListener('click', () => { setPlaying(false); walkTo(W.i + 1); });
  $('walkPlay').addEventListener('click', () => setPlaying(!W.timer));
  $('walkExit').addEventListener('click', exitWalk);
  $('walkMsgs').addEventListener('click', () => { if (chatOpen()) closeChat(); else openSheet('messages'); });
  $('walkSawBtn').addEventListener('click', () => {
    const b = $('walkSawBtn');
    const open = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', String(open));
    b.textContent = open ? 'Hide what it saw' : 'What it saw';
    if (W) walkTo(W.i);
  });
  document.addEventListener('keydown', walkKey, true);
}

// ---------- key dialog ----------

function openKeyDialog() {
  const d = $('keyDialog');
  $('keyInput').value = '';
  $('keyInput').type = 'password';
  $('keyShow').textContent = 'Show';
  $('keyShow').setAttribute('aria-pressed', 'false');
  $('keyInput').placeholder = S.key ? 'A key is saved. Paste a new one to change it.' : 'Paste your key';
  $('keyRemember').checked = Boolean(store.get('localStorage', STORE_KEY));
  $('keyStatus').textContent = S.mode === 'gemini' && S.gemini?.model ? `Using ${S.gemini.model}.` : '';
  $('keyStatus').className = 'key-status';
  $('keyForget').disabled = !S.key;
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  // On a phone, focusing the box opens the keyboard over the steps, so only a mouse or trackpad gets focus here.
  if (typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches) $('keyInput').focus();
}

let keyCheckCtl = null;

function closeKeyDialog() {
  // Closing the dialog cancels a key check that is still waiting on Google.
  keyCheckCtl?.abort();
  const d = $('keyDialog');
  if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
}

// Copying from Notes, Messages, or a chat can add spaces, line breaks, curly quotes, or invisible characters.
// A key is printable ASCII with no spaces, so all of those come out, plus a label like "Key:" in front.
function cleanKey(raw) {
  return String(raw || '')
    .replace(/[\s​-‍⁠﻿"'`‘’“”]/g, '')
    .replace(/^(?:(?:VITE_)?GEMINI_API_KEY=|(?:api)?key[:=])/i, '');
}

function setKeyStatus(cls, text) {
  const status = $('keyStatus');
  status.className = `key-status${cls ? ` ${cls}` : ''}`;
  status.textContent = text;
  if (text) status.scrollIntoView({ block: 'nearest' });
}

async function checkKeyFromDialog() {
  if (keyCheckCtl) return;
  const input = cleanKey($('keyInput').value);
  const key = input || S.key;
  if (!key) {
    setKeyStatus('bad', 'Paste your key first, or use practice mode.');
    return;
  }
  if (/[^\x21-\x7E]/.test(key) || key.length < 20) {
    setKeyStatus('bad', 'That doesn\'t look like a whole key. Copy it again from Google AI Studio and paste it here.');
    return;
  }
  setKeyStatus('', 'Checking the key with Google…');
  $('keyCheck').disabled = true;
  const ctl = new AbortController();
  keyCheckCtl = ctl;
  try {
    const mod = await import('./gemini.js');
    const adapter = mod.createGeminiAdapter({ key, onModel: onModelSwitch });
    const info = await adapter.checkKey({
      ping: true,
      signal: ctl.signal,
      maxWaitSec: 15,
      onWait: s => setKeyStatus('', `Google's free limit is busy. Waiting ${s}s, then checking again…`),
    });
    if (ctl.signal.aborted) return;
    S.key = key;
    S.gemini = adapter;
    S.geminiReady = true;
    store.set('sessionStorage', STORE_KEY, key);
    if ($('keyRemember').checked) store.set('localStorage', STORE_KEY, key); else store.del('localStorage', STORE_KEY);
    setMode('gemini');
    setKeyStatus('ok', `The key works. Using ${info.model}.`);
    $('keyInput').value = '';
    $('keyForget').disabled = false;
    setTimeout(() => { closeKeyDialog(); toast(`Gemini is on: ${info.model}.`); }, 900);
  } catch (err) {
    if (ctl.signal.aborted || err?.name === 'AbortError') {
      setKeyStatus('', '');
      return;
    }
    setKeyStatus('bad', err?.friendly || 'Gemini mode could not load on this page. Use practice mode for now.');
  } finally {
    if (keyCheckCtl === ctl) keyCheckCtl = null;
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
  // A team from a link is saved right away, so a reload keeps it.
  if (fromLink) save();

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
    renderTaskNote();
    warnIfKey(S.task);
    save();
    refreshSoon();
  });
  $('teamTaskBtn').addEventListener('click', () => {
    if (S.running) return;
    const p = getPreset(S.presetId);
    withUndo(`Loaded the ${p.name} team task.`, () => { S.task = presetTask(S.presetId, S.level); S.taskDirty = false; });
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
  $('keyInput').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // On a phone, Go closes the keyboard so the result line under the box can be seen.
    if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) e.target.blur();
    checkKeyFromDialog();
  });
  $('keyShow').addEventListener('click', () => {
    const input = $('keyInput');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    $('keyShow').textContent = show ? 'Hide' : 'Show';
    $('keyShow').setAttribute('aria-pressed', String(show));
  });
  $('keyDialog').addEventListener('close', () => keyCheckCtl?.abort());
  $('keyPractice').addEventListener('click', () => { setMode('practice'); closeKeyDialog(); toast('Practice mode is on.'); });
  $('keyForget').addEventListener('click', forgetKey);
  $('keyDialog').addEventListener('click', e => { if (e.target === $('keyDialog')) closeKeyDialog(); });

  // Example team menu (top right): the presets, Reset, and Copy link.
  const menu = $('teamMenu');
  const setMenu = open => { menu.hidden = !open; $('teamMenuBtn').setAttribute('aria-expanded', String(open)); };
  $('teamMenuBtn').addEventListener('click', () => setMenu(menu.hidden));
  document.addEventListener('pointerdown', e => { if (!menu.hidden && !e.target.closest('.menu-wrap')) setMenu(false); });
  menu.addEventListener('click', e => { if (e.target.closest('button')) setTimeout(() => setMenu(false), 0); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { e.stopImmediatePropagation(); setMenu(false); $('teamMenuBtn').focus(); } });

  // The two floating panels: the selected agent's card, and Messages.
  $('sheetClose').addEventListener('click', closeSheet);
  $('chatClose').addEventListener('click', closeChat);
  $('msgsBtn').addEventListener('click', () => (chatOpen() ? closeChat() : openSheet('messages')));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || $('keyDialog').open || !menu.hidden) return;
    // Esc closes the panel the focus is in, or else the agent card, then Messages.
    if (document.activeElement?.closest('#chatDock') && chatOpen()) closeChat();
    else if (document.body.dataset.sheet) closeSheet();
    else if (chatOpen()) closeChat();
  });
  $('canvasHint').textContent = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 'Tap an agent to change it.' : 'Click an agent to change it.';
  if (WIDE() && S.level <= 2) openSheet('agent');

  // The floating HUD and dock set how much room the tree keeps clear around itself.
  sizeVars();
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => { sizeVars(); requestAnimationFrame(fitTree); });
    ro.observe($('hud'));
    ro.observe($('dock'));
    ro.observe($('topTools'));
  }

  // The page itself never scrolls; only the canvas does. Focusing a card at the edge used to shift the whole
  // page and push the HUD and Reset view off screen, so put the page back whenever that happens.
  const pin = () => { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); if (document.body.scrollLeft || document.body.scrollTop) { document.body.scrollLeft = 0; document.body.scrollTop = 0; } };
  window.addEventListener('scroll', pin, { passive: true });
  document.body.addEventListener('scroll', pin, { passive: true });
  // Drag the empty canvas to move around a big team (touch scrolls on its own).
  const canvas = $('canvas');
  let pan = null;
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('button, a, input, textarea')) return;
    pan = { x: e.clientX, y: e.clientY, l: canvas.scrollLeft, t: canvas.scrollTop };
    canvas.classList.add('panning');
  });
  window.addEventListener('pointermove', e => {
    if (!pan) return;
    canvas.scrollLeft = pan.l - (e.clientX - pan.x);
    canvas.scrollTop = pan.t - (e.clientY - pan.y);
  });
  window.addEventListener('pointerup', () => { pan = null; canvas.classList.remove('panning'); });
  const zoomBy = f => { userZoom = Math.max(0.3, Math.min(2, userZoom * f)); fitTree(); };
  $('zoomOutBtn').addEventListener('click', () => zoomBy(0.8));
  $('zoomInBtn').addEventListener('click', () => zoomBy(1.25));
  canvas.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    // Scale by how far the wheel or pinch moved, not by event count, so a trackpad pinch zooms gently.
    const d = Math.max(-40, Math.min(40, e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY));
    zoomBy(Math.exp(-d * 0.004));
  }, { passive: false });
  $('resetViewBtn').addEventListener('click', () => {
    if (userZoom !== 1) { userZoom = 1; fitTree(); }
    const box = $('treeBox');
    const c = canvas.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const st = getComputedStyle($('stage'));
    const padL = parseFloat(st.paddingLeft), padR = parseFloat(st.paddingRight), padT = parseFloat(st.paddingTop), padB = parseFloat(st.paddingBottom);
    const midX = padL + (c.width - padL - padR) / 2;
    const midY = padT + (c.height - padT - padB) / 2;
    const left = canvas.scrollLeft + (b.left - c.left) + Math.min(b.width, c.width - padL - padR) / 2 - midX;
    const top = canvas.scrollTop + (b.top - c.top) + Math.min(b.height, c.height - padT - padB) / 2 - midY;
    canvas.scrollTo({ left: Math.max(0, left), top: Math.max(0, top), behavior: REDUCED ? 'auto' : 'smooth' });
  });

  // The task box shows two lines until you click into it.
  $('task').addEventListener('focus', () => requestAnimationFrame(growTask));
  $('task').addEventListener('blur', () => requestAnimationFrame(growTask));
  resetStats();

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

  initWalk();
  S.recordingsReady = loadRecordings(new URL('./examples/', import.meta.url)).then(r => { S.recordings = r; }).catch(() => { S.recordings = []; });
}

init();

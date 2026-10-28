// Agent Lab engine: the agent model, each agent's instructions, and running a team.
// Pure logic, no DOM. A run talks to the model only through an adapter
// ({ generate(request) -> Promise<{ text, model? }> }), so tests use a fake one.

export const DEFAULT_LIMITS = Object.freeze({
  maxCalls: 24,     // model calls per run
  maxAgents: 8,     // agents on a team, checkers included
  maxDepth: 3,      // levels: lead, helper, helper's helper
  maxHelpers: 4,    // helpers per lead
  maxRounds: 3,     // rounds per check loop
  maxConcurrent: 2, // model calls in flight at once
});

// The labeled parts, in the order the instructions list them.
export const PARTS = [
  { key: 'role', label: 'Role' },
  { key: 'goal', label: 'Goal' },
  { key: 'steps', label: 'Steps', list: 'numbered' },
  { key: 'rules', label: 'Rules', list: 'bullets' },
  { key: 'output', label: 'Output' },
  { key: 'doneWhen', label: 'Done when', list: 'bullets' },
];

export const COLORS = ['#3F5A2A', '#A8487A', '#4A7590', '#B0603A', '#6B7F2A', '#7A5AA0', '#2F7A6B', '#9A5B2E'];

export class StopError extends Error {
  constructor() { super('Stopped.'); this.name = 'StopError'; }
}

export class LimitError extends Error {
  constructor(limit, value, message) {
    super(message);
    this.name = 'LimitError';
    this.limit = limit;
    this.value = value;
  }
}

// ---------- the agent ----------

let idCounter = 0;
export function newId() {
  idCounter += 1;
  return 'a' + Date.now().toString(36).slice(-4) + idCounter.toString(36) + Math.random().toString(36).slice(2, 5);
}

export function newAgent(fields = {}) {
  return {
    id: fields.id || newId(),
    name: str(fields.name, 'Agent'),
    emoji: str(fields.emoji, '🤖'),
    color: str(fields.color, COLORS[0]),
    job: str(fields.job),
    role: str(fields.role),
    goal: str(fields.goal),
    steps: str(fields.steps),
    rules: str(fields.rules),
    output: str(fields.output),
    doneWhen: lines(fields.doneWhen),
    parentId: fields.parentId || null,
    checkerId: fields.checkerId || null,
    maxRounds: clampInt(fields.maxRounds, 1, DEFAULT_LIMITS.maxRounds, DEFAULT_LIMITS.maxRounds),
  };
}

function str(v, fallback = '') {
  if (typeof v !== 'string') return fallback;
  return v;
}

export function lines(v) {
  if (Array.isArray(v)) return v.map(x => String(x ?? '').trim()).filter(Boolean);
  if (typeof v === 'string') return v.split('\n').map(x => x.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean);
  return [];
}

function clampInt(v, lo, hi, fallback) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

// Rebuilds a team from untrusted data (a share link, saved storage): known fields only, sane lengths.
export function sanitizeTeam(raw) {
  const list = Array.isArray(raw?.agents) ? raw.agents.slice(0, 16) : [];
  const cap = (s, n) => (typeof s === 'string' ? s.slice(0, n) : '');
  const agents = list.map(a => newAgent({
    id: typeof a?.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(a.id) ? a.id : undefined,
    name: cap(a?.name, 40).trim() || 'Agent',
    emoji: cap(a?.emoji, 8) || '🤖',
    color: typeof a?.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(a.color) ? a.color : COLORS[0],
    job: cap(a?.job, 300),
    role: cap(a?.role, 1500),
    goal: cap(a?.goal, 1500),
    steps: cap(a?.steps, 1500),
    rules: cap(a?.rules, 1500),
    output: cap(a?.output, 1500),
    doneWhen: lines(Array.isArray(a?.doneWhen) ? a.doneWhen.slice(0, 8).map(x => cap(x, 200)) : cap(a?.doneWhen, 1500)).slice(0, 8),
    parentId: typeof a?.parentId === 'string' ? a.parentId : null,
    checkerId: typeof a?.checkerId === 'string' ? a.checkerId : null,
    maxRounds: a?.maxRounds,
  }));
  const ids = new Set(agents.map(a => a.id));
  if (ids.size !== agents.length) agents.forEach(a => { a.id = newId(); });
  const known = new Set(agents.map(a => a.id));
  for (const a of agents) {
    if (a.parentId && (!known.has(a.parentId) || a.parentId === a.id)) a.parentId = null;
    if (a.checkerId && (!known.has(a.checkerId) || a.checkerId === a.id)) a.checkerId = null;
  }
  return { agents };
}

// ---------- the team ----------

export function byId(team, id) {
  return team.agents.find(a => a.id === id) || null;
}

export function isChecker(team, id) {
  return team.agents.some(a => a.checkerId === id && a.id !== id);
}

export function checkedBy(team, checkerId) {
  return team.agents.find(a => a.checkerId === checkerId && a.id !== checkerId) || null;
}

export function helpersOf(team, id) {
  return team.agents.filter(a => a.parentId === id && !isChecker(team, a.id));
}

export function checkerOf(team, agent) {
  if (!agent?.checkerId) return null;
  const c = byId(team, agent.checkerId);
  return c && c.id !== agent.id ? c : null;
}

export function tops(team) {
  return team.agents.filter(a => !a.parentId && !isChecker(team, a.id));
}

export function topAgent(team) {
  return tops(team)[0] || null;
}

// 'lead' (has helpers), 'helper' (has a lead), 'checker', or 'solo' (one agent on its own).
export function roleOf(team, id) {
  if (isChecker(team, id)) return 'checker';
  if (helpersOf(team, id).length) return 'lead';
  const a = byId(team, id);
  if (a?.parentId) return 'helper';
  return 'solo';
}

// Level of an agent in the tree: the top agent is level 1. Checkers take their agent's level.
export function depthOf(team, id) {
  let d = 1;
  let a = byId(team, id);
  if (a && isChecker(team, a.id)) a = checkedBy(team, a.id);
  const seen = new Set();
  while (a?.parentId && !seen.has(a.id)) {
    seen.add(a.id);
    a = byId(team, a.parentId);
    d += 1;
  }
  return d;
}

export function treeDepth(team) {
  return team.agents.reduce((m, a) => Math.max(m, depthOf(team, a.id)), 0);
}

// Problems that stop a run before it starts. Each names its limit when it has one.
export function checkTeam(team, limits = DEFAULT_LIMITS) {
  const L = { ...DEFAULT_LIMITS, ...limits };
  const problems = [];
  const agents = team?.agents || [];
  if (!agents.length) problems.push({ message: 'Add an agent first.' });
  const topList = tops(team || { agents: [] });
  if (agents.length && !topList.length) problems.push({ message: 'The team needs one agent at the top.' });
  if (topList.length > 1) problems.push({ message: `Only one agent can be at the top, and this team has ${topList.length}: ${topList.map(a => a.name).join(', ')}.` });
  const seenNames = new Map();
  for (const a of agents) {
    const k = a.name.trim().toLowerCase();
    if (!k) { problems.push({ message: 'Every agent needs a name.' }); break; }
    if (seenNames.has(k)) { problems.push({ message: `Two agents are named ${a.name.trim()}. Give each one its own name, so jobs and reports reach the right one.` }); break; }
    seenNames.set(k, a);
  }
  if (agents.length > L.maxAgents) {
    problems.push({ limit: 'maxAgents', value: L.maxAgents, message: `This team has ${agents.length} agents. The lab's limit is ${L.maxAgents} agents per team, so remove one and run again.` });
  }
  for (const a of agents) {
    const seen = new Set([a.id]);
    let p = a.parentId ? byId(team, a.parentId) : null;
    while (p) {
      if (seen.has(p.id)) { problems.push({ message: `${a.name} and its leads form a circle. Each agent needs one lead above it.` }); break; }
      seen.add(p.id);
      p = p.parentId ? byId(team, p.parentId) : null;
    }
  }
  if (!problems.length) {
    const depth = treeDepth(team);
    if (depth > L.maxDepth) {
      problems.push({ limit: 'maxDepth', value: L.maxDepth, message: `This team is ${depth} levels deep. The lab's limit is ${L.maxDepth} levels (a lead, its helpers, and their helpers).` });
    }
    for (const a of agents) {
      const n = helpersOf(team, a.id).length;
      if (n > L.maxHelpers) problems.push({ limit: 'maxHelpers', value: L.maxHelpers, message: `${a.name} has ${n} helpers. The lab's limit is ${L.maxHelpers} helpers per lead.` });
    }
  }
  return { ok: problems.length === 0, problems };
}

// ---------- instructions ----------

function listText(text, kind) {
  const items = lines(text);
  if (!items.length) return '';
  return items.map((x, i) => (kind === 'numbered' ? `${i + 1}. ${x}` : `- ${x}`)).join('\n');
}

// The exact system instructions the model gets for this agent. Empty parts are left out.
export function buildInstructions(team, agent) {
  const out = [];
  const name = agent.name.trim() || 'Agent';
  const job = agent.job.trim();
  out.push(job ? `You are ${name}. Your job: ${job}` : `You are ${name}.`);

  for (const part of PARTS) {
    const value = agent[part.key];
    const text = part.list ? listText(value, part.list) : String(value || '').trim();
    if (text) out.push(`## ${part.label}\n${text}`);
  }

  const role = roleOf(team, agent.id);
  const helpers = helpersOf(team, agent.id);
  const lead = agent.parentId ? byId(team, agent.parentId) : null;
  const checker = checkerOf(team, agent);
  const team_ = [];
  if (role === 'checker') {
    const target = checkedBy(team, agent.id);
    team_.push(`You check the work of ${target ? target.name : 'another agent'} against its Done when list. Grade each line pass or fail with a short note, then say exactly what to fix. Never rewrite the work yourself and never give jobs.`);
  } else {
    if (helpers.length) {
      team_.push(`Your helpers:\n${helpers.map(h => `- ${h.name}${h.job.trim() ? `: ${h.job.trim()}` : ''}`).join('\n')}`);
      team_.push('You give each helper one clear job, then put their reports together into one final answer. Only you give your helpers jobs, and you make the final call.');
    }
    if (lead) {
      team_.push(`${lead.name} is your lead. ${lead.name} gives you your job, and you send your work back to ${lead.name} only. Reply with the finished work only.`);
    } else if (helpers.length || checker) {
      team_.push('You answer the person who asked. Only you answer them.');
    }
    if (checker) {
      team_.push(`${checker.name} checks your work against your Done when list and may send it back with notes. When that happens, fix every note and reply with the full new version.`);
    }
  }
  if (team_.length) out.push(`## Your team\n${team_.join('\n')}`);
  return out.join('\n\n');
}

// The window this agent will see, laid out like Meeting 3's context window.
// Pass the last run's conversation to show what it actually saw.
export function windowFor(team, agent, task, conversation) {
  const instructions = buildInstructions(team, agent);
  const lead = agent.parentId ? byId(team, agent.parentId) : null;
  if (conversation && conversation.length) {
    // As it looked at this agent's last call: everything before the last message it got, that message, and its reply.
    let k = conversation.length - 1;
    while (k >= 0 && conversation[k].role !== 'user') k -= 1;
    if (k >= 0) {
      const reply = conversation.slice(k + 1).find(m => m.role === 'model');
      return { instructions, messages: conversation.slice(0, k).map(m => ({ ...m })), newMessage: conversation[k].text, reply: reply ? reply.text : null, fromRun: true };
    }
  }
  let newMessage;
  if (isChecker(team, agent.id)) {
    const target = checkedBy(team, agent.id);
    newMessage = `(During a run: ${target ? target.name : 'the agent'}'s work and its Done when list, to grade.)`;
  } else if (lead) {
    newMessage = `Job from ${lead.name}: (${lead.name} writes this job during the run.)`;
  } else {
    newMessage = String(task || '').trim() || '(Your task goes here.)';
  }
  return { instructions, messages: [], newMessage, fromRun: false };
}

// ---------- schemas and parsing ----------

export function planSchema(helperNames) {
  return {
    type: 'object',
    properties: {
      note: { type: 'string', description: 'One short sentence for the team chat about the plan.' },
      jobs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            helper: { type: 'string', enum: helperNames },
            job: { type: 'string' },
          },
          required: ['helper', 'job'],
        },
      },
    },
    required: ['note', 'jobs'],
  };
}

export function checkSchema(items) {
  return {
    type: 'object',
    properties: {
      checks: {
        type: 'array',
        minItems: items.length,
        maxItems: items.length,
        items: {
          type: 'object',
          properties: {
            item: { type: 'string', enum: items },
            pass: { type: 'boolean' },
            note: { type: 'string' },
          },
          required: ['item', 'pass', 'note'],
        },
      },
      feedback: { type: 'string' },
    },
    required: ['checks', 'feedback'],
  };
}

// Lenient JSON: accepts a fenced block or text around one object. Returns null when there is none.
export function parseJSON(text) {
  if (typeof text !== 'string') return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return JSON.parse(t.slice(a, b + 1)); } catch { /* fall through */ }
  }
  return null;
}

const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Turns a lead's reply into jobs for its own helpers. Unknown names are dropped.
// An empty or broken plan gives every helper the whole task.
export function normalizePlan(raw, helpers, wholeTask) {
  const byName = new Map(helpers.map(h => [norm(h.name), h]));
  const jobs = new Map();
  let dropped = 0;
  const list = Array.isArray(raw?.jobs) ? raw.jobs : [];
  for (const j of list) {
    const h = byName.get(norm(j?.helper));
    const job = typeof j?.job === 'string' ? j.job.trim() : '';
    if (!h || !job) { dropped += 1; continue; }
    jobs.set(h.id, jobs.has(h.id) ? `${jobs.get(h.id)}\n${job}` : job);
  }
  const broken = jobs.size === 0;
  if (broken) for (const h of helpers) jobs.set(h.id, wholeTask);
  const note = typeof raw?.note === 'string' ? raw.note.trim() : '';
  return { jobs, note, dropped, broken };
}

// Lines up the checker's grades with the Done when lines. The work passes only if every line passes.
export function normalizeChecks(raw, items) {
  const list = Array.isArray(raw?.checks) ? raw.checks : [];
  const used = new Set();
  const checks = items.map((item, i) => {
    let k = list.findIndex((c, j) => !used.has(j) && norm(c?.item) === norm(item));
    if (k < 0 && list[i] && !used.has(i) && !items.some(it => norm(it) === norm(list[i]?.item))) k = i;
    if (k < 0) return { item, pass: false, note: 'The checker did not grade this line.', missing: true };
    used.add(k);
    const c = list[k];
    return { item, pass: c?.pass === true, note: typeof c?.note === 'string' ? c.note.trim() : '' };
  });
  const feedback = typeof raw?.feedback === 'string' ? raw.feedback.trim() : '';
  return { checks, pass: checks.length > 0 && checks.every(c => c.pass), feedback };
}

export function wordCount(text) {
  return (String(text || '').match(/[A-Za-z0-9][A-Za-z0-9'’&$:.,/-]*/g) || []).length;
}

// ---------- running a team ----------

function makeLimiter(n) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= n || !queue.length) return;
    active += 1;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve().then(fn).then(resolve, reject).finally(() => { active -= 1; next(); });
  };
  return fn => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
}

const MAX_TOKENS = { plan: 600, work: 900, combine: 1400, check: 600, revise: 900 };

/**
 * Runs a team on a task.
 * @returns {Promise<{status, final, stats, conversations, instructions, error?, limit?}>}
 *   status is 'done', 'stopped', 'limit', or 'error'. It never throws for those.
 */
export async function runTeam(team, task, { adapter, limits = {}, signal, onEvent = () => {} } = {}) {
  const L = { ...DEFAULT_LIMITS, ...limits };
  const started = Date.now();
  const stats = { calls: 0, agents: 0, messages: 0, agentMessages: 0, checkRounds: 0, sendBacks: 0 };
  const conversations = {};
  const instructions = {};
  const touched = new Set();
  let msgSeq = 0;
  const emit = ev => { try { onEvent(ev); } catch { /* a UI error never breaks the run */ } };
  const message = m => {
    const msg = { id: ++msgSeq, ...m };
    if (!m.lab) {
      stats.messages += 1;
      if (m.from !== 'you' && m.to !== 'you' && m.to !== 'team') stats.agentMessages += 1;
    }
    emit({ type: 'message', ...msg });
    return msg;
  };
  const finish = (status, extra = {}) => {
    stats.agents = touched.size;
    const result = { status, final: extra.final ?? null, stats: { ...stats }, conversations, instructions, ms: Date.now() - started, ...extra };
    emit({ type: 'run-done', ...result });
    return result;
  };

  task = String(task ?? '').trim();
  emit({ type: 'run-start', task, agents: team.agents.length, limits: L });

  const verdict = checkTeam(team, L);
  if (!verdict.ok) {
    const p = verdict.problems.find(x => x.limit) || verdict.problems[0];
    if (p.limit) {
      emit({ type: 'limit', limit: p.limit, value: p.value, message: p.message, fatal: true });
      return finish('limit', { limit: p.limit, message: p.message });
    }
    emit({ type: 'error', message: p.message, kind: 'team' });
    return finish('error', { error: p.message });
  }
  if (!task) {
    const m = 'Type a task first, then press Run.';
    emit({ type: 'error', message: m, kind: 'task' });
    return finish('error', { error: m });
  }
  if (!adapter || typeof adapter.generate !== 'function') throw new TypeError('runTeam needs an adapter with generate()');

  const inner = new AbortController();
  const onAbort = () => inner.abort(signal.reason);
  if (signal) {
    if (signal.aborted) inner.abort(signal.reason);
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  const limiter = makeLimiter(Math.max(1, L.maxConcurrent));
  try { adapter.begin?.(team, task); } catch { /* optional hook */ }

  const throwIfStopped = () => { if (inner.signal.aborted) throw new StopError(); };

  async function call(agent, kind, userText, { schema, round, meta = {} } = {}) {
    throwIfStopped();
    if (stats.calls >= L.maxCalls) {
      throw new LimitError('maxCalls', L.maxCalls, `Stopped: this run reached the limit of ${L.maxCalls} model calls. The limit keeps a team from running forever.`);
    }
    stats.calls += 1;
    touched.add(agent.id);
    const conv = conversations[agent.id] || (conversations[agent.id] = []);
    if (!instructions[agent.id]) instructions[agent.id] = buildInstructions(team, agent);
    conv.push({ role: 'user', text: userText });
    return limiter(async () => {
      throwIfStopped();
      emit({ type: 'agent-start', agentId: agent.id, phase: kind, round });
      let res;
      try {
        res = await adapter.generate({
          kind,
          system: instructions[agent.id],
          messages: conv.map(m => ({ ...m })),
          schema,
          maxOutputTokens: meta.maxTokens || MAX_TOKENS[kind] || 900,
          signal: inner.signal,
          onWait: (seconds, reason) => emit({ type: 'waiting', agentId: agent.id, seconds, reason }),
          meta: { agentId: agent.id, agentName: agent.name, job: agent.job, kind, round, task, ...meta },
        });
      } catch (err) {
        if (inner.signal.aborted || err?.name === 'AbortError') throw new StopError();
        if (err && typeof err === 'object' && !err.agentId) err.agentId = agent.id;
        throw err;
      }
      throwIfStopped();
      const text = typeof res?.text === 'string' ? res.text : '';
      conv.push({ role: 'model', text });
      emit({ type: 'agent-idle', agentId: agent.id });
      return text;
    });
  }

  // Runs the check loop on an agent's work. Returns the last version.
  async function checkLoop(agent, work, jobText) {
    const checker = checkerOf(team, agent);
    if (!checker) return work;
    const items = agent.doneWhen.length ? agent.doneWhen : ['Does the job it was given'];
    const maxRounds = Math.min(agent.maxRounds || L.maxRounds, L.maxRounds);
    let current = work;
    for (let round = 1; round <= maxRounds; round += 1) {
      emit({ type: 'round', agentId: agent.id, checkerId: checker.id, round, maxRounds });
      const prompt = [
        `Check this work from ${agent.name} (round ${round} of ${maxRounds}).`,
        jobText ? `The job it was given:\n${jobText}` : '',
        `The work:\n"""\n${current}\n"""`,
        `Length (counted by the lab page): ${wordCount(current)} words.`,
        `Done when (grade every line, in order):\n${items.map((x, i) => `${i + 1}. ${x}`).join('\n')}`,
        'For each line give item (the line exactly), pass (true or false), and note (one short sentence). Then feedback: exactly what to fix, or "Looks good" if every line passes.',
      ].filter(Boolean).join('\n\n');
      const text = await call(checker, 'check', prompt, { schema: checkSchema(items), round, meta: { items, checkedName: agent.name, maxTokens: Math.max(MAX_TOKENS.check, 200 + 110 * items.length) } });
      stats.checkRounds += 1;
      const graded = normalizeChecks(parseJSON(text), items);
      emit({ type: 'check-result', agentId: agent.id, checkerId: checker.id, round, maxRounds, ...graded });
      const capped = !graded.pass && round === maxRounds;
      message({
        from: checker.id, to: agent.id, kind: 'check', round, maxRounds,
        text: graded.feedback || (graded.pass ? 'Looks good.' : 'Some lines did not pass.'),
        checks: graded.checks, pass: graded.pass, capped,
      });
      if (graded.pass) return current;
      if (capped) {
        const failing = graded.checks.filter(c => !c.pass).map(c => c.item).join('; ');
        const m = `${checker.name} stopped after ${maxRounds} round${maxRounds === 1 ? '' : 's'} (the round limit). Still failing: ${failing}. The run goes on with ${agent.name}'s last version.`;
        emit({ type: 'limit', limit: 'maxRounds', value: maxRounds, message: m, fatal: false, agentId: agent.id });
        message({ from: 'lab', to: 'team', kind: 'note', text: m, lab: true });
        return current;
      }
      stats.sendBacks += 1;
      const notes = graded.checks.map(c => `- ${c.pass ? 'PASS' : 'FAIL'} ${c.item}${c.note ? `: ${c.note}` : ''}`).join('\n');
      const revisePrompt = `Notes from ${checker.name} (round ${round} of ${maxRounds}):\n${notes}${graded.feedback ? `\n\nWhat to fix: ${graded.feedback}` : ''}\n\nRevise your work so every line passes. Reply with the full new version only.`;
      current = await call(agent, 'revise', revisePrompt, { round: round + 1, meta: helpersOf(team, agent.id).length ? { maxTokens: MAX_TOKENS.combine } : {} });
      message({ from: agent.id, to: checker.id, kind: 'revise', round: round + 1, maxRounds, text: current });
    }
    return current;
  }

  // One agent's whole part: plan and delegate if it leads, do the work, pass its check loop.
  async function runAgent(agent, incoming, fromId) {
    const helpers = helpersOf(team, agent.id).slice(0, L.maxHelpers);
    const checker = checkerOf(team, agent);
    const fromAgent = fromId && fromId !== 'you' ? byId(team, fromId) : null;
    const opener = fromAgent ? `Job from ${fromAgent.name}:\n${incoming}` : incoming;
    let result;

    if (helpers.length) {
      const names = helpers.map(h => h.name);
      const planPrompt = `${opener}\n\nMake a plan first. Give each of your helpers (${names.join(', ')}) one clear job for this. Reply in JSON with "note" (one short sentence for the team chat) and "jobs" (a list of {"helper", "job"}).`;
      const planText = await call(agent, 'plan', planPrompt, { schema: planSchema(names), meta: { helperNames: names, helpers: helpers.map(h => ({ name: h.name, job: h.job })) } });
      const plan = normalizePlan(parseJSON(planText), helpers, incoming);
      if (plan.note) message({ from: agent.id, to: 'team', kind: 'note', text: plan.note });
      if (plan.broken) {
        message({ from: 'lab', to: 'team', kind: 'note', lab: true, text: `${agent.name}'s plan came back empty or broken, so every helper gets the whole task.` });
      } else if (plan.dropped) {
        message({ from: 'lab', to: 'team', kind: 'note', lab: true, text: `The lab dropped ${plan.dropped} job${plan.dropped === 1 ? '' : 's'} in ${agent.name}'s plan that named someone who is not one of its helpers.` });
      }
      const assigned = helpers.filter(h => plan.jobs.has(h.id));
      for (const h of helpers) {
        if (!plan.jobs.has(h.id)) message({ from: 'lab', to: 'team', kind: 'note', lab: true, text: `${agent.name} gave ${h.name} no job this run.` });
      }
      for (const h of assigned) message({ from: agent.id, to: h.id, kind: 'job', text: plan.jobs.get(h.id) });
      const reports = await Promise.all(assigned.map(h => runAgent(h, plan.jobs.get(h.id), agent.id)));
      const reportText = assigned.map((h, i) => `### ${h.name}\n${reports[i]}`).join('\n\n');
      const target = fromAgent ? fromAgent.name : 'the person who asked';
      const combinePrompt = `Reports from your helpers:\n\n${reportText}\n\nNow put the reports together into the final answer for ${target}. Keep each helper's work, fix anything that does not fit together, and reply with the finished answer only.`;
      result = await call(agent, 'combine', combinePrompt);
      if (checker) message({ from: agent.id, to: checker.id, kind: 'draft', round: 1, text: result });
    } else {
      result = await call(agent, 'work', opener, { round: checker ? 1 : undefined });
      if (checker) message({ from: agent.id, to: checker.id, kind: 'draft', round: 1, text: result });
    }

    if (checker) result = await checkLoop(agent, result, fromAgent ? incoming : '');

    if (fromAgent) message({ from: agent.id, to: fromAgent.id, kind: 'report', text: result, checked: Boolean(checker) });
    emit({ type: 'agent-done', agentId: agent.id });
    return result;
  }

  const top = topAgent(team);
  message({ from: 'you', to: top.id, kind: 'job', text: task });
  try {
    const final = await runAgent(top, task, 'you');
    message({ from: top.id, to: 'you', kind: 'final', text: final });
    return finish('done', { final });
  } catch (err) {
    inner.abort();
    if (err instanceof StopError || err?.name === 'StopError') {
      return finish('stopped', { message: 'Stopped. Nothing else was sent.' });
    }
    if (err instanceof LimitError) {
      emit({ type: 'limit', limit: err.limit, value: err.value, message: err.message, fatal: true });
      return finish('limit', { limit: err.limit, message: err.message });
    }
    const friendly = err?.friendly || `Something went wrong: ${err?.message || err}. Press Retry, or switch to practice mode.`;
    emit({ type: 'error', message: friendly, kind: err?.kind || 'unknown', retryable: err?.retryable !== false, agentId: err?.agentId });
    return finish('error', { error: friendly, errorKind: err?.kind || 'unknown' });
  } finally {
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

// Practice adapter: works with no key and no network.
// When the team and task match a recorded real run exactly, it replays that run's replies.
// For anything else it returns sample replies that say they are samples.

import { buildInstructions, byId, sanitizeTeam } from './engine.js';

// Only files that exist (a missing one would log a 404 in the console).
// game-night-run.json is level 4 (the deck quotes it); the others are levels 1 to 3.
export const RECORDING_FILES = ['game-night-l1.json', 'game-night-l2.json', 'game-night-l3.json', 'game-night-run.json'];

const SAMPLE = 'Sample reply (practice mode).';

// A fingerprint of a team and task: every agent's exact instructions, its lead, and its checker.
// A replay happens only when this matches the recorded run, so an edited team never gets old replies.
export function teamSignature(team, task) {
  const parts = team.agents.map(a => {
    const lead = a.parentId ? byId(team, a.parentId)?.name : '';
    const checker = a.checkerId ? byId(team, a.checkerId)?.name : '';
    return `${a.name}|${lead}|${checker}|${a.maxRounds}|${buildInstructions(team, a)}`;
  }).sort();
  return hash(`${String(task || '').trim().replace(/\s+/g, ' ')}\n${parts.join('\n')}`);
}

function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// Fetches every recording that exists. Missing or broken files are skipped.
export async function loadRecordings(base, fetchFn = globalThis.fetch) {
  const out = [];
  await Promise.all(RECORDING_FILES.map(async file => {
    try {
      const res = await fetchFn(new URL(file, base));
      if (!res.ok) return;
      const rec = await res.json();
      const r = prepareRecording(rec, file);
      if (r) out.push(r);
    } catch { /* skipped */ }
  }));
  return out;
}

export function prepareRecording(rec, file = '') {
  if (!rec || !Array.isArray(rec.calls) || !rec.team || typeof rec.task !== 'string') return null;
  const team = sanitizeTeam(rec.team);
  return { file, preset: rec.preset, level: rec.level, model: rec.model, date: rec.date, task: rec.task, calls: rec.calls, signature: teamSignature(team, rec.task) };
}

export function findRecording(recordings, team, task) {
  const sig = teamSignature(team, task);
  return recordings.find(r => r.signature === sig) || null;
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    if (!ms) { resolve(); return; }
    const t = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
    const onAbort = () => { clearTimeout(t); reject(abortError()); };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function abortError() {
  const e = new Error('Stopped.');
  e.name = 'AbortError';
  return e;
}

function headings(system) {
  return [...String(system || '').matchAll(/^## (.+)$/gm)].map(m => m[1].trim());
}

const PART_LABELS = ['Role', 'Goal', 'Steps', 'Rules', 'Output', 'Done when'];

function sampleWork(req) {
  const { agentName, job } = req.meta || {};
  const have = headings(req.system).filter(h => PART_LABELS.includes(h));
  const missing = PART_LABELS.filter(p => !have.includes(p));
  const lines = [
    `${SAMPLE} ${agentName || 'This agent'} would do its job here${job ? `: ${job.replace(/\.$/, '')}` : ''}.`,
    have.length
      ? `Parts it was given: ${have.join(', ')}.`
      : 'It was given a name and a job line only, so it would have to guess the rest.',
  ];
  if (have.length && missing.length) lines.push(`Parts it would have to guess: ${missing.join(', ')}.`);
  return lines.join('\n\n');
}

function samplePlan(req) {
  const helpers = req.meta?.helpers?.length ? req.meta.helpers : (req.meta?.helperNames || []).map(name => ({ name, job: '' }));
  return JSON.stringify({
    note: `${SAMPLE} One job for each helper.`,
    jobs: helpers.map(h => ({ helper: h.name, job: h.job ? `${h.job} (for this task: ${req.meta?.task || 'the task'})` : `Your part of this task: ${req.meta?.task || 'the task'}` })),
  });
}

function sampleCombine(req) {
  const last = req.messages[req.messages.length - 1]?.text || '';
  const names = [...last.matchAll(/^### (.+)$/gm)].map(m => m[1].trim());
  return `${SAMPLE} ${req.meta?.agentName || 'The lead'} would put the reports together here${names.length ? `, from ${names.join(', ')}` : ''}.`;
}

function sampleCheck(req) {
  const items = req.meta?.items || [];
  const first = (req.meta?.round || 1) <= 1;
  return JSON.stringify({
    checks: items.map((item, i) => ({
      item,
      pass: !(first && i === 0),
      note: first && i === 0 ? 'Sample note: practice mode fails this line in round 1, so you can see a send-back.' : 'Sample note: passes.',
    })),
    feedback: first ? `${SAMPLE} Fix the first line, then send it back.` : `${SAMPLE} Looks good.`,
  });
}

function sampleRevise(req) {
  return `${SAMPLE} ${req.meta?.agentName || 'The agent'} would send a new version here that fixes every note (round ${req.meta?.round || 2}).`;
}

/**
 * @param {object} opts
 * @param {Array} opts.recordings from loadRecordings()
 * @param {[number, number]} opts.delay min and max milliseconds per reply
 */
export function createPracticeAdapter({ recordings = [], delay = [450, 1100], random = Math.random } = {}) {
  let queues = null;
  let active = null;
  return {
    mode: 'practice',
    model: 'practice',
    get replaying() { return active; },
    begin(team, task) {
      active = findRecording(recordings, team, task);
      queues = new Map();
      if (active) {
        for (const c of active.calls) {
          const k = `${c.agent}\u0000${c.kind}`;
          if (!queues.has(k)) queues.set(k, []);
          queues.get(k).push(c.text);
        }
      }
    },
    async generate(req) {
      const [lo, hi] = delay;
      await wait(Math.round(lo + (hi - lo) * random()), req.signal);
      const k = `${req.meta?.agentName}\u0000${req.kind}`;
      const q = queues?.get(k);
      if (q && q.length) return { text: q.shift(), model: active.model, replay: true };
      switch (req.kind) {
        case 'plan': return { text: samplePlan(req), model: 'practice' };
        case 'combine': return { text: sampleCombine(req), model: 'practice' };
        case 'check': return { text: sampleCheck(req), model: 'practice' };
        case 'revise': return { text: sampleRevise(req), model: 'practice' };
        default: return { text: sampleWork(req), model: 'practice' };
      }
    },
  };
}

// Walk-through: turns a finished run into steps, one message between agents per step,
// with what the receiving agent saw when that message reached it. No DOM in here.
// The built-in example and your own runs both go through recordTrace() and stepsOf().

import { runTeam, sanitizeTeam, byId } from './engine.js';
import { createPracticeAdapter, prepareRecording } from './practice.js';

// Watches a run: every message the engine sends, and every time an agent asks the AI (what it was sent).
// It wraps adapter.generate in place, so the engine's calls and their order stay exactly the same.
export function recorder(adapter) {
  let seq = 0;
  const messages = [];
  const calls = [];
  const generate = adapter.generate.bind(adapter);
  adapter.generate = async req => {
    calls.push({
      seq: seq++,
      agentId: req.meta?.agentId,
      kind: req.kind,
      system: req.system,
      messages: (req.messages || []).map(m => ({ role: m.role, text: m.text })),
    });
    return generate(req);
  };
  return {
    adapter,
    onMessage(ev) {
      if (ev.lab) return;
      const { type, ...m } = ev;
      messages.push({ ...m, seq: seq++ });
    },
    trace(team, task, extra = {}) {
      return { team: JSON.parse(JSON.stringify(team)), task, messages: messages.slice(), calls: calls.slice(), ...extra };
    },
  };
}

const between = m => m.from !== 'you' && m.to !== 'you' && m.to !== 'team';

// One step per message. `saw` is the receiver's next request to the AI after the message arrived:
// its instructions, the chat before, and the new message. Stats count up to and including the step.
export function stepsOf(trace) {
  let msgs = 0;
  let rounds = 0;
  return trace.messages.map(m => {
    if (between(m)) msgs += 1;
    if (m.kind === 'check') rounds += 1;
    const next = trace.calls.find(c => c.seq > m.seq && c.agentId === m.to);
    const saw = next && next.messages.length
      ? { instructions: next.system, before: next.messages.slice(0, -1), message: next.messages[next.messages.length - 1].text }
      : null;
    const calls = trace.calls.filter(c => c.seq < m.seq).length;
    return { ...m, saw, stats: { msgs, rounds, calls } };
  });
}

const KIND_WORD = { job: 'Job', note: 'Plan', draft: 'First draft', check: 'Check', revise: 'New version', report: 'Report', final: 'Final answer' };

export function nameOf(team, id) {
  if (id === 'you') return 'You';
  if (id === 'team') return 'the team';
  return byId(team, id)?.name || 'Agent';
}

// "Event Lead → Flyer Writer · Job"
export function stepTag(step, team) {
  const kind = step.from === 'you' ? 'Task' : KIND_WORD[step.kind] || step.kind;
  const round = (step.kind === 'check' || step.kind === 'revise') && step.round ? ` · round ${step.round}` : '';
  const to = step.to === 'team' ? 'Team' : nameOf(team, step.to);
  return `${nameOf(team, step.from)} → ${to} · ${kind}${round}`;
}

// "Event Lead gives Flyer Writer its job"
export function stepLabel(step, team) {
  const from = nameOf(team, step.from);
  const to = nameOf(team, step.to);
  if (step.from === 'you') return `You give ${to} the task`;
  switch (step.kind) {
    case 'note': return `${from} tells the team the plan`;
    case 'job': return `${from} gives ${to} its job`;
    case 'draft': return `${from} sends its first draft to ${to}`;
    case 'revise': return `${from} sends a new version to ${to}`;
    case 'check':
      if (step.pass) return `${from} passes ${to}'s work`;
      if (step.capped) return `${from} still fails ${to}'s work at the round limit`;
      return `${from} sends ${to}'s work back`;
    case 'report': return `${from} sends its work to ${to}`;
    case 'final': return `${from} sends you the final answer`;
    default: return `${from} sends a message to ${to}`;
  }
}

// The built-in example: the recorded Game Night level 4 run, replayed through the engine with no delay.
// Every reply is the recording's; nothing goes over the network.
export async function exampleTrace(rec) {
  const team = sanitizeTeam(rec.team);
  const prepared = prepareRecording(rec, 'example');
  const adapter = createPracticeAdapter({ recordings: [prepared], delay: [0, 0] });
  adapter.begin(team, rec.task);
  if (!adapter.replaying) throw new Error('The example recording does not match its team.');
  const r = recorder(adapter);
  const res = await runTeam(team, rec.task, { adapter: r.adapter, onEvent: ev => { if (ev.type === 'message') r.onMessage(ev); } });
  return r.trace(team, rec.task, { example: true, status: res.status, model: rec.model, date: rec.date });
}

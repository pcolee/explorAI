// Engine tests with a fake model adapter. Run: node --test meetings/meeting-6/lab/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runTeam, newAgent, buildInstructions, windowFor, checkTeam, normalizePlan, normalizeChecks,
  parseJSON, roleOf, sanitizeTeam, DEFAULT_LIMITS, wordCount,
} from '../engine.js';
import { PRESETS, presetTeam, presetTask } from '../presets.js';

// A fake adapter: `reply(req)` returns the text for each call (or throws). Every request is kept.
function fake(reply, { delay = 0 } = {}) {
  const calls = [];
  let inFlight = 0;
  let maxInFlight = 0;
  return {
    calls,
    get maxInFlight() { return maxInFlight; },
    async generate(req) {
      calls.push(req);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        if (delay) {
          await new Promise((resolve, reject) => {
            const t = setTimeout(resolve, delay);
            req.signal?.addEventListener('abort', () => { clearTimeout(t); const e = new Error('aborted'); e.name = 'AbortError'; reject(e); }, { once: true });
          });
        }
        const text = await reply(req);
        return { text, model: 'fake' };
      } finally {
        inFlight -= 1;
      }
    },
  };
}

function collect() {
  const events = [];
  return { events, onEvent: e => events.push(e), of: type => events.filter(e => e.type === type) };
}

const team = agents => ({ agents });

function gameTeam({ checker = false, maxRounds = 3 } = {}) {
  const lead = newAgent({ id: 'lead', name: 'Event Lead', job: 'Runs the team.' });
  const flyer = newAgent({ id: 'flyer', name: 'Flyer Writer', job: 'Writes the flyer.', parentId: 'lead', doneWhen: ['Has the day, time, and room', 'Under 40 words'], maxRounds });
  const caption = newAgent({ id: 'cap', name: 'Caption Writer', job: 'Writes the caption.', parentId: 'lead' });
  const snacks = newAgent({ id: 'snk', name: 'Snack Planner', job: 'Plans snacks.', parentId: 'lead' });
  const agents = [lead, flyer, caption, snacks];
  if (checker) {
    const c = newAgent({ id: 'chk', name: 'Flyer Checker', job: 'Checks the flyer.' });
    flyer.checkerId = 'chk';
    agents.push(c);
  }
  return team(agents);
}

const plan = jobs => JSON.stringify({ note: 'Splitting it three ways.', jobs });
const allJobs = plan([
  { helper: 'Flyer Writer', job: 'Write the flyer.' },
  { helper: 'Caption Writer', job: 'Write the caption.' },
  { helper: 'Snack Planner', job: 'Plan snacks.' },
]);

test('single agent: one call, the task as the message, the answer back to the person', async () => {
  const a = fake(() => 'GAME NIGHT Friday 6pm');
  const ev = collect();
  const t = team([newAgent({ id: 'x', name: 'Flyer Writer', job: 'Writes the flyer.' })]);
  const r = await runTeam(t, 'Write a flyer.', { adapter: a, onEvent: ev.onEvent });
  assert.equal(r.status, 'done');
  assert.equal(r.final, 'GAME NIGHT Friday 6pm');
  assert.equal(a.calls.length, 1);
  assert.equal(a.calls[0].system, 'You are Flyer Writer. Your job: Writes the flyer.');
  assert.deepEqual(a.calls[0].messages, [{ role: 'user', text: 'Write a flyer.' }]);
  assert.equal(a.calls[0].kind, 'work');
  const msgs = ev.of('message');
  assert.deepEqual(msgs.map(m => [m.from, m.to, m.kind]), [['you', 'x', 'job'], ['x', 'you', 'final']]);
  assert.equal(ev.events[0].type, 'run-start');
  assert.equal(ev.events.at(-1).type, 'run-done');
  assert.equal(r.stats.calls, 1);
  assert.equal(r.stats.agents, 1);
  assert.equal(r.stats.agentMessages, 0);
});

test('structured agent: the six parts become labeled sections, empty ones left out', () => {
  const a = newAgent({
    name: 'Flyer Writer', job: 'Writes the flyer.', role: 'You write flyers.', goal: 'Get people to come.',
    steps: 'Find the facts\nWrite a headline', rules: '- No hashtags', output: '', doneWhen: ['Under 40 words'],
  });
  const text = buildInstructions(team([a]), a);
  assert.equal(text, [
    'You are Flyer Writer. Your job: Writes the flyer.',
    '## Role\nYou write flyers.',
    '## Goal\nGet people to come.',
    '## Steps\n1. Find the facts\n2. Write a headline',
    '## Rules\n- No hashtags',
    '## Done when\n- Under 40 words',
  ].join('\n\n'));
  assert.ok(!text.includes('## Output'));
});

test('structured agent: a run sends those instructions as the system text', async () => {
  const ag = newAgent({ id: 'x', name: 'Writer', job: 'Writes.', role: 'You write.', rules: 'Be brief' });
  const a = fake(() => 'ok');
  await runTeam(team([ag]), 'Go', { adapter: a });
  assert.match(a.calls[0].system, /## Role\nYou write\./);
  assert.match(a.calls[0].system, /## Rules\n- Be brief/);
});

test('what it sees: instructions, messages so far, new message', () => {
  const t = gameTeam();
  const w = windowFor(t, t.agents[1], 'Plan game night');
  assert.match(w.instructions, /Event Lead is your lead/);
  assert.deepEqual(w.messages, []);
  assert.match(w.newMessage, /Job from Event Lead/);
  const top = windowFor(t, t.agents[0], 'Plan game night');
  assert.equal(top.newMessage, 'Plan game night');
  const after = windowFor(t, t.agents[1], 'x', [
    { role: 'user', text: 'job' }, { role: 'model', text: 'v1' }, { role: 'user', text: 'notes' }, { role: 'model', text: 'v2' },
  ]);
  assert.deepEqual(after.messages.map(m => m.text), ['job', 'v1']);
  assert.equal(after.newMessage, 'notes');
  assert.equal(after.reply, 'v2');
});

test('team instructions: lead lists helpers, helper names its lead, checker never gives jobs', () => {
  const t = gameTeam({ checker: true });
  const lead = buildInstructions(t, t.agents[0]);
  assert.match(lead, /Your helpers:\n- Flyer Writer: Writes the flyer\.\n- Caption Writer/);
  assert.match(lead, /You answer the person who asked/);
  const flyer = buildInstructions(t, t.agents[1]);
  assert.match(flyer, /send your work back to Event Lead only/);
  assert.match(flyer, /Flyer Checker checks your work/);
  const chk = buildInstructions(t, t.agents[4]);
  assert.match(chk, /never give jobs/);
  assert.equal(roleOf(t, 'lead'), 'lead');
  assert.equal(roleOf(t, 'flyer'), 'helper');
  assert.equal(roleOf(t, 'chk'), 'checker');
});

test('delegation with a valid plan: jobs down, reports up, the lead combines', async () => {
  const a = fake(req => {
    if (req.kind === 'plan') return allJobs;
    if (req.kind === 'combine') return 'KIT';
    return `${req.meta.agentName} work`;
  });
  const ev = collect();
  const r = await runTeam(gameTeam(), 'Plan game night', { adapter: a, onEvent: ev.onEvent });
  assert.equal(r.status, 'done');
  assert.equal(r.final, 'KIT');
  assert.deepEqual(a.calls.map(c => c.kind), ['plan', 'work', 'work', 'work', 'combine']);
  const plan0 = a.calls[0];
  assert.deepEqual(plan0.schema.properties.jobs.items.properties.helper.enum, ['Flyer Writer', 'Caption Writer', 'Snack Planner']);
  const flyerCall = a.calls.find(c => c.meta.agentName === 'Flyer Writer');
  assert.equal(flyerCall.messages[0].text, 'Job from Event Lead:\nWrite the flyer.');
  const combine = a.calls.at(-1);
  assert.match(combine.messages.at(-1).text, /### Flyer Writer\nFlyer Writer work/);
  assert.equal(combine.messages.length, 3, 'the lead keeps its own conversation: plan prompt, plan reply, reports');
  const kinds = ev.of('message').map(m => `${m.kind}:${m.from}>${m.to}`);
  assert.deepEqual(kinds.filter(k => k.startsWith('job:lead')), ['job:lead>flyer', 'job:lead>cap', 'job:lead>snk']);
  assert.equal(kinds.filter(k => k.startsWith('report:')).length, 3);
  assert.equal(kinds.at(-1), 'final:lead>you');
  assert.ok(ev.of('message').some(m => m.kind === 'note' && m.text === 'Splitting it three ways.'));
  assert.equal(r.stats.agentMessages, 6);
  assert.equal(r.stats.agents, 4);
});

test('delegation with a broken plan: every helper gets the whole task', async () => {
  for (const bad of ['not json at all', '{"note":"x","jobs":[]}', '{"jobs":[{"helper":"Nobody","job":"x"}]}']) {
    const a = fake(req => (req.kind === 'plan' ? bad : req.kind === 'combine' ? 'KIT' : 'w'));
    const ev = collect();
    const r = await runTeam(gameTeam(), 'Plan game night', { adapter: a, onEvent: ev.onEvent });
    assert.equal(r.status, 'done', bad);
    const jobs = ev.of('message').filter(m => m.kind === 'job' && m.from === 'lead');
    assert.equal(jobs.length, 3);
    assert.ok(jobs.every(j => j.text === 'Plan game night'));
    assert.ok(ev.of('message').some(m => m.lab && /every helper gets the whole task/.test(m.text)));
  }
});

test('plan: unknown names dropped, two jobs for one helper merged, unassigned helpers noted', async () => {
  const p = normalizePlan({ note: 'n', jobs: [{ helper: 'flyer writer', job: 'A' }, { helper: 'Flyer Writer', job: 'B' }, { helper: 'Ghost', job: 'C' }] },
    gameTeam().agents.slice(1), 'T');
  assert.equal(p.jobs.get('flyer'), 'A\nB');
  assert.equal(p.dropped, 1);
  assert.equal(p.broken, false);
  const a = fake(req => (req.kind === 'plan' ? plan([{ helper: 'Flyer Writer', job: 'Flyer.' }]) : 'w'));
  const ev = collect();
  await runTeam(gameTeam(), 'T', { adapter: a, onEvent: ev.onEvent });
  assert.equal(a.calls.filter(c => c.kind === 'work').length, 1);
  assert.ok(ev.of('message').some(m => m.lab && /gave Caption Writer no job/.test(m.text)));
});

test('nested helpers: a helper can lead its own helpers', async () => {
  const t = team([
    newAgent({ id: 'top', name: 'Top' }),
    newAgent({ id: 'mid', name: 'Mid', parentId: 'top' }),
    newAgent({ id: 'leaf', name: 'Leaf', parentId: 'mid' }),
  ]);
  const a = fake(req => {
    if (req.kind === 'plan' && req.meta.agentName === 'Top') return plan([{ helper: 'Mid', job: 'Do the middle part.' }]);
    if (req.kind === 'plan' && req.meta.agentName === 'Mid') return plan([{ helper: 'Leaf', job: 'Do the leaf part.' }]);
    if (req.kind === 'combine') return `${req.meta.agentName} combined`;
    return 'leaf work';
  });
  const ev = collect();
  const r = await runTeam(t, 'Task', { adapter: a, onEvent: ev.onEvent });
  assert.equal(r.status, 'done');
  assert.equal(r.final, 'Top combined');
  assert.deepEqual(a.calls.map(c => `${c.meta.agentName}:${c.kind}`), ['Top:plan', 'Mid:plan', 'Leaf:work', 'Mid:combine', 'Top:combine']);
  assert.match(a.calls[1].messages[0].text, /^Job from Top:\nDo the middle part\./);
  assert.deepEqual(ev.of('message').filter(m => m.kind === 'report').map(m => `${m.from}>${m.to}`), ['leaf>mid', 'mid>top']);
});

function checkReply(passes, feedback = 'Fix it.') {
  return JSON.stringify({
    checks: [
      { item: 'Has the day, time, and room', pass: passes[0], note: passes[0] ? 'ok' : 'No room.' },
      { item: 'Under 40 words', pass: passes[1], note: passes[1] ? 'ok' : 'Too long.' },
    ],
    feedback,
  });
}

test('check loop that passes early: one check, no revision', async () => {
  const a = fake(req => {
    if (req.kind === 'plan') return allJobs;
    if (req.kind === 'check') return checkReply([true, true], 'Looks good');
    if (req.kind === 'combine') return 'KIT';
    return 'draft';
  });
  const ev = collect();
  const r = await runTeam(gameTeam({ checker: true }), 'T', { adapter: a, onEvent: ev.onEvent });
  assert.equal(r.status, 'done');
  assert.equal(ev.of('check-result').length, 1);
  assert.equal(ev.of('check-result')[0].pass, true);
  assert.equal(a.calls.filter(c => c.kind === 'revise').length, 0);
  assert.equal(r.stats.checkRounds, 1);
  assert.equal(r.stats.sendBacks, 0);
  const chk = a.calls.find(c => c.kind === 'check');
  assert.deepEqual(chk.schema.properties.checks.items.properties.item.enum, ['Has the day, time, and room', 'Under 40 words']);
  assert.match(chk.messages[0].text, /Length \(counted by the lab page\): 1 words/);
});

test('check loop: a fail sends work back with notes, the revision passes, the report carries the revision', async () => {
  let round = 0;
  const a = fake(req => {
    if (req.kind === 'plan') return allJobs;
    if (req.kind === 'check') { round += 1; return round === 1 ? checkReply([false, true]) : checkReply([true, true], 'Looks good'); }
    if (req.kind === 'revise') return 'flyer v2';
    if (req.kind === 'combine') return 'KIT';
    return req.meta.agentName === 'Flyer Writer' ? 'flyer v1' : 'w';
  });
  const ev = collect();
  const r = await runTeam(gameTeam({ checker: true }), 'T', { adapter: a, onEvent: ev.onEvent });
  assert.equal(r.status, 'done');
  assert.equal(r.stats.checkRounds, 2);
  assert.equal(r.stats.sendBacks, 1);
  const revise = a.calls.find(c => c.kind === 'revise');
  assert.equal(revise.meta.agentName, 'Flyer Writer');
  assert.match(revise.messages.at(-1).text, /FAIL Has the day, time, and room: No room\./);
  assert.deepEqual(revise.messages.map(m => m.role), ['user', 'model', 'user'], 'the revision sees its own first draft');
  const report = ev.of('message').find(m => m.kind === 'report' && m.from === 'flyer');
  assert.equal(report.text, 'flyer v2');
  assert.deepEqual(ev.of('round').map(e => e.round), [1, 2]);
  const second = a.calls.filter(c => c.kind === 'check')[1];
  assert.equal(second.messages.length, 3, 'the checker keeps its own conversation across rounds');
});

test('check loop that hits the round cap: stops, says why, keeps the last version', async () => {
  let v = 0;
  const a = fake(req => {
    if (req.kind === 'plan') return allJobs;
    if (req.kind === 'check') return checkReply([true, false]);
    if (req.kind === 'revise') { v += 1; return `flyer v${v + 1}`; }
    if (req.kind === 'combine') return 'KIT';
    return req.meta.agentName === 'Flyer Writer' ? 'flyer v1' : 'w';
  });
  const ev = collect();
  const r = await runTeam(gameTeam({ checker: true, maxRounds: 2 }), 'T', { adapter: a, onEvent: ev.onEvent });
  assert.equal(r.status, 'done');
  assert.equal(r.stats.checkRounds, 2);
  assert.equal(a.calls.filter(c => c.kind === 'revise').length, 1);
  const lim = ev.of('limit');
  assert.equal(lim.length, 1);
  assert.equal(lim[0].limit, 'maxRounds');
  assert.equal(lim[0].fatal, false);
  assert.match(lim[0].message, /stopped after 2 rounds \(the round limit\)\. Still failing: Under 40 words/);
  assert.equal(ev.of('message').find(m => m.kind === 'report' && m.from === 'flyer').text, 'flyer v2');
  // The engine's limit wins over an agent asking for more rounds.
  const b = fake(req => (req.kind === 'plan' ? allJobs : req.kind === 'check' ? checkReply([false, false]) : 'w'));
  const r2 = await runTeam(gameTeam({ checker: true }), 'T', { adapter: b, limits: { maxRounds: 1 } });
  assert.equal(r2.stats.checkRounds, 1);
});

test('checks: pass is computed from every line, never taken from the model', () => {
  const items = ['A', 'B'];
  assert.equal(normalizeChecks({ checks: [{ item: 'A', pass: true }], feedback: 'all good', pass: true }, items).pass, false);
  assert.equal(normalizeChecks({ checks: [{ item: 'B', pass: true }, { item: 'A', pass: true }] }, items).pass, true);
  assert.equal(normalizeChecks({ checks: [{ item: 'A', pass: 'yes' }, { item: 'B', pass: true }] }, items).pass, false);
  assert.equal(normalizeChecks(null, items).pass, false);
  assert.equal(normalizeChecks(parseJSON('```json\n{"checks":[{"item":"A","pass":true},{"item":"B","pass":true}]}\n```'), items).pass, true);
});

test('call limit: the run ends cleanly and names the limit', async () => {
  const a = fake(req => (req.kind === 'plan' ? allJobs : req.kind === 'check' ? checkReply([false, false]) : 'w'));
  const ev = collect();
  const r = await runTeam(gameTeam({ checker: true }), 'T', { adapter: a, onEvent: ev.onEvent, limits: { maxCalls: 5 } });
  assert.equal(r.status, 'limit');
  assert.equal(r.limit, 'maxCalls');
  assert.equal(a.calls.length, 5);
  assert.match(ev.of('limit')[0].message, /limit of 5 model calls/);
  assert.equal(ev.events.at(-1).type, 'run-done');
});

test('team limits: agents, depth, and helpers per lead are checked before any call', async () => {
  const many = team([newAgent({ id: 't', name: 'T' }), ...Array.from({ length: 8 }, (_, i) => newAgent({ id: `h${i}`, name: `H${i}`, parentId: 't' }))]);
  const a = fake(() => 'x');
  const r = await runTeam(many, 'go', { adapter: a });
  assert.equal(r.status, 'limit');
  assert.equal(r.limit, 'maxAgents');
  assert.equal(a.calls.length, 0);
  const five = team([newAgent({ id: 't', name: 'T' }), ...Array.from({ length: 5 }, (_, i) => newAgent({ id: `h${i}`, name: `H${i}`, parentId: 't' }))]);
  assert.equal(checkTeam(five).problems[0].limit, 'maxHelpers');
  const deep = team([newAgent({ id: 'a', name: 'A' }), newAgent({ id: 'b', name: 'B', parentId: 'a' }), newAgent({ id: 'c', name: 'C', parentId: 'b' }), newAgent({ id: 'd', name: 'D', parentId: 'c' })]);
  assert.equal(checkTeam(deep).problems[0].limit, 'maxDepth');
  assert.match(checkTeam(deep).problems[0].message, /4 levels deep/);
  const two = team([newAgent({ id: 'a', name: 'A' }), newAgent({ id: 'b', name: 'B' })]);
  assert.match(checkTeam(two).problems[0].message, /Only one agent can be at the top/);
  assert.equal(checkTeam(gameTeam({ checker: true })).ok, true);
  assert.deepEqual(Object.keys(DEFAULT_LIMITS).sort(), ['maxAgents', 'maxCalls', 'maxConcurrent', 'maxDepth', 'maxHelpers', 'maxRounds']);
});

test('at most 2 model calls in flight at once', async () => {
  const a = fake(req => (req.kind === 'plan' ? allJobs : 'w'), { delay: 15 });
  await runTeam(gameTeam(), 'T', { adapter: a });
  assert.equal(a.maxInFlight, 2);
});

test('Stop cancels requests in flight and ends the run as stopped', async () => {
  const ctl = new AbortController();
  const a = fake(req => (req.kind === 'plan' ? allJobs : 'w'), { delay: 40 });
  const ev = collect();
  setTimeout(() => ctl.abort(), 60);
  const r = await runTeam(gameTeam(), 'T', { adapter: a, signal: ctl.signal, onEvent: ev.onEvent });
  assert.equal(r.status, 'stopped');
  assert.ok(a.calls.length < 5, `stopped before the end (${a.calls.length} calls)`);
  assert.ok(!ev.of('message').some(m => m.kind === 'final'));
  assert.equal(ev.events.at(-1).type, 'run-done');
});

test('waiting: the adapter\'s rate-limit wait shows in the events', async () => {
  const a = fake(async req => { req.onWait(12, 'rate'); return 'ok'; });
  const ev = collect();
  await runTeam(team([newAgent({ id: 'x', name: 'X' })]), 'T', { adapter: a, onEvent: ev.onEvent });
  assert.deepEqual(ev.of('waiting').map(e => [e.agentId, e.seconds, e.reason]), [['x', 12, 'rate']]);
});

test('adapter errors end the run with the adapter\'s friendly message', async () => {
  const a = fake(() => { const e = new Error('raw'); e.friendly = 'Google says this key is not valid. Copy the whole key again from Google AI Studio, or switch to practice mode.'; e.kind = 'badKey'; e.retryable = false; throw e; });
  const ev = collect();
  const r = await runTeam(team([newAgent({ id: 'x', name: 'X' })]), 'T', { adapter: a, onEvent: ev.onEvent });
  assert.equal(r.status, 'error');
  assert.equal(r.errorKind, 'badKey');
  const err = ev.of('error')[0];
  assert.match(err.message, /or switch to practice mode\.$/);
  assert.equal(err.retryable, false);
  const b = fake(() => { throw new TypeError('boom'); });
  const r2 = await runTeam(team([newAgent({ id: 'x', name: 'X' })]), 'T', { adapter: b });
  assert.match(r2.error, /Press Retry, or switch to practice mode\./);
});

test('empty task and empty team give a plain message, no calls', async () => {
  const a = fake(() => 'x');
  const r = await runTeam(team([newAgent({ id: 'x', name: 'X' })]), '   ', { adapter: a });
  assert.equal(r.status, 'error');
  assert.match(r.error, /Type a task first/);
  const r2 = await runTeam(team([]), 'go', { adapter: a });
  assert.match(r2.error, /Add an agent first/);
  assert.equal(a.calls.length, 0);
});

test('a share link or saved team is rebuilt from known fields only', () => {
  const t = sanitizeTeam({ agents: [
    { id: 'a', name: '<img src=x onerror=alert(1)>', color: 'red;background:url(x)', job: 'j', evil: 'x', parentId: 'zzz', doneWhen: ['one', 2, ''] },
    { id: 'a', name: 'Dupe' },
  ] });
  assert.equal(t.agents.length, 2);
  assert.notEqual(t.agents[0].id, t.agents[1].id);
  assert.equal(t.agents[0].color, '#3F5A2A');
  assert.equal(t.agents[0].parentId, null);
  assert.equal('evil' in t.agents[0], false);
  assert.deepEqual(t.agents[0].doneWhen, ['one'], 'non-text lines are dropped');
  assert.deepEqual(sanitizeTeam(null), { agents: [] });
});

test('presets: every preset and level is a valid team with a task', () => {
  for (const p of PRESETS) {
    for (const level of [1, 2, 3, 4]) {
      const t = presetTeam(p.id, level);
      const v = checkTeam(t);
      assert.ok(v.ok, `${p.id} level ${level}: ${v.problems.map(x => x.message).join('; ')}`);
      assert.ok(presetTask(p.id, level).length > 20);
      assert.equal(t.agents.length, level <= 2 ? 1 : level === 3 ? 4 : 5);
      if (level === 4) {
        const main = t.agents.find(a => a.id === p.main);
        assert.equal(roleOf(t, main.checkerId), 'checker');
        assert.ok(main.doneWhen.length >= 2);
      }
    }
  }
  // Fresh copies: editing one level's team never changes the preset.
  const a = presetTeam('game-night', 4);
  a.agents[1].doneWhen.push('changed');
  assert.ok(!presetTeam('game-night', 4).agents[1].doneWhen.includes('changed'));
});

test('game night preset matches the deck: Event Lead, three helpers, Flyer Checker with three done-when lines', () => {
  const t = presetTeam('game-night', 4);
  assert.deepEqual(t.agents.map(a => a.name), ['Event Lead', 'Flyer Writer', 'Caption Writer', 'Snack Planner', 'Flyer Checker']);
  assert.deepEqual(t.agents[1].doneWhen, ['Has the day, time, and room', 'Under 40 words', 'Ends with one clear thing to do']);
});

test('word count', () => {
  assert.equal(wordCount('Game night! Friday, 6-8 pm in CIS A-204.'), 8);
  assert.equal(wordCount(''), 0);
});

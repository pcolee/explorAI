// Practice adapter tests: sample replies for any team, exact replay of a recorded run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runTeam, checkTeam, newAgent } from '../engine.js';
import { presetTeam, presetTask, PRESETS } from '../presets.js';
import { createPracticeAdapter, prepareRecording, teamSignature } from '../practice.js';

const fast = { delay: [0, 0] };

test('practice: every level of every preset runs to the end with sample replies', async () => {
  for (const p of PRESETS) {
    for (const level of [1, 2, 3, 4]) {
      const team = presetTeam(p.id, level);
      const r = await runTeam(team, presetTask(p.id, level), { adapter: createPracticeAdapter(fast) });
      assert.equal(r.status, 'done', `${p.id} level ${level}`);
      assert.match(r.final, /Sample reply \(practice mode\)/);
      if (level === 4) {
        assert.equal(r.stats.checkRounds, 2, 'samples fail round 1 and pass round 2');
        assert.equal(r.stats.sendBacks, 1);
      }
    }
  }
});

test('practice: sample replies name the parts the agent was given and the ones it would guess', async () => {
  const a = createPracticeAdapter(fast);
  const one = await runTeam(presetTeam('game-night', 1), presetTask('game-night', 1), { adapter: a });
  assert.match(one.final, /name and a job line only/);
  const two = await runTeam(presetTeam('game-night', 2), presetTask('game-night', 2), { adapter: a });
  assert.match(two.final, /Parts it was given: Role, Goal, Steps, Rules, Output, Done when\./);
  const partial = { agents: [newAgent({ id: 'x', name: 'Writer', job: 'Writes.', role: 'You write.' })] };
  const three = await runTeam(partial, 'Go', { adapter: a });
  assert.match(three.final, /Parts it would have to guess: Goal, Steps, Rules, Output, Done when\./);
});

test('practice: an exact recorded team and task replays the recorded replies; any edit falls back to samples', async () => {
  const team = presetTeam('game-night', 3);
  const task = presetTask('game-night', 3);
  const calls = [
    { agent: 'Event Lead', kind: 'plan', text: JSON.stringify({ note: 'Recorded note.', jobs: [{ helper: 'Flyer Writer', job: 'Flyer job.' }, { helper: 'Caption Writer', job: 'Caption job.' }, { helper: 'Snack Planner', job: 'Snack job.' }] }) },
    { agent: 'Flyer Writer', kind: 'work', text: 'Recorded flyer.' },
    { agent: 'Caption Writer', kind: 'work', text: 'Recorded caption.' },
    { agent: 'Snack Planner', kind: 'work', text: 'Recorded snacks.' },
    { agent: 'Event Lead', kind: 'combine', text: 'Recorded kit.' },
  ];
  const rec = prepareRecording({ preset: 'game-night', level: 3, model: 'gemini-test', date: '2026-10-28', task, team, calls });
  const a = createPracticeAdapter({ ...fast, recordings: [rec] });
  const r = await runTeam(team, task, { adapter: a });
  assert.equal(r.final, 'Recorded kit.');
  assert.equal(a.replaying.model, 'gemini-test');

  const edited = presetTeam('game-night', 3);
  edited.agents[1].rules += '\nOne more rule';
  const b = createPracticeAdapter({ ...fast, recordings: [rec] });
  const r2 = await runTeam(edited, task, { adapter: b });
  assert.equal(b.replaying, null);
  assert.match(r2.final, /Sample reply/);

  const c = createPracticeAdapter({ ...fast, recordings: [rec] });
  await runTeam(team, `${task} Also add a raffle.`, { adapter: c });
  assert.equal(c.replaying, null, 'a different task is not replayed');
  assert.notEqual(teamSignature(team, task), teamSignature(edited, task));
});

test('practice: Stop works during the reply delay', async () => {
  const ctl = new AbortController();
  setTimeout(() => ctl.abort(), 30);
  const r = await runTeam(presetTeam('game-night', 4), presetTask('game-night', 4), { adapter: createPracticeAdapter({ delay: [200, 200] }), signal: ctl.signal });
  assert.equal(r.status, 'stopped');
});

test('team check: names must be filled in and different', () => {
  const t = { agents: [newAgent({ id: 'a', name: 'Writer' }), newAgent({ id: 'b', name: 'writer ', parentId: 'a' })] };
  assert.match(checkTeam(t).problems[0].message, /Two agents are named writer/);
  t.agents[1].name = '';
  assert.match(checkTeam(t).problems[0].message, /Every agent needs a name/);
});

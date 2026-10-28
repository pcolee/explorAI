// The walk-through and the built-in example: the example is the recorded run, word for word,
// and every step knows what its receiver saw.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import EXAMPLE from '../example-run.js';
import { exampleTrace, stepsOf, stepLabel, stepTag, nameOf } from '../walk.js';

const rec = JSON.parse(fs.readFileSync(new URL('../examples/game-night-run.json', import.meta.url), 'utf8'));

test('example-run.js matches the recorded JSON exactly', () => {
  assert.deepEqual(EXAMPLE, rec);
});

test('example trace replays the recording: same messages, same counts', async () => {
  const trace = await exampleTrace(EXAMPLE);
  assert.equal(trace.status, 'done');
  const steps = stepsOf(trace);
  assert.equal(steps.length, rec.counts.messages);
  assert.equal(trace.calls.length, rec.counts.modelCalls);
  const last = steps[steps.length - 1];
  assert.equal(last.stats.msgs, rec.counts.messagesBetweenAgents);
  assert.equal(last.stats.rounds, rec.counts.checkRounds);
  assert.equal(last.stats.calls, rec.counts.modelCalls);
  const key = m => `${m.from}|${m.to}|${m.kind}|${m.text}`;
  const nm = id => (id === 'you' || id === 'team' ? id : nameOf(trace.team, id));
  const got = steps.map(s => key({ ...s, from: nm(s.from), to: nm(s.to) })).sort();
  const want = rec.messages.map(key).sort();
  assert.deepEqual(got, want);
});

test('steps: labels, tags, and what the receiver saw', async () => {
  const trace = await exampleTrace(EXAMPLE);
  const steps = stepsOf(trace);
  assert.equal(stepLabel(steps[0], trace.team), 'You give Event Lead the task');
  assert.equal(stepTag(steps[0], trace.team), 'You → Event Lead · Task');
  const job = steps.find(s => s.kind === 'job' && s.from !== 'you');
  assert.match(stepLabel(job, trace.team), /^Event Lead gives .+ its job$/);
  assert.ok(job.saw, 'a helper sees its job');
  assert.ok(job.saw.message.includes(job.text), 'the new message holds the job text');
  assert.match(job.saw.instructions, /## /);
  const back = steps.find(s => s.kind === 'check' && !s.pass);
  assert.equal(stepLabel(back, trace.team), 'Flyer Checker sends Flyer Writer\'s work back');
  assert.equal(stepTag(back, trace.team), 'Flyer Checker → Flyer Writer · Check · round 1');
  assert.ok(back.saw.before.length >= 2, 'the Flyer Writer saw its earlier turns');
  const final = steps[steps.length - 1];
  assert.equal(final.kind, 'final');
  assert.equal(final.saw, null);
  assert.equal(stepLabel(final, trace.team), 'Event Lead sends you the final answer');
});

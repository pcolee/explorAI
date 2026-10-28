// The recorded Game Night run: it must match the preset exactly (or practice mode stops replaying it),
// replay to the same counts, hold a real send-back, and carry nothing email-like.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runTeam, wordCount } from '../engine.js';
import { presetTeam, presetTask } from '../presets.js';
import { createPracticeAdapter, prepareRecording, RECORDING_FILES } from '../practice.js';

const file = new URL('../examples/game-night-run.json', import.meta.url);
const rec = JSON.parse(fs.readFileSync(file, 'utf8'));

test('recording: has the model, the date, every message, and the counts', () => {
  assert.match(rec.model, /^gemini-/);
  assert.match(rec.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(rec.preset, 'game-night');
  assert.equal(rec.level, 4);
  for (const k of ['agents', 'messages', 'messagesBetweenAgents', 'checkRounds', 'sendBacks', 'modelCalls']) assert.equal(typeof rec.counts[k], 'number', k);
  assert.equal(rec.messages.filter(m => !m.lab).length, rec.counts.messages);
  assert.equal(rec.calls.length, rec.counts.modelCalls);
  assert.ok(rec.counts.sendBacks >= 1, 'the Flyer Checker sent the flyer back at least once');
  assert.ok(RECORDING_FILES.includes('game-night-run.json'));
});

test('recording: every send-back is honest against the page\'s own word count', () => {
  const versions = rec.messages.filter(m => m.from === 'Flyer Writer' && (m.kind === 'draft' || m.kind === 'revise'));
  const checks = rec.messages.filter(m => m.kind === 'check');
  assert.equal(versions.length, checks.length);
  checks.forEach((c, i) => {
    const words = wordCount(versions[i].text);
    const line = c.checks.find(x => x.item === 'Under 40 words');
    assert.equal(line.pass, words < 40, `round ${c.round}: ${words} words graded ${line.pass ? 'pass' : 'fail'}`);
  });
  assert.equal(checks.at(-1).pass, true, 'the last round passed');
});

test('recording: matches the current Game Night preset, so practice mode replays it to the same counts', async () => {
  const prepared = prepareRecording(rec, 'game-night-run.json');
  const team = presetTeam('game-night', 4);
  const adapter = createPracticeAdapter({ recordings: [prepared], delay: [0, 0] });
  const r = await runTeam(team, presetTask('game-night', 4), { adapter });
  assert.ok(adapter.replaying, 'the preset still matches the recording; re-record with tests/record.mjs after changing the Game Night preset');
  assert.equal(r.final, rec.final);
  assert.equal(r.stats.checkRounds, rec.counts.checkRounds);
  assert.equal(r.stats.sendBacks, rec.counts.sendBacks);
  assert.equal(r.stats.agentMessages, rec.counts.messagesBetweenAgents);
});

test('recording: nothing email-like', () => {
  assert.ok(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/.test(fs.readFileSync(file, 'utf8')));
});

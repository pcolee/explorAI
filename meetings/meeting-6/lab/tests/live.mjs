// Live check against the real Gemini API. The key comes only from the GEMINI_API_KEY environment variable
// and is never printed. About 15 model calls. Run from the repo root:
//   GEMINI_API_KEY=... node meetings/meeting-6/lab/tests/live.mjs
import { createGeminiAdapter } from '../gemini.js';
import { runTeam } from '../engine.js';
import { presetTeam, presetTask } from '../presets.js';

const key = process.env.GEMINI_API_KEY || '';
if (!key) {
  console.error('Set GEMINI_API_KEY first. Nothing was sent.');
  process.exit(2);
}

const results = [];
const note = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`); };
const adapter = createGeminiAdapter({ key, onModel: (m, why) => console.log(`(switched to ${m}: ${why})`) });

async function run(name, team, task) {
  const waits = [];
  const r = await runTeam(team, task, { adapter, onEvent: e => { if (e.type === 'waiting') waits.push(`${e.seconds}s ${e.reason}`); } });
  if (waits.length) console.log(`  waits: ${waits.join(', ')}`);
  if (r.status !== 'done') console.log(`  ${name} ended as ${r.status}: ${r.error || r.message || ''}`);
  return r;
}

try {
  const info = await adapter.checkKey({ ping: true });
  note('key check', Boolean(info.model), `model ${info.model}; usable: ${info.available.join(', ')}`);

  const one = await run('one agent', presetTeam('game-night', 1), presetTask('game-night', 1));
  note('one agent', one.status === 'done' && one.final.length > 20, `${one.stats.calls} call, ${(one.ms / 1000).toFixed(1)} s, ${one.final.split(/\s+/).length} words`);

  const team = await run('team', presetTeam('game-night', 3), presetTask('game-night', 3));
  const ok3 = team.status === 'done' && team.stats.agents === 4 && team.stats.agentMessages === 6;
  note('team of a lead and three helpers', ok3, `${team.stats.calls} calls, ${team.stats.agentMessages} messages between agents, ${(team.ms / 1000).toFixed(1)} s`);

  // The Game Night preset's Flyer Writer and Flyer Checker on their own. The writer's rules (full sentences, every game
  // by name) pull against "Under 40 words", so a first draft often runs long. Nothing is faked; if the model passes on
  // the first try, the run is repeated (up to 3 times).
  let loop;
  let sendBacks = 0;
  for (let attempt = 1; attempt <= 3 && !sendBacks; attempt += 1) {
    const full = presetTeam('game-night', 4);
    const writer = full.agents.find(a => a.name === 'Flyer Writer');
    const checker = full.agents.find(a => a.name === 'Flyer Checker');
    writer.parentId = null;
    loop = await run('check loop', { agents: [writer, checker] }, presetTask('game-night', 4));
    sendBacks = loop.stats.sendBacks;
    console.log(`  attempt ${attempt}: ${loop.stats.checkRounds} check rounds, ${sendBacks} send-backs`);
  }
  note('check loop with at least one send-back', loop.status === 'done' && sendBacks >= 1, `${loop.stats.checkRounds} rounds, ${sendBacks} send-backs, final ${loop.final ? loop.final.split(/\s+/).length : 0} words`);
} catch (err) {
  note('no crash', false, err?.friendly || err?.message || String(err));
}

const failed = results.filter(r => !r.ok);
console.log(failed.length ? `${failed.length} failed` : 'all live checks passed');
process.exit(failed.length ? 1 : 0);

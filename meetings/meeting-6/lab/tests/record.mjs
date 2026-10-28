// Records a real run of a preset for practice mode and the deck. The key comes only from GEMINI_API_KEY.
// Every reply is saved exactly as the model wrote it; nothing is edited.
//   GEMINI_API_KEY=... node meetings/meeting-6/lab/tests/record.mjs <preset> <level> <out.json|--dry> [--need-sendback]
import fs from 'node:fs';
import { createGeminiAdapter } from '../gemini.js';
import { runTeam, byId } from '../engine.js';
import { presetTeam, presetTask } from '../presets.js';

const [presetId = 'game-night', levelArg = '4', out = '--dry'] = process.argv.slice(2);
const needSendBack = process.argv.includes('--need-sendback');
const level = Number(levelArg);
const key = process.env.GEMINI_API_KEY || '';
if (!key) { console.error('Set GEMINI_API_KEY first. Nothing was sent.'); process.exit(2); }

const base = createGeminiAdapter({ key });
await base.checkKey({ ping: false });
const calls = [];
const models = new Set();
const adapter = {
  mode: 'gemini',
  async generate(req) {
    const res = await base.generate(req);
    models.add(res.model);
    calls.push({ agent: req.meta.agentName, kind: req.kind, round: req.meta.round ?? null, text: res.text });
    return res;
  },
};

const team = presetTeam(presetId, level);
const task = presetTask(presetId, level);
const messages = [];
const name = id => (id === 'you' || id === 'team' || id === 'lab' ? id : byId(team, id)?.name || id);
const started = new Date();
const r = await runTeam(team, task, {
  adapter,
  onEvent: e => {
    if (e.type === 'message') {
      const m = { from: name(e.from), to: name(e.to), kind: e.kind, text: e.text };
      if (e.round != null) m.round = e.round;
      if (e.checks) { m.checks = e.checks.map(c => ({ item: c.item, pass: c.pass, note: c.note })); m.pass = e.pass; }
      if (e.lab) m.lab = true;
      messages.push(m);
    }
    if (e.type === 'waiting') console.log(`  waiting ${e.seconds}s (${e.reason})`);
  },
});

const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(started);
const rec = {
  about: 'A real run of this preset, recorded from the Gemini API by tests/record.mjs. Every reply is the model\'s text as it came back. Practice mode replays it when the team and task match exactly.',
  preset: presetId,
  level,
  model: [...models].join(', '),
  date: day,
  recordedAt: started.toISOString(),
  task,
  counts: {
    agents: r.stats.agents,
    messages: r.stats.messages,
    messagesBetweenAgents: r.stats.agentMessages,
    checkRounds: r.stats.checkRounds,
    sendBacks: r.stats.sendBacks,
    modelCalls: r.stats.calls,
    seconds: Math.round(r.ms / 100) / 10,
  },
  messages,
  calls,
  final: r.final,
  team,
};

const flyer = messages.filter(m => m.from === 'Flyer Writer' && (m.kind === 'draft' || m.kind === 'revise'));
console.log(`status ${r.status}; model ${rec.model}; ${JSON.stringify(rec.counts)}`);
for (const m of messages.filter(x => x.kind === 'check')) console.log(`  check round ${m.round}: ${m.checks.map(c => `${c.pass ? 'PASS' : 'FAIL'} ${c.item}`).join(' | ')}`);
for (const f of flyer) console.log(`  ${f.kind} (round ${f.round}): ${f.text.replace(/\s+/g, ' ')}`);

const json = JSON.stringify(rec, null, 2);
if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/.test(json)) { console.error('The run has an email-like string; not saved.'); process.exit(1); }
if (r.status !== 'done') { console.error(`Run ended as ${r.status}; not saved.`); process.exit(1); }
if (needSendBack && !r.stats.sendBacks) { console.error('No send-back in this run; not saved.'); process.exit(3); }
if (out !== '--dry') { fs.writeFileSync(out, `${json}\n`); console.log(`saved ${out}`); }

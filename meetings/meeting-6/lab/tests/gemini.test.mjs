// Gemini adapter tests with a fake fetch and a fake clock. No network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGeminiAdapter, readError, parseDelay, classify, GeminiError, FRIENDLY, PREFERRED_MODELS } from '../gemini.js';
import { runTeam } from '../engine.js';
import { presetTeam, presetTask } from '../presets.js';

const MODELS_ALL = { models: PREFERRED_MODELS.map(m => ({ name: `models/${m}`, supportedGenerationMethods: ['generateContent'] })) };

function ok(text, extra = {}) {
  return { status: 200, body: { candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }], modelVersion: extra.modelVersion, usageMetadata: {} } };
}
function err(status, code, message, details = []) {
  return { status, body: { error: { code: status, status: code, message, details } } };
}
const retryInfo = s => ({ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: s });
const quota = (quotaId, quotaValue) => ({ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId, quotaValue }] });
const errorInfo = reason => ({ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason, domain: 'googleapis.com' });

// reply(call, n) returns { status, body } or throws (a network error).
function harness(reply, opts = {}) {
  const calls = [];
  const clock = { t: 0 };
  const waits = [];
  const switches = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const fetch = async (url, init) => {
    const call = { url: String(url), method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : null, model: String(url).match(/models\/([^:?]+):/)?.[1] };
    calls.push(call);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      if (opts.fetchDelay) await new Promise(r => setTimeout(r, opts.fetchDelay));
      const r = await reply(call, calls.length);
      return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
    } finally {
      inFlight -= 1;
    }
  };
  const sleep = async (ms, signal) => {
    if (signal?.aborted) { const e = new Error('Stopped.'); e.name = 'AbortError'; throw e; }
    clock.t += ms;
  };
  const adapter = createGeminiAdapter({
    key: 'test-key-123', fetch, sleep, now: () => clock.t, random: () => 0, onModel: (m, why) => switches.push([m, why]), ...opts.adapter,
  });
  return { adapter, calls, clock, waits, switches, get maxInFlight() { return maxInFlight; } };
}

const req = (extra = {}) => ({ kind: 'work', system: 'You are X.', messages: [{ role: 'user', text: 'Hi' }], maxOutputTokens: 900, ...extra });

test('key check: lists models with the key in a header, picks the best one, pings it', async () => {
  const h = harness(c => (c.method === 'GET' ? { status: 200, body: { models: [
    { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3.1-flash-lite', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-embedding', supportedGenerationMethods: ['embedContent'] },
  ] } } : ok('OK')));
  const info = await h.adapter.checkKey();
  assert.equal(info.model, 'gemini-3.1-flash-lite');
  assert.deepEqual(info.available, ['gemini-3.1-flash-lite', 'gemini-3.8-flash']);
  assert.equal(h.calls[0].headers['x-goog-api-key'], 'test-key-123');
  assert.ok(!h.calls.some(c => c.url.includes('test-key-123')), 'the key never goes in a URL');
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].model, 'gemini-3.1-flash-lite');
});

test('key check: no usable model, bad key, and no key each give a plain message', async () => {
  const none = harness(() => ({ status: 200, body: { models: [{ name: 'models/gemma-4-31b-it', supportedGenerationMethods: ['generateContent'] }] } }));
  await assert.rejects(none.adapter.checkKey(), e => e.kind === 'nomodel' && /practice mode\.$/.test(e.friendly));
  const bad = harness(() => err(400, 'INVALID_ARGUMENT', 'API key not valid. Please pass a valid API key.', [errorInfo('API_KEY_INVALID')]));
  await assert.rejects(bad.adapter.checkKey(), e => e.kind === 'badKey' && e.friendly === FRIENDLY.badKey && e.retryable === false);
  const empty = createGeminiAdapter({ key: '' });
  await assert.rejects(empty.checkKey(), e => e.kind === 'nokey');
});

test('request shape: system instruction, roles, JSON schema, thinking level, length cap', async () => {
  const h = harness(() => ok('{"note":"n","jobs":[]}'));
  const schema = { type: 'object', properties: { note: { type: 'string' } } };
  await h.adapter.generate(req({ kind: 'plan', schema, maxOutputTokens: 600, messages: [{ role: 'user', text: 'a' }, { role: 'model', text: 'b' }, { role: 'user', text: 'c' }] }));
  const b = h.calls[0].body;
  assert.equal(h.calls[0].model, 'gemini-3.5-flash-lite');
  assert.deepEqual(b.systemInstruction, { parts: [{ text: 'You are X.' }] });
  assert.deepEqual(b.contents.map(c => c.role), ['user', 'model', 'user']);
  assert.equal(b.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(b.generationConfig.responseJsonSchema, schema);
  assert.deepEqual(b.generationConfig.thinkingConfig, { thinkingLevel: 'MINIMAL' });
  assert.equal(b.generationConfig.maxOutputTokens, 600);
  assert.equal(h.calls[0].headers['x-goog-api-key'], 'test-key-123');
  assert.ok(!('thinkingBudget' in (b.generationConfig.thinkingConfig || {})));
});

test('request shape: gemini-3.8-flash gets LOW thinking and extra room', async () => {
  const h = harness(() => ok('x'), { adapter: { models: ['gemini-3.8-flash'] } });
  await h.adapter.generate(req());
  assert.deepEqual(h.calls[0].body.generationConfig.thinkingConfig, { thinkingLevel: 'LOW' });
  assert.equal(h.calls[0].body.generationConfig.maxOutputTokens, 1600);
});

test('reply text skips thought parts and survives missing parts', async () => {
  const h = harness((c, n) => (n === 1
    ? { status: 200, body: { candidates: [{ content: { parts: [{ text: 'thinking...', thought: true }, { text: 'Answer' }] } }] } }
    : { status: 200, body: { candidates: [{ finishReason: 'SAFETY' }] } }));
  assert.equal((await h.adapter.generate(req())).text, 'Answer');
  await assert.rejects(h.adapter.generate(req()), e => e.kind === 'blocked');
});

test('rate pacing: never more than the per-minute pace, and the wait shows', async () => {
  const h = harness(() => ok('x'), { adapter: { rpm: 3, minGapMs: 0 } });
  const waits = [];
  for (let i = 0; i < 4; i += 1) await h.adapter.generate(req({ onWait: (s, why) => waits.push([s, why]) }));
  assert.equal(h.calls.length, 4);
  assert.ok(h.clock.t >= 60000, `the 4th call waited for the window (${h.clock.t} ms)`);
  assert.deepEqual(waits, [[60, 'pace']]);
});

test('rate pacing: a short gap between calls, at most 2 in flight', async () => {
  const h = harness(() => ok('x'), { adapter: { minGapMs: 700 }, fetchDelay: 5 });
  await Promise.all([1, 2, 3, 4, 5].map(() => h.adapter.generate(req())));
  assert.equal(h.maxInFlight, 2);
  assert.ok(h.clock.t >= 700 * 4, `gaps kept (${h.clock.t} ms)`);
});

test('429 per minute: waits the retryDelay the API gives, shows it, then succeeds', async () => {
  const h = harness((c, n) => (n === 1 ? err(429, 'RESOURCE_EXHAUSTED', 'Quota exceeded', [quota('GenerateRequestsPerMinutePerProjectPerModel-FreeTier', '5'), retryInfo('7.2s')]) : ok('done')));
  const waits = [];
  const r = await h.adapter.generate(req({ onWait: (s, why) => waits.push([s, why]) }));
  assert.equal(r.text, 'done');
  assert.deepEqual(waits, [[8, 'rate']]);
  assert.ok(h.clock.t >= 8000);
  assert.equal(h.adapter.paceLimit, 5, 'the pace drops to the per-minute limit Google named');
  assert.equal(h.calls.length, 2);
});

test('429 with no details: treated as per minute with a 10 s wait', async () => {
  const h = harness((c, n) => (n === 1 ? err(429, 'RESOURCE_EXHAUSTED', 'busy') : ok('done')));
  const waits = [];
  await h.adapter.generate(req({ onWait: (s, why) => waits.push(s) }));
  assert.deepEqual(waits, [10]);
});

test('model fallback: a daily quota on one model moves to the next and says so', async () => {
  const h = harness(c => (c.model === 'gemini-3.5-flash-lite'
    ? err(429, 'RESOURCE_EXHAUSTED', 'Quota exceeded', [quota('GenerateRequestsPerDayPerProjectPerModel-FreeTier', '20'), retryInfo('30s')])
    : ok(`from ${c.model}`)));
  const r = await h.adapter.generate(req());
  assert.equal(r.text, 'from gemini-3.1-flash-lite');
  assert.deepEqual(h.switches, [['gemini-3.1-flash-lite', 'daily']]);
  assert.equal(h.clock.t < 30000, true, 'no point waiting on a daily cap');
  await h.adapter.generate(req());
  assert.equal(h.calls.at(-1).model, 'gemini-3.1-flash-lite', 'later calls stay on the working model');
});

test('model fallback: a missing model (404) moves on; every model out of quota gives the daily message', async () => {
  const h = harness(c => (c.model === 'gemini-3.5-flash-lite' ? err(404, 'NOT_FOUND', 'model not found') : ok('ok')));
  assert.equal((await h.adapter.generate(req())).text, 'ok');
  const all = harness(() => err(429, 'RESOURCE_EXHAUSTED', 'q', [quota('GenerateRequestsPerDayPerProjectPerModel-FreeTier', '20')]));
  await assert.rejects(all.adapter.generate(req()), e => e.kind === 'quota' && /midnight Pacific time/.test(e.friendly));
  assert.equal(all.calls.length, PREFERRED_MODELS.length);
});

test('model fallback: a model that stays at its per-minute limit after 3 waits moves on', async () => {
  const h = harness(c => (c.model === 'gemini-3.5-flash-lite' ? err(429, 'RESOURCE_EXHAUSTED', 'q', [retryInfo('5s')]) : ok('ok')));
  assert.equal((await h.adapter.generate(req())).text, 'ok');
  assert.deepEqual(h.switches, [['gemini-3.1-flash-lite', 'rate']]);
  assert.equal(h.calls.filter(c => c.model === 'gemini-3.5-flash-lite').length, 4);
});

test('400 on an optional setting: retries once without thinking, and remembers', async () => {
  const h = harness(c => (c.body.generationConfig.thinkingConfig
    ? err(400, 'INVALID_ARGUMENT', 'Thinking level MINIMAL is not supported for this model.')
    : ok('fine')));
  assert.equal((await h.adapter.generate(req())).text, 'fine');
  assert.equal(h.calls.length, 2);
  assert.ok(!h.calls[1].body.generationConfig.thinkingConfig);
  await h.adapter.generate(req());
  assert.equal(h.calls.length, 3, 'the next call goes straight without the setting');
});

test('400 on the schema: drops the schema field but keeps JSON output; a third 400 is a plain error', async () => {
  const schema = { type: 'object' };
  const h = harness(c => (c.body.generationConfig.responseJsonSchema || c.body.generationConfig.thinkingConfig ? err(400, 'INVALID_ARGUMENT', 'bad field') : ok('{}')));
  await h.adapter.generate(req({ schema }));
  assert.equal(h.calls.length, 3);
  assert.equal(h.calls[2].body.generationConfig.responseMimeType, 'application/json');
  assert.ok(!h.calls[2].body.generationConfig.responseJsonSchema);
  const always = harness(() => err(400, 'INVALID_ARGUMENT', 'Request contains an invalid argument.'));
  await assert.rejects(always.adapter.generate(req({ schema })), e => e.kind === 'request' && /practice mode\.$/.test(e.friendly));
  assert.equal(always.calls.length, 3);
});

test('friendly errors: bad key, API off, leaked key, region, permission', async () => {
  const cases = [
    [err(400, 'INVALID_ARGUMENT', 'API key not valid. Please pass a valid API key.', [errorInfo('API_KEY_INVALID')]), 'badKey'],
    [err(403, 'PERMISSION_DENIED', 'Generative Language API has not been used in project 1 before or it is disabled.', [errorInfo('SERVICE_DISABLED')]), 'disabled'],
    [err(403, 'PERMISSION_DENIED', 'Your API key was reported as leaked. Please use another API key.'), 'leaked'],
    [err(400, 'FAILED_PRECONDITION', 'User location is not supported for the API use.'), 'region'],
    [err(403, 'PERMISSION_DENIED', 'Your project has been denied access.'), 'denied'],
  ];
  for (const [reply, kind] of cases) {
    const h = harness(() => reply);
    await assert.rejects(h.adapter.generate(req()), e => e instanceof GeminiError && e.kind === kind, kind);
    assert.equal(h.calls.length, 1, `${kind} is not retried`);
  }
  for (const [k, text] of Object.entries(FRIENDLY)) assert.match(text, /practice mode\.$/, `${k} ends with a way forward`);
});

test('network errors and 5xx retry with backoff, then give a plain message', async () => {
  const flaky = harness((c, n) => { if (n < 3) throw new TypeError('Failed to fetch'); return ok('back'); });
  assert.equal((await flaky.adapter.generate(req())).text, 'back');
  assert.equal(flaky.calls.length, 3);
  const down = harness(() => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(down.adapter.generate(req()), e => e.kind === 'network' && e.retryable);
  assert.equal(down.calls.length, 3);
  const busy = harness((c, n) => (n === 1 ? err(503, 'UNAVAILABLE', 'overloaded') : ok('ok')));
  assert.equal((await busy.adapter.generate(req())).text, 'ok');
  assert.ok(busy.clock.t >= 800, 'backed off before retrying');
  const dead = harness(() => err(500, 'INTERNAL', 'x'));
  await assert.rejects(dead.adapter.generate(req()), e => e.kind === 'server');
});

test('timeout: each request is cut off, retried once, then a plain message', async () => {
  let n = 0;
  const fetch = (url, init) => new Promise((resolve, reject) => {
    n += 1;
    init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); });
  });
  const a = createGeminiAdapter({ key: 'k', fetch, timeoutMs: 20, sleep: async () => {}, minGapMs: 0 });
  await assert.rejects(a.generate(req()), e => e.kind === 'timeout' && /45 seconds/.test(e.friendly));
  assert.equal(n, 2);
});

test('an empty reply cut off at the length cap retries once with twice the room', async () => {
  const h = harness((c, n) => (n === 1 ? { status: 200, body: { candidates: [{ finishReason: 'MAX_TOKENS', content: {} }] } } : ok('full')));
  assert.equal((await h.adapter.generate(req({ maxOutputTokens: 600 }))).text, 'full');
  assert.equal(h.calls[1].body.generationConfig.maxOutputTokens, 1200);
  const never = harness(() => ({ status: 200, body: { candidates: [{ finishReason: 'MAX_TOKENS' }] } }));
  await assert.rejects(never.adapter.generate(req()), e => e.kind === 'cutoff');
});

test('Stop: an abort during a wait ends the call', async () => {
  const ctl = new AbortController();
  const h = harness(() => { ctl.abort(); return err(429, 'RESOURCE_EXHAUSTED', 'q', [retryInfo('20s')]); });
  await assert.rejects(h.adapter.generate(req({ signal: ctl.signal })), e => e.name === 'AbortError');
});

test('a whole team run through the adapter: plans, checks, and the waits reach the thread', async () => {
  let checks = 0;
  const h = harness((c, n) => {
    const kind = c.body.generationConfig.responseJsonSchema?.properties?.jobs ? 'plan' : c.body.generationConfig.responseJsonSchema?.properties?.checks ? 'check' : 'text';
    if (n === 2) return err(429, 'RESOURCE_EXHAUSTED', 'q', [retryInfo('3s')]);
    if (kind === 'plan') return ok(JSON.stringify({ note: 'Three jobs.', jobs: [{ helper: 'Flyer Writer', job: 'Flyer' }, { helper: 'Caption Writer', job: 'Caption' }, { helper: 'Snack Planner', job: 'Snacks' }] }));
    if (kind === 'check') {
      checks += 1;
      const items = c.body.generationConfig.responseJsonSchema.properties.checks.items.properties.item.enum;
      return ok(JSON.stringify({ checks: items.map((item, i) => ({ item, pass: checks > 1 || i !== 1, note: 'n' })), feedback: 'Cut it down.' }));
    }
    return ok('some text');
  });
  const events = [];
  const r = await runTeam(presetTeam('game-night', 4), presetTask('game-night', 4), { adapter: h.adapter, onEvent: e => events.push(e) });
  assert.equal(r.status, 'done');
  assert.equal(r.stats.sendBacks, 1);
  assert.ok(events.some(e => e.type === 'waiting' && e.seconds === 3 && e.reason === 'rate'));
});

test('readError and parseDelay read Google\'s error details', () => {
  const info = readError(429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'm', details: [quota('GenerateRequestsPerDayPerProjectPerModel-FreeTier', '20'), retryInfo('30.5s')] } });
  assert.equal(info.perDay, true);
  assert.equal(info.retryDelay, 30.5);
  assert.equal(parseDelay({ seconds: 2, nanos: 500000000 }), 2.5);
  assert.equal(parseDelay('soon'), null);
  assert.equal(classify(readError(403, { error: { status: 'PERMISSION_DENIED', message: 'Method doesn\'t allow unregistered callers' } })), 'nokey');
  assert.equal(classify(readError(500, null)), null);
});

// Fixes from the overnight lab review (2026-10-28).

test('a bare 429 waits but does not lower the pace for the rest of the session', async () => {
  const h = harness((c, n) => (n === 1 ? err(429, 'RESOURCE_EXHAUSTED', 'busy') : ok('done')));
  const before = h.adapter.paceLimit;
  await h.adapter.generate(req());
  assert.equal(h.adapter.paceLimit, before);
  const t0 = h.clock.t;
  for (let i = 0; i < 8; i += 1) await h.adapter.generate(req());
  assert.ok(h.clock.t - t0 < 60000, `8 more calls took ${h.clock.t - t0} ms on the fake clock`);
});

test('a JSON reply cut off at the length cap retries once with twice the room', async () => {
  const cut = { status: 200, body: { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"checks":[{"item":"A","pa' }] } }] } };
  const h = harness((c, n) => (n === 1 ? cut : ok('{"checks":[]}')));
  const r = await h.adapter.generate(req({ schema: { type: 'object' }, maxOutputTokens: 600 }));
  assert.equal(r.text, '{"checks":[]}');
  assert.equal(h.calls[1].body.generationConfig.maxOutputTokens, 1200);
  const plain = harness(() => cut);
  assert.equal((await plain.adapter.generate(req())).text, '{"checks":[{"item":"A","pa', 'plain text that was cut is still shown');
  assert.equal(plain.calls.length, 1);
});

test('a 400 caused by the schema drops the schema first and leaves thinking on', async () => {
  const schema = { type: 'object' };
  const h = harness(c => (c.body.generationConfig.responseJsonSchema ? err(400, 'INVALID_ARGUMENT', 'Invalid JSON payload: responseJsonSchema') : ok('{}')));
  await h.adapter.generate(req({ schema }));
  assert.equal(h.calls.length, 2);
  assert.ok(h.calls[1].body.generationConfig.thinkingConfig, 'thinking stays on');
  await h.adapter.generate(req());
  assert.ok(h.calls[2].body.generationConfig.thinkingConfig, 'a later plain call keeps thinking');
  await h.adapter.generate(req({ schema }));
  assert.equal(h.calls.length, 4, 'a later schema call goes straight without the schema');
});

test('a setting is not remembered as unsupported when the retry without it also fails', async () => {
  let n = 0;
  const h = harness(c => { n += 1; return n <= 2 ? err(400, 'INVALID_ARGUMENT', 'Thinking level is wrong') : ok('fine'); });
  await assert.rejects(h.adapter.generate(req()), e => e.kind === 'request');
  await h.adapter.generate(req());
  assert.ok(h.calls.at(-1).body.generationConfig.thinkingConfig, 'thinking was not turned off for good');
});

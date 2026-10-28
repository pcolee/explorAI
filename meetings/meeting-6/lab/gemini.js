// Gemini adapter: key check, model pick, requests, pacing, retries, fallbacks, friendly errors.
// Model IDs and request fields were checked against Google's docs and the live models list on 2026-10-27.

export const API = 'https://generativelanguage.googleapis.com/v1beta';

// Best first. All are stable models with a free tier; the key check keeps the ones this key can use.
export const PREFERRED_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-flash-lite-latest',
];

// Lowest thinking level each model accepts (thinking time counts against the reply's length cap).
const THINKING = {
  'gemini-3.5-flash-lite': 'MINIMAL',
  'gemini-3.1-flash-lite': 'MINIMAL',
  'gemini-3.6-flash': 'MINIMAL',
  'gemini-3.8-flash': 'LOW',
  'gemini-flash-lite-latest': 'MINIMAL',
};
const EXTRA_TOKENS = { 'gemini-3.6-flash': 300, 'gemini-3.8-flash': 700 };

export const FRIENDLY = {
  nokey: 'Paste your Gemini key first, or switch to practice mode.',
  badKey: 'Google says this key is not valid. Copy the whole key again from Google AI Studio, or switch to practice mode.',
  disabled: 'The Gemini API is turned off for this key\'s project. Make a new key in Google AI Studio, or switch to practice mode.',
  leaked: 'Google blocked this key because it was posted publicly. Make a new key in Google AI Studio, or switch to practice mode.',
  denied: 'Google refused this key (error 403, permission denied). Make a new key in Google AI Studio, or switch to practice mode.',
  region: 'Google doesn\'t offer the Gemini API where this connection comes from. If a VPN is on, turn it off and press Retry, or switch to practice mode.',
  quota: 'This key has used up today\'s free requests on every model the lab can use. They come back at midnight Pacific time. For now, switch to practice mode.',
  rate: 'Google\'s free limit is still full after waiting. Wait a minute and press Retry, or switch to practice mode.',
  network: 'The lab can\'t reach Google. Check the Wi-Fi and press Retry, or switch to practice mode.',
  timeout: 'Google took more than 45 seconds to answer. Press Retry, or switch to practice mode.',
  server: 'Google\'s servers are busy right now. Press Retry in a minute, or switch to practice mode.',
  blocked: 'Google\'s safety filter stopped this reply. Change the task or the instructions and press Run, or switch to practice mode.',
  cutoff: 'The reply ran past its length cap and came back empty. Ask for something shorter and press Run, or switch to practice mode.',
  nomodel: 'This key can\'t use any of the fast Gemini models the lab needs. Make a new key in Google AI Studio, or switch to practice mode.',
  request: 'Google turned down the request. Press Retry, or switch to practice mode.',
};

export class GeminiError extends Error {
  constructor(kind, { status, detail, retryable } = {}) {
    super(detail ? `${FRIENDLY[kind] || kind} (${detail})` : (FRIENDLY[kind] || kind));
    this.name = 'GeminiError';
    this.kind = kind;
    this.status = status;
    this.detail = detail;
    this.friendly = FRIENDLY[kind] || FRIENDLY.request;
    this.retryable = retryable ?? !['badKey', 'disabled', 'leaked', 'denied', 'quota', 'blocked', 'cutoff', 'nomodel', 'nokey'].includes(kind);
  }
}

// "30s", "30.7s", or { seconds, nanos } to seconds.
export function parseDelay(v) {
  if (v == null) return null;
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d+(?:\.\d+)?)s$/);
    return m ? Number(m[1]) : null;
  }
  if (typeof v === 'object') {
    const s = Number(v.seconds || 0) + Number(v.nanos || 0) / 1e9;
    return Number.isFinite(s) ? s : null;
  }
  return null;
}

// Reads an error reply into the parts the adapter decides on.
export function readError(status, body) {
  const e = body?.error || {};
  const details = Array.isArray(e.details) ? e.details : [];
  const type = d => String(d?.['@type'] || '');
  const info = details.find(d => type(d).endsWith('ErrorInfo')) || {};
  const retry = details.find(d => type(d).endsWith('RetryInfo')) || {};
  const quota = details.find(d => type(d).endsWith('QuotaFailure')) || {};
  const violations = Array.isArray(quota.violations) ? quota.violations : [];
  const quotaIds = violations.map(v => String(v?.quotaId || v?.quotaMetric || ''));
  const perMinute = violations.find(v => /PerMinute/i.test(String(v?.quotaId || '')));
  return {
    status,
    code: String(e.status || ''),
    reason: String(info.reason || ''),
    message: String(e.message || ''),
    retryDelay: parseDelay(retry.retryDelay),
    quotaIds,
    perDay: quotaIds.some(id => /PerDay/i.test(id)),
    perMinuteLimit: perMinute && Number.isFinite(Number(perMinute.quotaValue)) ? Number(perMinute.quotaValue) : null,
  };
}

// Picks the kind of error that is not worth retrying as is, or null.
export function classify(info) {
  const { status, code, reason, message } = info;
  if (reason === 'API_KEY_INVALID' || status === 401) return 'badKey';
  if (reason === 'SERVICE_DISABLED') return 'disabled';
  if (/leaked/i.test(message)) return 'leaked';
  if (reason === 'API_KEY_SERVICE_BLOCKED') return 'denied';
  if (code === 'FAILED_PRECONDITION' && /location/i.test(message)) return 'region';
  if (status === 403) return /unregistered callers/i.test(message) ? 'nokey' : 'denied';
  return null;
}

function defaultSleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
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

/**
 * @param {object} o
 * @param {string} o.key the student's key; sent only in the x-goog-api-key header
 * @param {number} [o.rpm] client-side requests per minute. Google shows free-tier limits only inside AI Studio, so 15 is a
 *   guess; a 429 that names the real per-minute limit lowers it, and any other 429 waits the delay Google gives.
 */
export function createGeminiAdapter({
  key,
  fetch: fetchFn = (...a) => globalThis.fetch(...a),
  sleep = defaultSleep,
  now = () => Date.now(),
  random = Math.random,
  rpm = 15,
  minGapMs = 700,
  maxConcurrent = 2,
  timeoutMs = 45000,
  models = PREFERRED_MODELS,
  onModel = () => {},
} = {}) {
  let available = [...models];
  let current = 0;
  let limitPerMinute = rpm;
  const starts = [];
  const exhausted = new Set();
  const noThinking = new Set();
  const noSchema = new Set();
  let active = 0;
  const queue = [];

  const acquire = () => new Promise(resolve => {
    if (active < maxConcurrent) { active += 1; resolve(); } else queue.push(resolve);
  });
  const release = () => {
    const next = queue.shift();
    if (next) next(); else active -= 1;
  };

  // Keeps request starts under the per-minute pace and a short gap apart.
  async function pace(signal, onWait) {
    for (;;) {
      const t = now();
      while (starts.length && t - starts[0] >= 60000) starts.shift();
      let waitMs = 0;
      const last = starts[starts.length - 1];
      if (last != null) waitMs = Math.max(waitMs, minGapMs - (t - last));
      if (starts.length >= limitPerMinute) waitMs = Math.max(waitMs, starts[0] + 60000 - t);
      if (waitMs <= 0) { starts.push(t); return; }
      if (waitMs >= 1500) onWait?.(Math.ceil(waitMs / 1000), 'pace');
      await sleep(waitMs, signal);
    }
  }

  function model() { return available[current] || null; }

  function nextModel(reason) {
    exhausted.add(model());
    const k = available.findIndex(m => !exhausted.has(m));
    if (k < 0) return false;
    current = k;
    try { onModel(model(), reason); } catch { /* UI only */ }
    return true;
  }

  async function send(url, init, signal) {
    const ctl = new AbortController();
    let timedOut = false;
    const t = setTimeout(() => { timedOut = true; ctl.abort(); }, timeoutMs);
    const onAbort = () => ctl.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      const res = await fetchFn(url, { ...init, signal: ctl.signal });
      let body = null;
      try { body = await res.json(); } catch { body = null; }
      return { res, body };
    } catch (err) {
      if (signal?.aborted) throw abortError();
      if (timedOut) return { timeout: true };
      return { network: true, err };
    } finally {
      clearTimeout(t);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  function body(req, m, opts) {
    const gen = { maxOutputTokens: opts.tokens };
    if (req.schema) {
      gen.responseMimeType = 'application/json';
      if (opts.schema) gen.responseJsonSchema = req.schema;
    }
    if (opts.thinking && THINKING[m]) gen.thinkingConfig = { thinkingLevel: THINKING[m] };
    const out = {
      contents: req.messages.map(x => ({ role: x.role === 'model' ? 'model' : 'user', parts: [{ text: String(x.text ?? '') }] })),
      generationConfig: gen,
    };
    if (req.system) out.systemInstruction = { parts: [{ text: req.system }] };
    return out;
  }

  /** One model reply. Retries, waits, and falls back as needed; throws GeminiError with a friendly message. */
  async function generate(req) {
    if (!key) throw new GeminiError('nokey');
    const signal = req.signal;
    await acquire();
    try {
      let tries = 0;          // network, timeout, and 5xx tries on this model
      let rateWaits = 0;      // per-minute 429 waits on this model
      let boosted = false;    // one retry with a bigger cap after an empty MAX_TOKENS reply
      let timeouts = 0;
      let tokenBoost = 1;
      for (;;) {
        if (signal?.aborted) throw abortError();
        const m = model();
        if (!m) throw new GeminiError('nomodel');
        const opts = { thinking: !noThinking.has(m), schema: !noSchema.has(m), tokens: Math.round(((req.maxOutputTokens || 900) + (EXTRA_TOKENS[m] || 0)) * tokenBoost) };
        await pace(signal, req.onWait);
        const r = await send(`${API}/models/${encodeURIComponent(m)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify(body(req, m, opts)),
        }, signal);

        if (r.timeout || r.network) {
          if (r.timeout) timeouts += 1;
          tries += 1;
          if ((r.timeout && timeouts >= 2) || tries >= 3) throw new GeminiError(r.timeout ? 'timeout' : 'network');
          await sleep(backoff(tries), signal);
          continue;
        }

        const { res, body: data } = r;
        if (res.ok) {
          const cand = data?.candidates?.[0];
          const parts = Array.isArray(cand?.content?.parts) ? cand.content.parts : [];
          const text = parts.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('').trim();
          if (text) return { text, model: data?.modelVersion || m, finishReason: cand?.finishReason, usage: data?.usageMetadata };
          const finish = cand?.finishReason || (data?.promptFeedback?.blockReason ? 'BLOCKED' : '');
          if (finish === 'MAX_TOKENS' && !boosted) { boosted = true; tokenBoost = 2; continue; }
          if (finish === 'MAX_TOKENS') throw new GeminiError('cutoff');
          if (/SAFETY|BLOCK|PROHIBITED|RECITATION|SPII/i.test(finish)) throw new GeminiError('blocked');
          tries += 1;
          if (tries >= 3) throw new GeminiError('server', { detail: 'empty reply' });
          await sleep(backoff(tries), signal);
          continue;
        }

        const info = readError(res.status, data);
        const fatal = classify(info);
        if (fatal) throw new GeminiError(fatal, { status: res.status });

        if (res.status === 429) {
          if (info.perDay) {
            if (nextModel('daily')) { tries = 0; rateWaits = 0; continue; }
            throw new GeminiError('quota', { status: 429 });
          }
          if (rateWaits < 3) {
            rateWaits += 1;
            if (info.perMinuteLimit) limitPerMinute = Math.max(1, Math.min(limitPerMinute, info.perMinuteLimit));
            else limitPerMinute = Math.max(2, Math.min(limitPerMinute, starts.length - 1));
            const sec = Math.min(90, Math.max(1, Math.ceil(info.retryDelay ?? 10)));
            req.onWait?.(sec, 'rate');
            await sleep(sec * 1000, signal);
            continue;
          }
          if (nextModel('rate')) { tries = 0; rateWaits = 0; continue; }
          throw new GeminiError('rate', { status: 429 });
        }

        if (res.status === 404) {
          if (nextModel('missing')) { tries = 0; continue; }
          throw new GeminiError('nomodel', { status: 404 });
        }

        if (res.status === 400) {
          // An optional setting the model does not take: retry once without it, and remember.
          if (opts.thinking && THINKING[m]) { noThinking.add(m); continue; }
          if (req.schema && opts.schema) { noSchema.add(m); continue; }
          throw new GeminiError('request', { status: 400, retryable: false, detail: info.message.slice(0, 160) });
        }

        if (res.status >= 500 || res.status === 408) {
          tries += 1;
          if (tries >= 3) throw new GeminiError('server', { status: res.status });
          await sleep(backoff(tries), signal);
          continue;
        }

        throw new GeminiError('request', { status: res.status, detail: info.message.slice(0, 160) });
      }
    } finally {
      release();
    }
  }

  function backoff(n) {
    return Math.round(800 * 2 ** (n - 1) + random() * 400);
  }

  /** Lists the models this key can use, picks the best one, and (by default) makes one tiny call to prove it works. */
  async function checkKey({ signal, ping = true, onWait } = {}) {
    if (!key) throw new GeminiError('nokey');
    const names = new Set();
    let pageToken = '';
    for (let page = 0; page < 3; page += 1) {
      const url = `${API}/models?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
      const r = await send(url, { method: 'GET', headers: { 'x-goog-api-key': key } }, signal);
      if (r.timeout) throw new GeminiError('timeout');
      if (r.network) throw new GeminiError('network');
      if (!r.res.ok) {
        const info = readError(r.res.status, r.body);
        throw new GeminiError(classify(info) || (r.res.status >= 500 ? 'server' : 'request'), { status: r.res.status });
      }
      for (const mm of r.body?.models || []) {
        const methods = mm?.supportedGenerationMethods || [];
        if (methods.includes('generateContent')) names.add(String(mm.name || '').replace(/^models\//, ''));
      }
      pageToken = r.body?.nextPageToken || '';
      if (!pageToken) break;
    }
    available = models.filter(m => names.has(m));
    exhausted.clear();
    current = 0;
    if (!available.length) throw new GeminiError('nomodel');
    if (ping) {
      await generate({ kind: 'ping', system: 'Reply with the single word OK.', messages: [{ role: 'user', text: 'Say OK.' }], maxOutputTokens: 64, signal, onWait });
    }
    return { model: model(), available: [...available] };
  }

  return {
    mode: 'gemini',
    get model() { return model(); },
    get available() { return [...available]; },
    get paceLimit() { return limitPerMinute; },
    checkKey,
    generate,
  };
}

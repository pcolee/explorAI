/* ExplorAI copy of rcc-gdg/deck-kit/presenter.js (identical to rcc-acm/deck-kit/presenter.js), taken 2026-10-07.
   Do not edit here alone: change the kit copies and recopy. ExplorAI-specific glue lives in explorai-presenter.js. */
/* presenter.js: presenter view (S), phone and tablet remote (M), run sheet, and
   bridge lines, for any deck built on the GDG or ACM deck kit. One copy lives in
   rcc-gdg/deck-kit and one in rcc-acm/deck-kit; change both together.

   It drives the deck from outside, so neither kit's deck.js knows it is here: it
   reads window.__deck.state() and .slides, presses keys the way a keyboard does,
   and jumps with the URL hash. Load it with its own deferred script tag, right
   after the one for deck.js (deck-kit/weekly.html shows the line).

   The same deck file opens as one of four views (?view=):
     presenter  a second laptop window: now, next, notes, bridge line, timers
     remote     the phone or tablet: notes, bridge line, Back and Next
     runsheet   every slide in one printable table
     mirror     a preview frame inside the other views: no keys, no pointer
   The deck window stays the source of truth; every view only sends presses and
   draws what the deck reports. With review.js loaded, every view also names who
   covers the slide and cues the handoff when the next slide changes speaker, and the
   presenter view and remote list the slide's open review notes. */
(function () {
  'use strict';
  var deck = document.querySelector('.deck');
  if (!deck || window.__presenter) return;
  window.__presenter = true;
  var root = document.documentElement;
  var slides = Array.prototype.filter.call(deck.children, function (el) { return el.classList.contains('slide'); });
  var VIEW = (/[?&]view=(mirror|presenter|remote|runsheet)\b/.exec(location.search) || [])[1] || '';
  var DECK_ID = deck.getAttribute('data-deck') || location.pathname;

  // The press relay: the club's own first, ntfy.sh (the public service it copies)
  // second. Both ends listen on both and publish to the first that answers, so a
  // relay that goes down mid-meeting costs one press, not the meeting.
  var RELAYS = ['https://deck-relay-954308885597.us-west1.run.app/', 'https://ntfy.sh/'];

  /* ---------- Small helpers ---------------------------------------------- */
  function one(sel, el) { return (el || document).querySelector(sel); }
  function all(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function make(tag, cls, parent) { var el = document.createElement(tag); if (cls) el.className = cls; if (parent) parent.appendChild(el); return el; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function msg(t, extra) { var m = { gdgDeck: DECK_ID, t: t }; for (var k in extra) m[k] = extra[k]; return m; }
  function base() { return location.href.split('#')[0].split('?')[0]; }
  function rid(n) { var a = new Uint8Array(n), out = ''; crypto.getRandomValues(a); for (var k = 0; k < n; k++) out += 'abcdefghijkmnpqrstuvwxyz23456789'.charAt(a[k] % 32); return out; }
  function fmtClock(ms) { var s = Math.floor(ms / 1000), m = Math.floor(s / 60); s %= 60; var h = Math.floor(m / 60); m %= 60; return (h ? h + ':' + pad(m) : m) + ':' + pad(s); }
  function wall() { return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  var toastEl = null, toastT = 0;
  function say(text) {
    if (!toastEl) toastEl = make('p', 'pv-toast', document.body);
    toastEl.textContent = text; toastEl.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2200);
  }

  /* ---------- The deck, read and driven from outside --------------------- */
  function api() { return window.__deck; }
  function state() { var s = api() && api().state(); return s ? { i: s.i, b: s.b, room: !!s.room } : null; }
  function beatsOf(i) { var d = api(); return d && d.slides[i] ? d.slides[i].beats || 0 : all('[data-beat]', slides[i]).length; }
  function visible(room) {
    var d = api(), v = [];
    if (room && d) d.slides.forEach(function (s, k) { if (s.room) v.push(k); });
    return v.length ? v : slides.map(function (s, k) { return k; });
  }
  function press(k) { document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); }
  function nextOf(i, b, room) {
    if (b < beatsOf(i)) return { i: i, b: b + 1, press: true };
    var V = visible(room), pos = V.indexOf(i);
    if (pos < 0) pos = V.filter(function (k) { return k < i; }).length - 1;
    return pos + 1 < V.length ? { i: V[pos + 1], b: 0, press: false } : null;
  }
  function prevOf(i, b, room) {
    if (b > 0) return { i: i, b: b - 1 };
    var V = visible(room), pos = V.indexOf(i);
    if (pos < 0) pos = V.filter(function (k) { return k < i; }).length;
    return pos - 1 >= 0 ? { i: V[pos - 1], b: beatsOf(V[pos - 1]) } : null;
  }
  function labelOf(s) {
    var l = s.getAttribute('aria-label'); if (l) return l;
    var h = one('h1, h2', s); return h ? h.textContent.replace(/\s+/g, ' ').trim() : 'Slide ' + (slides.indexOf(s) + 1);
  }
  // A beat's main line, without its smaller detail line.
  function beatText(s, k) {
    // ACM's career disk: each press is a station, named by its heading.
    if (s.getAttribute('data-kind') === 'disk') {
      var station = all('.stations > li', s)[k];
      return station ? (one('h3', station) || station).textContent.replace(/\s+/g, ' ').trim() : 'the finale';
    }
    var el = all('[data-beat]', s)[k]; if (!el) return '';
    if (el.matches('.tour__mark')) return 'the next spotlight on the picture';
    var c = el.cloneNode(true); all('.detail', c).forEach(function (d) { d.parentNode.removeChild(d); });
    return c.textContent.replace(/\s+/g, ' ').trim();
  }
  // A slide's notes, split into the script and its bridge line: the one sentence
  // that carries the room into the next slide.
  function notesOf(s) {
    var n = one('.notes', s); if (!n) return { html: '', bridge: '' };
    var c = n.cloneNode(true), br = one('.bridge', c), bridge = br ? br.innerHTML.trim() : '';
    if (br) br.parentNode.removeChild(br);
    return { html: c.innerHTML.trim(), bridge: bridge };
  }
  function clockOf(i) { var d = one('.clock__digits', slides[i]); return d ? d.textContent : ''; }
  function timerOf(i) { var d = api(); return d && d.slides[i] ? d.slides[i].timer || 0 : 0; }
  function kindOf(i) { var d = api(); return (d && d.slides[i] && d.slides[i].kind) || slides[i].getAttribute('data-kind') || ''; }
  // What every view shows for "where am I, what comes next".
  function cue(st) {
    var s = slides[st.i], nb = beatsOf(st.i), nx = nextOf(st.i, st.b, st.room), n = notesOf(s);
    var V = visible(st.room), pos = V.indexOf(st.i);
    var where = 'Slide ' + (pos + 1) + ' of ' + V.length + (nb ? ' · press ' + st.b + ' of ' + nb : '');
    var upNext = !nx ? 'End of the deck' : nx.press ? 'Next press: ' + (beatText(s, st.b) || 'the next step') : 'Next slide: ' + labelOf(slides[nx.i]);
    var who = whoOf(st.i), nextWho = nx && !nx.press ? whoOf(nx.i) : '';
    var hand = nextWho && nextWho !== who ? nextWho : '';
    if (hand) upNext += ' · ' + hand + ' takes over';
    return { next: nx, notes: n, where: where, upNext: upNext, due: st.b >= nb, label: labelOf(s), who: who, hand: hand };
  }
  function bridgeHtml(c) {
    var hand = c.hand ? '<p class="pv-hand">Hand to ' + whoHtml(c.hand) + '</p>' : '';
    if (!c.notes.bridge) return hand || '<p class="pv-muted">No bridge line on this slide.</p>';
    return '<p class="pv-bridge__text">' + c.notes.bridge + '</p>' + hand;
  }
  function whenReady(fn) { if (api()) fn(); else setTimeout(function () { whenReady(fn); }, 50); }
  // Who covers a slide (review.js, or data-owner written at publish time), as a chip.
  function whoOf(i) { var r = window.__review; return r ? r.ownerOf(i) : (slides[i] && slides[i].getAttribute('data-owner')) || ''; }
  function whoHtml(name) { var r = window.__review; return !name ? '' : r ? r.chip(name, 'is-small') : '<span class="pv-who">' + esc(name) + '</span>'; }
  function onReview(fn) { window.addEventListener('deck-review', fn); }
  // Open review notes on a slide (review.js, once signed in). Only the presenter's own views show them.
  function reviewHtml(i) {
    var r = window.__review, t = r && r.threadsOf ? r.threadsOf(i) : [];
    if (!t.length) return '';
    return '<p class="pv-label">Open review notes · ' + t.length + '</p>' + t.slice(0, 6).map(function (v) {
      var who = v.author && v.author.name ? whoHtml(v.author.name + (v.author.via === 'agent' ? '’s agent' : '')) + ' ' : '';
      var quote = v.target && v.target.text ? '<span class="pv-review__quote">“' + esc(v.target.text.slice(0, 80)) + '”</span> ' : '';
      var body = v.body.length > 220 ? v.body.slice(0, 220) + '…' : v.body;
      return '<p class="pv-review__item">' + who + quote + esc(body) + (v.suggestion ? ' <span class="pv-muted">(suggests new text)</span>' : '') + '</p>';
    }).join('') + (t.length > 6 ? '<p class="pv-muted">and ' + (t.length - 6) + ' more on the board</p>' : '');
  }

  /* ---------- The relay --------------------------------------------------- */
  function relayPost(m, fail, k) {
    k = k || 0;
    fetch(RELAYS[k] + relay.topic, { method: 'POST', body: JSON.stringify(m) })
      .then(function (r) { if (!r.ok) throw r.status; })
      .catch(function (code) { if (k + 1 < RELAYS.length) relayPost(m, fail, k + 1); else if (fail) fail(code); });
  }
  function relayListen(onMsg, onLink) {
    var up = RELAYS.map(function () { return false; });
    RELAYS.forEach(function (url, k) {
      var es = new EventSource(url + relay.topic + '/sse');
      es.onmessage = function (e) {
        var d; try { d = JSON.parse(e.data); } catch (x) { return; }
        if (d.event !== 'message') return;
        try { onMsg(JSON.parse(d.message)); } catch (x) { /* not ours */ }
      };
      es.onopen = function () { up[k] = true; onLink(true); };
      es.onerror = function () { up[k] = false; if (!up.some(Boolean)) onLink(false); };   // EventSource retries by itself
    });
  }
  var relay = null;

  /* ---------- The deck window -------------------------------------------- */
  function deckWindow() {
    var listeners = [], qrBox = null, phoneUrl = '', last = null;
    // Report a change to the presenter windows (postMessage) and the phone (relay).
    function report(st, force) {
      var n = remotes();
      var m = msg('state', { i: st.i, b: st.b, room: st.room, clock: clockOf(st.i), remotes: n });
      listeners = listeners.filter(function (w) { if (!w || w.closed) return false; try { w.postMessage(m, '*'); return true; } catch (e) { return false; } });
      // One remote already moved its own screen for its own presses, so it hears
      // only what it could not predict (a clicker, the laptop's keys, the end).
      // With two or more, every change goes to all of them.
      if (n && (force || n > 1 || !(relay.known && relay.known.i === st.i && relay.known.b === st.b && relay.known.room === st.room))) {
        relay.known = st;
        clearTimeout(relay.t);
        relay.t = setTimeout(function () {
          relayPost(msg('state', { from: 'deck', i: relay.known.i, b: relay.known.b, room: relay.known.room, seqs: relay.seqs, remotes: remotes() }), relayFail);
        }, 250);
      }
    }
    function relayFail(code) { say(code === 429 ? 'The phone relay is busy. Wait a few seconds.' : 'The phone relay is unreachable. Is this laptop online?'); }
    var tick = 0;
    setInterval(function () {
      var st = state(); if (!st) return;
      var moved = !last || st.i !== last.i || st.b !== last.b || st.room !== last.room;
      tick++;
      if (moved || (tick % 8 === 0 && listeners.length && clockOf(st.i))) { last = st; report(st); }
    }, 125);
    window.addEventListener('message', function (e) {
      var d = e.data; if (!d || d.gdgDeck !== DECK_ID) return;
      if (d.t === 'hello' && e.source) { if (listeners.indexOf(e.source) < 0) listeners.push(e.source); var st = state(); if (st) report(st); }
      else if (d.t === 'key' && typeof d.k === 'string') press(d.k);
      else if (d.t === 'phone') startPhone(e.source);
    });
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey || !e.isTrusted) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === 's' || e.key === 'S') { e.preventDefault(); openPresenter(); }
      else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); startPhone(null); }
      else if (e.key === 'Escape') hideQr();
    });
    // List S and M in the kit's own key help.
    var help = one('.deck-help tbody');
    if (help) [['S', 'Presenter view (second window)'], ['M', 'Phone or tablet remote']].forEach(function (r) {
      var tr = make('tr', '', help); tr.innerHTML = '<td><kbd>' + r[0] + '</kbd></td><td>' + r[1] + '</td>';
    });
    function openPresenter() {
      var w = window.open(base() + '?view=presenter#' + ((state() || { i: 0 }).i + 1), 'deck-presenter', 'popup,width=1440,height=900');
      if (!w) say('Pop-ups are blocked. Allow them for this page, then press S again.');
    }
    // The phone loads the published deck. A deck opened as a local file names its
    // live link in data-live-url.
    function remoteBase() {
      if (/^https?:$/.test(location.protocol) && !/^(127\.|localhost)/.test(location.hostname)) return base();
      return deck.getAttribute('data-live-url') || '';
    }
    // Remotes seen in the last five minutes. Each says hello on connect and every
    // two minutes after, so a closed tab drops out of the count.
    function remotes() {
      if (!relay) return 0;
      var cut = Date.now() - 300000, n = 0;
      for (var id in relay.seen) { if (relay.seen[id] < cut) delete relay.seen[id]; else n++; }
      return n;
    }
    function tell(src, text) { if (src) src.postMessage(msg('note', { text: text }), '*'); else say(text); }
    function startPhone(src) {
      var b = remoteBase();
      if (!b) { tell(src, 'The remote needs the published deck. Add data-live-url, or open the live link.'); return; }
      if (!window.EventSource || !window.fetch) { tell(src, 'This browser cannot run the remote.'); return; }
      if (!relay) {
        relay = { topic: 'rccdeck-' + rid(24), seen: {}, seqs: {}, known: null, t: 0 };
        relayListen(function (d) {
          if (!d || d.gdgDeck !== DECK_ID || d.from !== 'phone') return;
          var id = typeof d.id === 'string' ? d.id.slice(0, 24) : 'one';
          var fresh = !relay.seen[id];
          relay.seen[id] = Date.now();
          if (d.t === 'hello') {
            if (fresh) { hideQr(); var n = remotes(); say(n > 1 ? n + ' remotes connected' : 'Remote connected'); }
            // A heartbeat only keeps the count; a real hello asks where the deck is.
            if (fresh || !d.beat) { var st = state(); if (st) report(st, true); }
          } else if (d.t === 'key' && typeof d.k === 'string') {
            if (typeof d.seq === 'number') relay.seqs[id] = d.seq;
            if (d.expect && typeof d.expect.i === 'number') relay.known = { i: d.expect.i, b: d.expect.b, room: (state() || {}).room };
            press(d.k);
          }
        }, function (ok) { if (!ok && !remotes()) tell(src, 'Reaching the relay…'); });
        phoneUrl = b + '?view=remote&relay=' + relay.topic;
      }
      if (src) { src.postMessage(msg('qr', { url: phoneUrl }), '*'); return; }
      qrSvg(phoneUrl, function (svg) {
        hideQr();
        qrBox = make('div', 'pv-qr-dialog', document.body); qrBox.setAttribute('data-url', phoneUrl);
        qrBox.setAttribute('role', 'dialog'); qrBox.setAttribute('aria-label', 'Remote');
        qrBox.innerHTML = '<div class="pv-qr">' + svg + '</div><p>Scan with your phone or tablet for notes and a remote.</p><p class="pv-muted">It hides when one connects. Esc closes it.</p>';
      });
    }
    function hideQr() { if (qrBox && qrBox.parentNode) qrBox.parentNode.removeChild(qrBox); qrBox = null; }
  }

  // The QR code library loads only when a code is shown.
  var qrLib = { src: 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js', sri: 'sha512-ZDSPMa/JM1D+7kdg2x3BsruQ6T/JpJo3jWDWkCZsP+5yVyp1KfESqLI+7RqB5k24F7p2cV7i2YHh/890y6P6Sw==', wait: null };
  function qrSvg(url, cb) {
    function draw() { var q = window.qrcode(0, 'M'); q.addData(url); q.make(); cb(q.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: 'QR code for the remote' })); }
    if (window.qrcode) { draw(); return; }
    if (!qrLib.wait) {
      qrLib.wait = [];
      var el = document.createElement('script');
      el.src = qrLib.src; el.integrity = qrLib.sri; el.crossOrigin = 'anonymous'; el.referrerPolicy = 'no-referrer';
      el.onload = function () { var w = qrLib.wait; qrLib.wait = null; w.forEach(function (f) { f(); }); };
      el.onerror = function () { var w = qrLib.wait; qrLib.wait = null; w.forEach(function () { cb(''); }); };
      document.head.appendChild(el);
    }
    qrLib.wait.push(draw);
  }

  /* ---------- A preview frame (?view=mirror) ----------------------------- */
  // Shows the slide and press it is told to, by pressing keys like a person would.
  function mirror() {
    window.addEventListener('keydown', function (e) { if (e.isTrusted) e.stopImmediatePropagation(); }, true);
    var target = null;
    window.addEventListener('message', function (e) {
      var d = e.data; if (!d || d.gdgDeck !== DECK_ID || d.t !== 'show') return;
      target = { i: d.i, b: d.b };
    });
    setInterval(function () {
      all('video').forEach(function (v) { v.muted = true; });
      var st = state(); if (!st || !target) return;
      // One press at a time: a press while a transition runs would land past the target.
      if (api().state().busy) return;
      // The kit jumps on a hash change, then the presses walk to the beat.
      if (st.i !== target.i) { if (location.hash !== '#' + (target.i + 1)) location.hash = '#' + (target.i + 1); return; }
      if (st.b < target.b) press('ArrowRight');
      else if (st.b > target.b) press('ArrowLeft');
    }, 90);
  }
  function frames(box, n) {
    var list = [], ready = [];
    for (var k = 0; k < n; k++) {
      var wrap = make('div', 'pv-frame', box[k]);
      var f = make('iframe', '', wrap); f.setAttribute('tabindex', '-1'); f.setAttribute('aria-hidden', 'true');
      (function (k) { f.addEventListener('load', function () { ready[k] = true; }); })(k);
      f.src = base() + '?view=mirror';
      list.push(f); ready.push(false);
    }
    function fit() { all('.pv-frame').forEach(function (w) { w.style.setProperty('--fit', String(w.clientWidth / 1920)); }); }
    window.addEventListener('resize', fit); setTimeout(fit, 0);
    return function show(k, st) { if (ready[k] && st) list[k].contentWindow.postMessage(msg('show', { i: st.i, b: st.b }), '*'); };
  }

  /* ---------- Tool pages ------------------------------------------------- */
  function toolShell(cls, title) {
    root.classList.add('pv-tool');
    // The deck's own keys stay off on a tool page: a real key press stops here and
    // goes to the tool's own handler (toolKeys) instead.
    window.addEventListener('keydown', function (e) { if (!e.isTrusted) return; e.stopImmediatePropagation(); if (toolKeys) toolKeys(e); }, true);
    document.title = (deck.getAttribute('data-ledger') || document.title) + ' · ' + title;
    return make('div', cls, document.body);
  }
  var toolKeys = null;
  function host() { return window.opener || (window.parent !== window ? window.parent : null); }
  function toHost(m) { var h = host(); if (h) h.postMessage(m, '*'); }

  function presenterView() {
    var pv = toolShell('pv', 'Presenter');
    pv.innerHTML =
      '<header class="pv__bar"><p class="pv__deck"></p><p class="pv__where"></p><p class="pv__clock" hidden></p>' +
      '<button type="button" class="pv__elapsed" title="Time since this opened. Click to reset.">0:00</button><p class="pv__wall"></p>' +
      '<button type="button" class="pv-btn" data-act="phone">Remote</button><a class="pv-btn" target="_blank" rel="noopener">Run sheet</a></header>' +
      '<section class="pv__now"><p class="pv-label">Now</p><div class="pv__slot"></div><div class="pv__notes"></div></section>' +
      '<section class="pv__next"><p class="pv-label pv__upnext">Next</p><div class="pv__slot"></div>' +
      '<div class="pv-bridge"><p class="pv-label">Bridge</p><div class="pv-bridge__body"></div></div><div class="pv-review"></div><div class="pv__qr" hidden></div></section>' +
      '<p class="pv__status" role="status">Waiting for the deck. Open this with S from the deck window.</p>';
    var q = function (sel) { return one(sel, pv); };
    q('.pv__deck').textContent = deck.getAttribute('data-ledger') || document.title;
    q('a.pv-btn').href = base() + '?view=runsheet';
    var show = frames(all('.pv__slot', pv), 2), st = null, t0 = Date.now(), lastRemotes = 0, lastD = null;
    // A speaker change made in review redraws the labels.
    onReview(function () { if (lastD) window.postMessage(lastD, '*'); });
    function hello() { toHost(msg('hello')); }
    hello(); setInterval(hello, 3000);                  // re-register if the deck window reloads
    setInterval(function () {
      q('.pv__elapsed').textContent = fmtClock(Date.now() - t0); q('.pv__wall').textContent = wall();
      if (st) { show(0, st); show(1, nextOf(st.i, st.b, st.room) || st); }
    }, 500);
    q('.pv__elapsed').addEventListener('click', function () { t0 = Date.now(); });
    q('[data-act="phone"]').addEventListener('click', function () { toHost(msg('phone')); });
    window.addEventListener('message', function (e) {
      var d = e.data; if (!d || d.gdgDeck !== DECK_ID) return;
      if (d.t === 'state') {
        st = { i: d.i, b: d.b, room: !!d.room }; lastD = d;
        var c = cue(st);
        q('.pv__status').textContent = d.remotes > 1 ? d.remotes + ' remotes connected' : d.remotes ? 'Remote connected' : '';
        q('.pv__where').innerHTML = esc(c.where + ' · ' + c.label) + (c.who ? ' ' + whoHtml(c.who) : '');
        var clk = q('.pv__clock'); clk.hidden = !d.clock; clk.textContent = d.clock ? 'Clock ' + d.clock : '';
        q('.pv__upnext').textContent = c.upNext;
        q('.pv__notes').innerHTML = c.notes.html || '<p class="pv-muted">No notes on this slide.</p>';
        q('.pv-review').innerHTML = reviewHtml(st.i);
        q('.pv-bridge__body').innerHTML = bridgeHtml(c);
        q('.pv-bridge').classList.toggle('is-due', c.due && !!c.notes.bridge);
        if (d.remotes && d.remotes !== lastRemotes) q('.pv__qr').hidden = true;
        lastRemotes = d.remotes || 0;
        show(0, st); show(1, c.next || st);
      } else if (d.t === 'qr') {
        var box = q('.pv__qr'); box.hidden = false; box.innerHTML = '<p class="pv-label">Scan with your phone or tablet</p>';
        qrSvg(d.url, function (svg) { box.innerHTML = '<p class="pv-label">Scan with your phone or tablet</p><div class="pv-qr" data-url="' + esc(d.url) + '">' + svg + '</div><p class="pv-muted">Hides when it connects.</p>'; });
      } else if (d.t === 'note') q('.pv__status').textContent = d.text;
    });
    // A clicker or the arrow keys work with this window focused too.
    toolKeys = function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var k = e.key;
      if (/^(ArrowRight|ArrowLeft|PageDown|PageUp|Home|End| |Enter|Backspace|t|T|r|R|5)$/.test(k)) {
        if (k === ' ' || k === 'Enter') { var t = e.target; if (t && t.closest && t.closest('a[href], button')) return; }
        e.preventDefault(); toHost(msg('key', { k: k }));
      } else if (k === 'm' || k === 'M') toHost(msg('phone'));
      else if (k === 'Escape') q('.pv__qr').hidden = true;
    };
  }

  // The phone or tablet. On a tablet-wide screen it also shows the two previews.
  function remoteView() {
    var rv = toolShell('rv', 'Remote');
    var wide = Math.min(screen.width, screen.height) >= 700 || window.innerWidth >= 900;
    rv.classList.toggle('is-wide', wide);
    rv.innerHTML =
      '<p class="rv__status" role="status">Connecting to the deck…</p>' +
      '<div class="rv__main"><header class="rv__bar"><p class="rv__where"></p><p class="rv__count"></p><p class="rv__clock"></p></header>' +
      '<h1 class="rv__title"></h1>' +
      '<div class="pv-bridge"><p class="pv-label">Bridge</p><div class="pv-bridge__body"></div></div>' +
      '<p class="rv__next"></p><div class="rv__notes"></div><div class="pv-review"></div></div>' +
      (wide ? '<div class="rv__previews"><p class="pv-label">Now</p><div class="pv__slot"></div><p class="pv-label rv__upnext">Next</p><div class="pv__slot"></div></div>' : '') +
      '<nav class="rv__pad"><button type="button" data-k="ArrowLeft">Back</button><button type="button" data-k="ArrowRight">Next</button></nav>';
    var q = function (sel) { return one(sel, rv); };
    var show = wide ? frames(all('.pv__slot', rv), 2) : function () {};
    var topic = (/[?&]relay=([\w-]+)/.exec(location.search) || [])[1], cur = null, lock = null, seq = 0, me = rid(12), tapAt = 0;
    function status(t) { q('.rv__status').textContent = t; rv.classList.toggle('is-live', !t); }
    function draw(st) {
      var c = cue(st);
      q('.rv__where').textContent = c.where; q('.rv__clock').textContent = st.clock || '';
      q('.rv__title').innerHTML = esc(c.label) + (c.who ? ' ' + whoHtml(c.who) : '');
      q('.rv__next').textContent = c.upNext;
      if (wide) q('.rv__upnext').textContent = c.upNext;
      q('.pv-bridge__body').innerHTML = bridgeHtml(c);
      q('.pv-bridge').classList.toggle('is-due', c.due && !!c.notes.bridge);
      q('.rv__notes').innerHTML = c.notes.html || '<p class="pv-muted">No notes on this slide.</p>';
      q('.pv-review').innerHTML = reviewHtml(st.i);
      show(0, st); show(1, c.next || st);
    }
    if (wide) setInterval(function () { if (cur) { show(0, cur); show(1, nextOf(cur.i, cur.b, cur.room) || cur); } }, 600);
    onReview(function () { if (cur) draw(cur); });
    function fail(code) { status(code === 429 ? 'Too many taps for the relay. Wait a few seconds.' : 'Can’t reach the relay. Check this device’s connection.'); }
    if (!topic) { status('This link is missing its code. Scan the QR code on the deck again.'); return; }
    relay = { topic: topic };
    relayListen(function (d) {
      if (!d || d.gdgDeck !== DECK_ID || d.from !== 'deck' || d.t !== 'state') return;
      // A reply sent before the deck saw this device's latest tap is already out of
      // date for this device (other remotes' taps don't count against it).
      var mine = d.seqs && typeof d.seqs[me] === 'number' ? d.seqs[me] : 0;
      // A tap whose message was lost never gets acknowledged, so the wait ends after 2.5 s.
      if (mine < seq && Date.now() - tapAt < 2500) return;
      q('.rv__count').textContent = d.remotes > 1 ? d.remotes + ' remotes' : '';
      cur = { i: d.i, b: d.b, room: !!d.room }; status(''); draw(cur);
    }, function (ok) {
      // Say hello on every (re)connect; the deck answers with where it is.
      if (ok) { relayPost(msg('hello', { from: 'phone', id: me }), fail); if (!cur) status('Waiting for the deck…'); }
      else status('Reconnecting…');
    });
    setInterval(function () { relayPost(msg('hello', { from: 'phone', id: me, beat: true })); }, 120000);
    function sendKey(k) {
      if (!cur) return;
      var exp = k === 'ArrowRight' ? nextOf(cur.i, cur.b, cur.room) : prevOf(cur.i, cur.b, cur.room);
      seq += 1; tapAt = Date.now();
      relayPost(msg('key', { from: 'phone', id: me, k: k, seq: seq, expect: exp ? { i: exp.i, b: exp.b } : null }), fail);
      if (exp) { cur = { i: exp.i, b: exp.b, room: cur.room }; draw(cur); }
    }
    all('[data-k]', rv).forEach(function (btn) {
      btn.addEventListener('click', function () {
        // Keep the screen awake while presenting, where the browser allows it.
        if (!lock && navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { lock = l; l.addEventListener('release', function () { lock = null; }); }).catch(function () {});
        sendKey(btn.getAttribute('data-k'));
      });
    });
    // A keyboard on the tablet (or a clicker paired to it) works too.
    toolKeys = function (e) {
      if (/^(ArrowRight|PageDown| )$/.test(e.key)) { e.preventDefault(); sendKey('ArrowRight'); }
      else if (/^(ArrowLeft|PageUp)$/.test(e.key)) { e.preventDefault(); sendKey('ArrowLeft'); }
    };
  }

  function runSheet() {
    var rs = toolShell('rs', 'Run sheet');
    function draw() {
      var total = 0, rows = '', count = {};
      slides.forEach(function (s, i) {
        var n = notesOf(s), sec = timerOf(i), nb = beatsOf(i); total += sec;
        var nx = slides[i + 1], who = whoOf(i), nextWho = nx ? whoOf(i + 1) : '';
        if (who) count[who] = (count[who] || 0) + 1;
        rows += '<tr><td class="rs__n">' + (i + 1) + (s.hasAttribute('data-room') ? '<span class="rs__room" title="In room mode">R</span>' : '') + '</td>' +
          '<td><p class="rs__slide">' + esc(labelOf(s)) + '</p><p class="rs__meta">' + esc(kindOf(i)) + (nb ? ' · ' + nb + (nb === 1 ? ' press' : ' presses') : '') + (sec ? ' · clock ' + fmtClock(sec * 1000) : '') + '</p>' + (who ? '<p class="rs__who">' + whoHtml(who) + '</p>' : '') + '</td>' +
          '<td>' + (n.bridge ? '<p class="rs__bridge">' + n.bridge + '</p>' : '<p class="pv-muted">No bridge</p>') + (nx ? '<p class="rs__into">Into: ' + esc(labelOf(nx)) + '</p>' : '') +
          (nextWho && nextWho !== who ? '<p class="pv-hand">Hand to ' + whoHtml(nextWho) + '</p>' : '') + '</td>' +
          '<td class="rs__notes">' + n.html + '</td></tr>';
      });
      var people = Object.keys(count).map(function (k) { return whoHtml(k) + ' ' + count[k]; }).join(' ');
      rs.innerHTML = '<header class="rs__head"><h1>' + esc(deck.getAttribute('data-ledger') || document.title) + '</h1>' +
        '<p>' + slides.length + ' slides · ' + fmtClock(total * 1000) + ' on the clocks · R = in room mode</p>' + (people ? '<p class="rs__people">' + people + '</p>' : '') +
        '<button type="button" class="pv-btn" data-act="print">Print</button></header>' +
        '<table class="rs__table"><thead><tr><th>#</th><th>Slide</th><th>Bridge</th><th>Notes</th></tr></thead><tbody>' + rows + '</tbody></table>';
      one('[data-act="print"]', rs).addEventListener('click', function () { window.print(); });
    }
    draw(); onReview(draw);
  }

  /* ---------- Styles ----------------------------------------------------- */
  // Built from whichever kit's tokens are present (GDG --rcc-*, ACM --acm-*).
  var css = [
    ':root{--pv-surface:var(--rcc-surface,var(--acm-surface,#fff));--pv-on:var(--rcc-on-surface,var(--acm-on-surface,#1f1f1f));--pv-muted:var(--rcc-on-surface-variant,var(--acm-on-surface-variant,#5f6368));',
    '--pv-line:var(--rcc-outline-variant,var(--acm-outline-variant,#dadce0));--pv-line-strong:var(--rcc-outline,var(--acm-outline,#80868b));--pv-box:var(--rcc-surface-container,var(--acm-surface-container,#f1f3f4));',
    '--pv-box-high:var(--rcc-surface-container-high,var(--acm-surface-container-high,#e8eaed));--pv-primary:var(--rcc-primary,var(--acm-primary,#1a73e8));--pv-on-primary:var(--rcc-on-primary,var(--acm-on-primary,#fff));',
    '--pv-hl:var(--rcc-highlight,var(--acm-highlight,#f9ab00));--pv-hl-box:var(--rcc-highlight-container,var(--acm-highlight-container,#feefc3));--pv-on-hl-box:var(--rcc-on-highlight-container,var(--acm-on-highlight-container,#3c2a00));',
    '--pv-font:var(--rcc-font-brand,var(--acm-font-brand,system-ui,sans-serif));--pv-code:var(--rcc-font-code,var(--acm-font-code,ui-monospace,monospace));--pv-ring:var(--rcc-focus-ring,var(--acm-focus-ring,#1a73e8))}',
    '.pv-tool .deck,.pv-tool .deck-notes,.pv-tool .deck-help,.pv-tool .deck-toast,.pv-tool .chrome{display:none!important}',
    '.pv-tool body{margin:0;background:var(--pv-surface);color:var(--pv-on);font-family:var(--pv-font)}',
    '.pv-label{margin:0 0 8px;font:500 13px var(--pv-code);letter-spacing:.08em;text-transform:uppercase;color:var(--pv-muted)}',
    '.pv-muted{margin:0;color:var(--pv-muted)}',
    '.pv-btn{font:500 15px var(--pv-font);color:var(--pv-primary);background:none;border:1px solid var(--pv-line-strong);border-radius:999px;padding:6px 14px;text-decoration:none;cursor:pointer}',
    '.pv-btn:hover{background:var(--pv-box-high)}.pv-btn:focus-visible,.pv__elapsed:focus-visible,.rv__pad button:focus-visible{outline:3px solid var(--pv-ring);outline-offset:2px}',
    '.pv-frame{position:relative;aspect-ratio:16/9;overflow:hidden;border-radius:12px;box-shadow:0 0 0 1px var(--pv-line);background:var(--pv-box)}',
    '.pv-frame iframe{position:absolute;top:0;left:0;width:1920px;height:1080px;border:0;transform:scale(var(--fit,.3));transform-origin:0 0;pointer-events:none}',
    '.pv-bridge{margin-top:14px;padding:14px 16px;border-radius:12px;background:var(--pv-box);transition:background-color .2s,box-shadow .2s}',
    '.pv-bridge__text{margin:0;font-size:22px;line-height:1.4}',
    '.pv-bridge.is-due{background:var(--pv-hl-box);color:var(--pv-on-hl-box);box-shadow:0 0 0 2px var(--pv-hl)}.pv-bridge.is-due .pv-label{color:inherit}.pv-bridge.is-due .pv-bridge__text{font-size:28px;font-weight:500}',
    '.pv{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);grid-template-rows:auto minmax(0,1fr);gap:16px 20px;height:100vh;padding:16px 20px;box-sizing:border-box}',
    '.pv__bar{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px}.pv__bar p{margin:0}',
    '.pv__deck{font:13px var(--pv-code);letter-spacing:.06em;text-transform:uppercase;color:var(--pv-muted)}.pv__where{font-size:18px;font-weight:500;flex:1 1 auto}',
    '.pv__clock{font:18px var(--pv-code);color:var(--pv-primary)}.pv__elapsed,.pv__wall{font:22px var(--pv-code);font-variant-numeric:tabular-nums}',
    '.pv__elapsed{border:0;background:none;color:inherit;padding:4px 6px;border-radius:6px;cursor:pointer}.pv__elapsed:hover{background:var(--pv-box-high)}',
    '.pv__now,.pv__next{display:flex;flex-direction:column;min-height:0}.pv__slot{flex:none}',
    '.pv__notes{margin-top:14px;overflow:auto;font-size:20px;line-height:1.5;padding-right:8px}.pv__notes p{margin:0 0 12px;max-width:70ch}',
    '.pv__upnext,.rv__upnext{text-transform:none;letter-spacing:0;font:500 17px var(--pv-font);color:var(--pv-on)}',
    '.pv__qr{margin-top:14px;padding:14px;border-radius:12px;box-shadow:0 0 0 1px var(--pv-line)}.pv__qr[hidden]{display:none}.pv-qr svg{width:220px;height:220px;display:block}',
    '.pv__status{position:fixed;left:20px;bottom:12px;margin:0;font-size:14px;color:var(--pv-muted)}.pv__status:empty{display:none}',
    '.rv{padding:16px 16px calc(120px + env(safe-area-inset-bottom));max-width:640px;margin:0 auto;box-sizing:border-box}',
    '.rv.is-wide{max-width:none;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:20px;padding:20px 24px calc(124px + env(safe-area-inset-bottom))}',
    '.rv.is-wide .rv__status{grid-column:1/-1}.rv__previews .pv__slot{margin-bottom:16px}',
    '.rv__status{margin:0 0 12px;padding:10px 12px;border-radius:8px;background:var(--pv-box-high);font-size:16px}.rv__status:empty{display:none}',
    '.rv__count{color:var(--pv-primary)}.rv__count:empty{display:none}.rv__bar{display:flex;justify-content:space-between;gap:12px;font:14px var(--pv-code);color:var(--pv-muted)}.rv__bar p{margin:0}.rv__clock{color:var(--pv-primary);font-size:18px}',
    '.rv__title{font-size:24px;line-height:1.25;font-weight:500;margin:8px 0 0}.rv .pv-bridge__text{font-size:20px}.rv .pv-bridge.is-due .pv-bridge__text{font-size:22px}',
    '.rv__next{margin:14px 0 0;font-size:17px;font-weight:500}.rv__notes{margin-top:12px;font-size:18px;line-height:1.5}.rv__notes p{margin:0 0 12px}',
    '.rv__pad{position:fixed;inset-inline:0;bottom:0;display:grid;grid-template-columns:1fr 2fr;gap:10px;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:var(--pv-surface);box-shadow:0 -1px 0 var(--pv-line)}',
    '.rv.is-wide .rv__pad{padding-inline:24px}',
    '.rv__pad button{min-height:88px;border-radius:16px;font:500 22px var(--pv-font);border:0;touch-action:manipulation;cursor:pointer}',
    '.rv__pad [data-k="ArrowLeft"]{background:var(--pv-box-high);color:var(--pv-on)}.rv__pad [data-k="ArrowRight"]{background:var(--pv-primary);color:var(--pv-on-primary)}.rv__pad button:active{transform:scale(.98)}',
    '.rs{padding:24px 32px;page:runsheet}.rs__head{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 20px;margin-bottom:16px}.rs__head h1{font-size:24px;font-weight:500;margin:0}.rs__head p{margin:0;color:var(--pv-muted)}',
    '.rs__table{border-collapse:collapse;width:100%;font-size:14px;line-height:1.45}',
    '.rs__table th{text-align:left;font:500 12px var(--pv-code);letter-spacing:.06em;text-transform:uppercase;color:var(--pv-muted);padding:6px 10px;border-bottom:2px solid var(--pv-line-strong)}',
    '.rs__table td{vertical-align:top;padding:10px;border-bottom:1px solid var(--pv-line)}.rs__table td:nth-child(2){width:22%}.rs__table td:nth-child(3){width:30%}',
    '.rs__n{font-family:var(--pv-code);white-space:nowrap}.rs__room{margin-left:4px;padding:0 4px;border-radius:4px;background:var(--pv-box-high);font-size:11px}',
    '.rs__slide{margin:0;font-weight:500}.rs__meta,.rs__into{margin:2px 0 0;color:var(--pv-muted);font-size:12px}.rs__bridge{margin:0;font-weight:500}.rs__notes p{margin:0 0 6px}.rs tr{break-inside:avoid}',
    '@page runsheet{size:letter;margin:.5in}@media print{.pv-tool .rs__head button{display:none}.pv-tool html,.pv-tool body{background:#fff}}',
    '.pv-qr-dialog{position:fixed;z-index:20;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--pv-surface);color:var(--pv-on);border-radius:16px;padding:24px 28px;box-shadow:0 0 0 1px var(--pv-line),0 4px 8px 3px rgb(30 32 30/.15);text-align:center;font:18px var(--pv-font)}',
    '.pv-qr-dialog .pv-qr svg{width:260px;height:260px;margin:0 auto 12px}.pv-qr-dialog p{margin:0 0 4px}.pv-qr-dialog .pv-muted{font-size:14px}',
    '.pv-toast{position:fixed;z-index:21;left:50%;top:24px;transform:translate(-50%,-8px);margin:0;background:var(--pv-on);color:var(--pv-surface);padding:10px 18px;border-radius:8px;font:500 15px var(--pv-font);opacity:0;pointer-events:none;transition:opacity .2s,transform .2s}',
    '.pv-toast.is-on{opacity:1;transform:translate(-50%,0)}',
    '.pv-mirror .deck{pointer-events:none;cursor:none}.pv-mirror .deck-toast,.pv-mirror .deck-notes,.pv-mirror .deck-help,.pv-mirror .pv-toast{display:none!important}',
    '.pv-hand{margin:8px 0 0;font:500 15px var(--pv-font);display:flex;align-items:center;gap:8px}.pv-who{font-weight:500}.rs__who{margin:6px 0 0}.rs__people{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
    '.pv__where .rvw-who,.rv__title .rvw-who{vertical-align:middle;margin-left:6px}',
    '.pv-review:not(:empty){margin-top:14px;padding:12px 16px;border-radius:12px;background:var(--pv-box)}.pv-review__item{margin:8px 0 0;font-size:17px;line-height:1.45}.pv-review__item .rvw-who{vertical-align:middle;margin-right:4px}.pv-review__quote{font-style:italic}.pv__next .pv-review{overflow:auto;min-height:0}',
    '.deck-notes .bridge{font-weight:500;border-left:4px solid var(--pv-hl);padding-left:12px}.deck-notes .bridge::before{content:"Bridge: ";font:13px var(--pv-code);letter-spacing:.06em;text-transform:uppercase;opacity:.8}',
    '@media print{.pv-qr-dialog,.pv-toast{display:none!important}}'
  ].join('\n');
  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  /* ---------- Start ------------------------------------------------------ */
  if (VIEW === 'mirror') { root.classList.add('pv-mirror'); whenReady(mirror); }
  else if (VIEW === 'presenter') whenReady(presenterView);
  else if (VIEW === 'remote') whenReady(remoteView);
  else if (VIEW === 'runsheet') whenReady(runSheet);
  else whenReady(deckWindow);
})();

/* review.js: live review for a deck. Comments on each slide, and who covers which slide,
   shared in real time by everyone working on the deck and by their Claude Code agents
   (scripts/review.sh). Works on any deck built on the GDG or ACM deck kit, and on the
   ExplorAI decks through explorai-presenter.js. One copy lives in rcc-gdg/deck-kit, one in
   rcc-acm/deck-kit, and one in pcolee/explorAI meetings/shared; change all three together.

   Load it with its own deferred script tag right after presenter.js.
     C              in the deck window opens the review panel for the current slide
     ?view=review   the whole deck as a board: who covers each slide, open comments
   presenter.js reads window.__review to show the speaker in the presenter view, the
   remote, and the run sheet, and to cue the handoff when the next slide changes hands.

   The data lives on the club relay (deck-relay, /review/<club>/<deck>), behind the club
   passcode. Each person types it once per browser, with their name. The repos are public,
   so neither ever goes in a deck file. Slides are keyed by a stable id, not their number:
   data-id, else the section's id, else its aria-label or heading as a slug (scripts/review.mjs
   computes the same ids). Without the relay or the passcode, data-owner attributes on the
   slides (written at publish time) still name the speakers. */
(function () {
  'use strict';
  var deck = document.querySelector('.deck');
  if (!deck || window.__review) return;
  var root = document.documentElement;
  var RELAY = 'https://deck-relay-954308885597.us-west1.run.app/review/';
  var VIEW = (/[?&]view=(\w+)/.exec(location.search) || [])[1] || '';
  var slides = Array.prototype.filter.call(deck.children, function (el) { return el.classList.contains('slide') || el.tagName === 'SECTION'; });
  var DECK = (deck.getAttribute('data-deck') || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  var CLUB = deck.getAttribute('data-club') || (/^(acm|explorai)-/.exec(DECK) || [])[1] || 'gdg';
  var URL_ = RELAY + CLUB + '/' + DECK;

  /* ---------- Helpers ----------------------------------------------------- */
  function one(sel, el) { return (el || document).querySelector(sel); }
  function all(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function make(tag, cls, parent) { var el = document.createElement(tag); if (cls) el.className = cls; if (parent) parent.appendChild(el); return el; }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function para(t) { return esc(t).replace(/\n/g, '<br>'); }
  function get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function put(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* private window */ } }
  function ago(iso) {
    var s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    var d = new Date(iso); return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  // A person's color: a hue from their name, so it is the same on every screen.
  function hue(name) { var h = 0; for (var k = 0; k < name.length; k++) h = (h * 31 + name.charCodeAt(k)) % 360; return h; }
  function chip(name, cls) {
    if (!name) return '<span class="rvw-who is-none' + (cls ? ' ' + cls : '') + '">No one yet</span>';
    return '<span class="rvw-who' + (cls ? ' ' + cls : '') + '" style="--h:' + hue(name) + '"><b>' + esc(name.charAt(0).toUpperCase()) + '</b>' + esc(name) + '</span>';
  }

  /* ---------- Slides and their ids --------------------------------------- */
  function slug(t) {
    return String(t).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
  }
  function labelOf(s, i) {
    var l = s.getAttribute('aria-label'); if (l) return l;
    var h = one('h1, h2', s); return h ? h.textContent.replace(/\s+/g, ' ').trim() : 'Slide ' + (i + 1);
  }
  var IDS = [], seen = {};
  slides.forEach(function (s, i) {
    var id = s.getAttribute('data-id') || s.id || slug(s.getAttribute('aria-label') || ((one('h1, h2', s) || {}).textContent || '')) || 'slide-' + (i + 1);
    id = slug(id) || 'slide-' + (i + 1);
    var base = id, n = 2; while (seen[id]) id = base + '-' + n++;
    seen[id] = true; IDS.push(id);
  });
  function indexOf(id) { return IDS.indexOf(id); }

  /* ---------- State, and the connection to the relay ---------------------- */
  var R = { doc: null, status: 'off', why: '', es: null, fns: [] };
  function key() { return get('rcc-review-key'); }
  function me() { return get('rcc-review-name'); }
  function emit() {
    R.fns.forEach(function (f) { try { f(); } catch (e) { /* a view's draw */ } });
    try { window.dispatchEvent(new CustomEvent('deck-review')); } catch (e) { /* old browser */ }
  }
  function setStatus(s, why) { R.status = s; R.why = why || ''; emit(); }
  function connect() {
    if (R.es) { R.es.close(); R.es = null; }
    if (!DECK || !window.fetch || !window.EventSource) { setStatus('off', 'This deck has no data-deck id, so it cannot be reviewed.'); return; }
    if (!key() || !me()) { setStatus('locked'); return; }
    setStatus('connecting');
    // A plain read first: EventSource cannot tell a wrong passcode from a dropped line.
    fetch(URL_, { headers: { 'X-Review-Key': key() } }).then(function (r) {
      if (r.status === 401) { put('rcc-review-key', ''); setStatus('locked', 'That passcode did not work.'); return; }
      if (!r.ok) throw r.status;
      return r.json().then(function (doc) {
        R.doc = doc; setStatus('live');
        // Everyone who joins a deck can be given slides.
        if (doc.roster.indexOf(me()) < 0) send({ op: 'roster', name: me() }).catch(function () {});
        R.es = new EventSource(URL_ + '/sse?key=' + encodeURIComponent(key()));
        R.es.onmessage = function (e) { var d; try { d = JSON.parse(e.data); } catch (x) { return; } if (d.type === 'doc') { R.doc = d.doc; if (R.status !== 'live') R.status = 'live'; emit(); } };
        R.es.onerror = function () { if (R.status === 'live') setStatus('connecting'); };   // EventSource retries by itself
        R.es.onopen = function () { if (R.status !== 'live') setStatus('live'); };
      });
    }).catch(function () { setStatus('error', 'Can’t reach the review relay. Check this laptop’s connection.'); setTimeout(connect, 8000); });
  }
  function send(body) {
    if (R.status !== 'live') return Promise.reject(new Error('not connected'));
    body.author = me(); body.via = 'person';
    return fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Review-Key': key() }, body: JSON.stringify(body) })
      .then(function (r) {
        if (r.status === 401) { put('rcc-review-key', ''); connect(); throw new Error('The passcode changed. Type the new one.'); }
        return r.ok ? r.json() : r.text().then(function (t) { throw new Error(t || 'Could not save that.'); });
      })
      .then(function (doc) { if (!R.doc || doc.rev >= R.doc.rev) { R.doc = doc; emit(); } return doc; });
  }

  // Who covers slide i: the live list, else what the deck was published with.
  function ownerOf(i) {
    if (i < 0 || i >= slides.length) return '';
    if (R.doc) { var o = R.doc.owners[IDS[i]]; return o ? o.name : ''; }
    return slides[i].getAttribute('data-owner') || '';
  }
  function commentsOf(i) { return R.doc ? R.doc.comments.filter(function (c) { return c.slide === IDS[i]; }) : []; }
  function openCount(i) { return commentsOf(i).filter(function (c) { return !c.resolved; }).length; }
  // Comments whose slide id no longer exists (the slide was renamed or cut).
  function orphans() { return R.doc ? R.doc.comments.filter(function (c) { return indexOf(c.slide) < 0; }) : []; }
  function roster() {
    var names = R.doc ? R.doc.roster.slice() : [];
    slides.forEach(function (s, i) { var o = ownerOf(i); if (o && names.indexOf(o) < 0) names.push(o); });
    if (me() && names.indexOf(me()) < 0) names.push(me());
    return names;
  }
  window.__review = {
    ownerOf: ownerOf, idOf: function (i) { return IDS[i]; }, openCount: openCount,
    on: function (f) { R.fns.push(f); }, live: function () { return R.status === 'live'; }, chip: chip
  };

  /* ---------- Sign in ----------------------------------------------------- */
  function signInHtml() {
    var names = roster().filter(function (n) { return n !== me(); });
    return '<form class="rvw-signin"><p class="rvw-lede">Comments and speaker labels are shared live with everyone on this deck.</p>' +
      (R.why ? '<p class="rvw-err" role="alert">' + esc(R.why) + '</p>' : '') +
      '<label class="rvw-field"><span>Your name</span><input name="who" autocomplete="nickname" maxlength="32" required value="' + esc(me()) + '"' + (names.length ? ' list="rvw-names"' : '') + '></label>' +
      (names.length ? '<datalist id="rvw-names">' + names.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>' : '') +
      '<label class="rvw-field"><span>Club passcode</span><input name="pass" type="password" autocomplete="current-password" required></label>' +
      '<button class="rvw-btn is-primary" type="submit">Join</button></form>';
  }
  function wireSignIn(box) {
    var f = one('.rvw-signin', box); if (!f) return;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      put('rcc-review-name', f.elements.who.value.trim().slice(0, 32)); put('rcc-review-key', f.elements.pass.value);
      connect();
    });
  }

  /* ---------- A thread ---------------------------------------------------- */
  function threadHtml(c, opts) {
    var mine = c.author === me();
    var head = function (who, via, at) { return '<p class="rvw-meta">' + chip(who, 'is-small') + (via === 'agent' ? '<span class="rvw-agent" title="Written by ' + esc(who) + '’s Claude Code agent">agent</span>' : '') + '<time datetime="' + esc(at) + '">' + esc(ago(at)) + '</time></p>'; };
    return '<article class="rvw-c' + (c.resolved ? ' is-resolved' : '') + '" data-id="' + esc(c.id) + '">' +
      (opts && opts.slide ? '<p class="rvw-on">Slide ' + (indexOf(c.slide) + 1 || '?') + ' · ' + esc(c.label || c.slide) + '</p>' : '') +
      head(c.author, c.via, c.at) + '<p class="rvw-text">' + para(c.text) + '</p>' +
      c.replies.map(function (r) { return '<div class="rvw-r">' + head(r.author, r.via, r.at) + '<p class="rvw-text">' + para(r.text) + '</p></div>'; }).join('') +
      (c.resolved ? '<p class="rvw-done">Resolved by ' + esc(c.resolved.by) + (c.resolved.via === 'agent' ? ' (agent)' : '') + ', ' + esc(ago(c.resolved.at)) + (c.resolved.note ? ': ' + para(c.resolved.note) : '') + '</p>' : '') +
      '<div class="rvw-acts">' +
      (c.resolved ? '<button type="button" class="rvw-link" data-act="reopen">Reopen</button>'
        : '<button type="button" class="rvw-link" data-act="reply">Reply</button><button type="button" class="rvw-link" data-act="resolve">Resolve</button>') +
      (mine ? '<button type="button" class="rvw-link is-quiet" data-act="delete">Delete</button>' : '') + '</div></article>';
  }
  // Reply, resolve, reopen, delete: one delegated handler per container.
  function wireThreads(box, after) {
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b || !box.contains(b)) return;
      var art = b.closest('.rvw-c'); if (!art) return;
      var id = art.getAttribute('data-id'), act = b.getAttribute('data-act');
      if (act === 'reply') {
        if (one('.rvw-replybox', art)) { one('.rvw-replybox textarea', art).focus(); return; }
        var f = make('form', 'rvw-replybox', art);
        f.innerHTML = '<textarea rows="2" maxlength="2000" placeholder="Reply" aria-label="Reply"></textarea><div class="rvw-row"><button class="rvw-btn is-primary" type="submit">Reply</button><button class="rvw-btn" type="button" data-cancel>Cancel</button></div>';
        var ta = one('textarea', f); ta.focus();
        submitOnKey(ta, f);
        one('[data-cancel]', f).addEventListener('click', function () { f.remove(); });
        f.addEventListener('submit', function (ev) {
          ev.preventDefault(); var t = ta.value.trim(); if (!t) return;
          busy(f, send({ op: 'reply', id: id, text: t }).then(function () { f.remove(); }));
        });
        return;
      }
      if (act === 'delete' && !window.confirm('Delete this comment for everyone?')) return;
      busy(art, send({ op: act, id: id }));
      if (after) after();
    });
  }
  function submitOnKey(ta, form) {
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); }
      if (e.key === 'Escape') { e.stopPropagation(); ta.blur(); }
    });
  }
  function busy(el, p) {
    el.classList.add('is-busy');
    p.catch(function (err) { toast(err.message || 'Could not save that.'); }).then(function () { el.classList.remove('is-busy'); });
  }
  var toastEl = null, toastT = 0;
  function toast(t) {
    if (!toastEl) { toastEl = make('p', 'rvw-toast', document.body); toastEl.setAttribute('role', 'status'); }
    toastEl.textContent = t; toastEl.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2600);
  }

  /* ---------- Owner picker ------------------------------------------------ */
  function ownerPickerHtml(i) {
    var cur = ownerOf(i);
    return '<div class="rvw-pick" role="group" aria-label="Who covers this slide">' + roster().map(function (n) {
      return '<button type="button" class="rvw-pick__b" style="--h:' + hue(n) + '" aria-pressed="' + (n === cur) + '" data-owner="' + esc(n) + '" aria-label="' + esc(n) + (n === cur ? ' covers this slide' : '') + '">' + chip(n) + '</button>';
    }).join('') + '<button type="button" class="rvw-pick__add" data-add>+ Name</button></div>';
  }
  function wirePicker(box, slideFor) {
    box.addEventListener('click', function (e) {
      var b = e.target.closest('.rvw-pick__b, .rvw-pick__add'); if (!b || !box.contains(b)) return;
      var i = slideFor(b); if (i < 0) return;
      if (b.hasAttribute('data-add')) {
        var n = (window.prompt('Add a name to this deck’s roster, and give them this slide:') || '').trim().slice(0, 32);
        if (n) busy(b, send({ op: 'assign', slide: IDS[i], label: labelOf(slides[i], i), n: i + 1, owner: n }));
        return;
      }
      var name = b.getAttribute('data-owner');
      busy(b, send({ op: 'assign', slide: IDS[i], label: labelOf(slides[i], i), n: i + 1, owner: ownerOf(i) === name ? '' : name }));
    });
  }

  /* ---------- The panel in the deck window (C) ---------------------------- */
  function panel() {
    var box = null, open = false, drafts = {}, last = -1;
    function cur() { var d = window.__deck; var s = d && d.state ? d.state() : null; return s ? s.i : 0; }
    function draw() {
      if (!open || !box) return;
      var i = cur(), focusIn = box.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA' && document.activeElement.closest('.rvw-new');
      var ta = one('.rvw-new textarea', box); if (ta) drafts[last] = ta.value;
      last = i;
      var head = '<header class="rvw-head"><div><p class="rvw-kicker">Review · slide ' + (i + 1) + ' of ' + slides.length + '</p><h2 class="rvw-title">' + esc(labelOf(slides[i], i)) + '</h2></div>' +
        '<span class="rvw-dot is-' + R.status + '" title="' + esc({ live: 'Live', connecting: 'Reconnecting', error: 'Offline', locked: 'Not signed in', off: 'Off' }[R.status]) + '"></span>' +
        '<button type="button" class="rvw-x" aria-label="Close review (C)">×</button></header>';
      if (R.status === 'locked' || R.status === 'off' || (R.status === 'error' && !R.doc)) {
        box.innerHTML = head + '<div class="rvw-body">' + (R.status === 'off' ? '<p class="rvw-err">' + esc(R.why) + '</p>' : R.status === 'error' ? '<p class="rvw-err">' + esc(R.why) + '</p>' : signInHtml()) + '</div>';
        wireSignIn(box); wireHead(); return;
      }
      if (!R.doc) { box.innerHTML = head + '<div class="rvw-body"><p class="rvw-muted">Connecting…</p></div>'; wireHead(); return; }
      var list = commentsOf(i), openC = list.filter(function (c) { return !c.resolved; }), done = list.filter(function (c) { return c.resolved; });
      var totalOpen = R.doc.comments.filter(function (c) { return !c.resolved && indexOf(c.slide) >= 0; }).length;
      box.innerHTML = head + '<div class="rvw-body">' +
        '<section class="rvw-sec"><p class="rvw-label">Covered by</p>' + ownerPickerHtml(i) + '</section>' +
        '<section class="rvw-sec"><p class="rvw-label">' + (openC.length ? openC.length + ' open' : 'No open comments') + '</p>' +
        openC.map(function (c) { return threadHtml(c); }).join('') +
        '<form class="rvw-new"><textarea rows="3" maxlength="2000" placeholder="Comment on this slide" aria-label="Comment on this slide"></textarea>' +
        '<div class="rvw-row"><span class="rvw-hint">⌘ Enter to post</span><button class="rvw-btn is-primary" type="submit">Comment</button></div></form>' +
        (done.length ? '<details class="rvw-old"><summary>' + done.length + ' resolved</summary>' + done.map(function (c) { return threadHtml(c); }).join('') + '</details>' : '') +
        '</section></div>' +
        '<footer class="rvw-foot"><span>' + totalOpen + ' open in this deck</span><a data-board target="_blank" rel="noopener">All slides</a><span class="rvw-me">' + chip(me(), 'is-small') + '<button type="button" class="rvw-link is-quiet" data-signout>Switch</button></span></footer>';
      var nta = one('.rvw-new textarea', box), form = one('.rvw-new', box);
      nta.value = drafts[i] || '';
      if (focusIn) nta.focus();
      submitOnKey(nta, form);
      form.addEventListener('submit', function (e) {
        e.preventDefault(); var t = nta.value.trim(); if (!t) return;
        // Clear now; a failed save puts the text back.
        nta.value = ''; drafts[i] = '';
        busy(form, send({ op: 'comment', slide: IDS[i], label: labelOf(slides[i], i), n: i + 1, text: t }).catch(function (err) {
          var box2 = one('.rvw-new textarea', box); if (last === i && box2 && !box2.value) box2.value = t; else drafts[i] = t; throw err;
        }));
      });
      one('[data-signout]', box).addEventListener('click', function () { put('rcc-review-name', ''); connect(); });
      // Set in code: a bundled deck may not carry a literal local link (publish-deck.sh checks).
      one('[data-board]', box).href = location.href.split('#')[0].split('?')[0] + '?view=review';
      wireHead();
    }
    function wireHead() { var x = one('.rvw-x', box); if (x) x.addEventListener('click', toggle); }
    function toggle() {
      open = !open;
      if (open && !box) {
        box = make('aside', 'rvw-panel', document.body); box.setAttribute('aria-label', 'Review');
        // Clicks in the panel are the panel's: some decks advance on any click.
        ['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend'].forEach(function (t) { box.addEventListener(t, function (e) { e.stopPropagation(); }); });
        box.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !/^(TEXTAREA|INPUT)$/.test(e.target.tagName)) toggle(); });
        wireThreads(box); wirePicker(box, function () { return cur(); });
      }
      root.classList.toggle('rvw-open', open);
      if (box) box.hidden = !open;
      if (open) { if (R.status === 'off' && DECK) connect(); draw(); var f = one('textarea, input', box); if (f && R.status === 'live') { /* keep the deck keys: focus stays on the deck */ } }
      // The deck kits size the stage from the window; tell them it changed.
      setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 0);
      put('rcc-review-open', open ? '1' : '');
    }
    R.fns.push(draw);
    // Follow the deck as it moves.
    setInterval(function () { if (open && cur() !== last) draw(); }, 200);
    setInterval(function () { if (open) all('time[datetime]', box).forEach(function (t) { t.textContent = ago(t.getAttribute('datetime')); }); }, 30000);
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === 'c' || e.key === 'C') { e.preventDefault(); toggle(); }
    });
    var help = one('.deck-help tbody');
    if (help) { var tr = make('tr', '', help); tr.innerHTML = '<td><kbd>C</kbd></td><td>Review: comments and who covers this slide</td>'; }
    if (/[?&]review\b/.test(location.search) || get('rcc-review-open')) toggle();
    else if (key() && me()) connect();   // the speaker labels, for presenter.js
  }

  /* ---------- The whole-deck board (?view=review) ------------------------- */
  function board() {
    root.classList.add('pv-tool', 'rvw-tool');
    // The deck's keys stay off on the board; typing in a comment box still works.
    window.addEventListener('keydown', function (e) { var t = e.target; if (e.isTrusted && !(t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) e.stopImmediatePropagation(); }, true);
    document.title = (deck.getAttribute('data-ledger') || document.title) + ' · Review';
    var bd = make('div', 'rvw-board', document.body), filter = get('rcc-review-filter') || 'all', expanded = {};
    ['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup'].forEach(function (t) { bd.addEventListener(t, function (e) { e.stopPropagation(); }); });
    function draw() {
      var deckName = esc(deck.getAttribute('data-ledger') || document.title);
      if (R.status !== 'live' || !R.doc) {
        bd.innerHTML = '<header class="rvw-bhead"><h1>' + deckName + '</h1></header><div class="rvw-bsign">' +
          (R.status === 'locked' ? signInHtml() : '<p class="' + (R.why ? 'rvw-err' : 'rvw-muted') + '">' + esc(R.why || 'Connecting…') + '</p>') + '</div>';
        wireSignIn(bd); return;
      }
      var people = {}, none = 0, openAll = 0;
      slides.forEach(function (s, i) { var o = ownerOf(i); if (o) people[o] = (people[o] || 0) + 1; else none++; openAll += openCount(i); });
      var tally = Object.keys(people).sort().map(function (n) {
        return '<button type="button" class="rvw-tally" data-filter="who:' + esc(n) + '" aria-pressed="' + (filter === 'who:' + n) + '">' + chip(n) + '<span>' + people[n] + '</span></button>';
      }).join('') + '<button type="button" class="rvw-tally" data-filter="none" aria-pressed="' + (filter === 'none') + '"><span class="rvw-who is-none">Unassigned</span><span>' + none + '</span></button>' +
        '<button type="button" class="rvw-tally" data-filter="open" aria-pressed="' + (filter === 'open') + '"><span class="rvw-who is-none">Open comments</span><span>' + openAll + '</span></button>' +
        (filter !== 'all' ? '<button type="button" class="rvw-link" data-filter="all">Show all slides</button>' : '');
      var rows = slides.map(function (s, i) {
        var o = ownerOf(i), n = openCount(i);
        if (filter === 'none' && o) return '';
        if (filter === 'open' && !n) return '';
        if (filter.indexOf('who:') === 0 && o !== filter.slice(4)) return '';
        var prev = i ? ownerOf(i - 1) : '', hand = i > 0 && o && o !== prev;
        var list = commentsOf(i).filter(function (c) { return !c.resolved; });
        return '<li class="rvw-slide' + (hand ? ' is-hand' : '') + '" data-i="' + i + '">' +
          (hand ? '<p class="rvw-handoff">' + (prev ? esc(prev) + ' hands to ' + esc(o) : esc(o) + ' takes over') + '</p>' : '') +
          '<div class="rvw-srow"><span class="rvw-n">' + (i + 1) + '</span><p class="rvw-sname">' + esc(labelOf(s, i)) + '</p>' +
          '<button type="button" class="rvw-count' + (n ? ' has-open' : '') + '" data-toggle aria-expanded="' + !!expanded[i] + '">' + (n ? n + ' open' : 'Comment') + '</button>' +
          ownerPickerHtml(i) + '</div>' +
          (expanded[i] ? '<div class="rvw-sthreads">' + list.map(function (c) { return threadHtml(c); }).join('') +
            '<form class="rvw-new" data-i="' + i + '"><textarea rows="2" maxlength="2000" placeholder="Comment on slide ' + (i + 1) + '" aria-label="Comment on slide ' + (i + 1) + '"></textarea><div class="rvw-row"><span class="rvw-hint">⌘ Enter to post</span><button class="rvw-btn is-primary" type="submit">Comment</button></div></form></div>' : '') +
          '</li>';
      }).join('');
      var lost = orphans().filter(function (c) { return !c.resolved; });
      bd.innerHTML = '<header class="rvw-bhead"><div><p class="rvw-kicker">Review · ' + slides.length + ' slides</p><h1>' + deckName + '</h1></div>' +
        '<span class="rvw-me">' + chip(me()) + '<button type="button" class="rvw-link is-quiet" data-signout>Switch</button></span></header>' +
        '<div class="rvw-tallies" role="group" aria-label="Filter slides">' + tally + '</div>' +
        '<ol class="rvw-slides">' + (rows || '<li class="rvw-muted">No slides match.</li>') + '</ol>' +
        (lost.length ? '<section class="rvw-lost"><h2>On slides that were renamed or removed</h2>' + lost.map(function (c) { return threadHtml(c, { slide: true }); }).join('') + '</section>' : '');
      all('.rvw-new', bd).forEach(function (f) {
        var i = +f.getAttribute('data-i'), ta = one('textarea', f); submitOnKey(ta, f);
        f.addEventListener('submit', function (e) {
          e.preventDefault(); var t = ta.value.trim(); if (!t) return; ta.value = '';
          busy(f, send({ op: 'comment', slide: IDS[i], label: labelOf(slides[i], i), n: i + 1, text: t }).catch(function (err) { var again = one('.rvw-new[data-i="' + i + '"] textarea', bd); if (again && !again.value) again.value = t; throw err; }));
        });
      });
      var so = one('[data-signout]', bd); if (so) so.addEventListener('click', function () { put('rcc-review-name', ''); connect(); });
    }
    bd.addEventListener('click', function (e) {
      var f = e.target.closest('[data-filter]');
      if (f) { filter = f.getAttribute('data-filter'); if (f.getAttribute('aria-pressed') === 'true') filter = 'all'; put('rcc-review-filter', filter); draw(); return; }
      var t = e.target.closest('[data-toggle]');
      if (t) { var i = +t.closest('.rvw-slide').getAttribute('data-i'); expanded[i] = !expanded[i]; draw(); var ta = one('.rvw-slide[data-i="' + i + '"] textarea', bd); if (ta && expanded[i]) ta.focus(); }
    });
    wireThreads(bd); wirePicker(bd, function (b) { var li = b.closest('.rvw-slide'); return li ? +li.getAttribute('data-i') : -1; });
    // Keep a half-typed comment when someone else's change redraws the board.
    R.fns.push(function () {
      var keep = {}, focus = null;
      all('.rvw-new', bd).forEach(function (f) { var ta = one('textarea', f); keep[f.getAttribute('data-i')] = ta.value; if (document.activeElement === ta) focus = f.getAttribute('data-i'); });
      draw();
      Object.keys(keep).forEach(function (k) { var ta = one('.rvw-new[data-i="' + k + '"] textarea', bd); if (ta) { ta.value = keep[k]; if (focus === k) ta.focus(); } });
    });
    setInterval(function () { all('time[datetime]', bd).forEach(function (t) { t.textContent = ago(t.getAttribute('datetime')); }); }, 30000);
    connect();
  }

  /* ---------- Styles ----------------------------------------------------- */
  var css = [
    ':root{--rvw-surface:var(--pv-surface,var(--rcc-surface,var(--acm-surface,#fff)));--rvw-on:var(--pv-on,var(--rcc-on-surface,var(--acm-on-surface,#1f1f1f)));',
    '--rvw-muted:var(--rcc-on-surface-variant,var(--acm-on-surface-variant,#5f6368));--rvw-line:var(--rcc-outline-variant,var(--acm-outline-variant,#dadce0));',
    '--rvw-box:var(--rcc-surface-container,var(--acm-surface-container,#f1f3f4));--rvw-box-high:var(--rcc-surface-container-high,var(--acm-surface-container-high,#e8eaed));',
    '--rvw-primary:var(--rcc-primary,var(--acm-primary,#1a73e8));--rvw-on-primary:var(--rcc-on-primary,var(--acm-on-primary,#fff));',
    '--rvw-hl:var(--rcc-highlight,var(--acm-highlight,#f9ab00));--rvw-err:#b3261e;--rvw-ring:var(--rcc-focus-ring,var(--acm-focus-ring,#1a73e8));',
    '--rvw-font:var(--rcc-font-brand,var(--acm-font-brand,system-ui,sans-serif));--rvw-code:var(--rcc-font-code,var(--acm-font-code,ui-monospace,monospace));--rvw-w:min(400px,40vw)}',
    // The kit decks letterbox into the space left of the panel; other decks get the panel on top.
    '.deck-live.is-presenting.rvw-open .deck{right:var(--rvw-w);width:min(calc(100vw - var(--rvw-w)),calc(100dvh * 16 / 9));height:min(100dvh,calc((100vw - var(--rvw-w)) * 9 / 16))}',
    '.rvw-panel{position:fixed;z-index:40;top:0;right:0;bottom:0;width:var(--rvw-w);min-width:300px;display:flex;flex-direction:column;background:var(--rvw-surface);color:var(--rvw-on);font:15px/1.45 var(--rvw-font);box-shadow:-1px 0 0 var(--rvw-line),-8px 0 24px rgb(0 0 0/.08);text-align:left}',
    '.rvw-panel[hidden]{display:none}',
    '.rvw-head{display:flex;align-items:flex-start;gap:10px;padding:16px 16px 12px;border-bottom:1px solid var(--rvw-line)}.rvw-head>div{flex:1;min-width:0}',
    '.rvw-kicker{margin:0;font:500 12px var(--rvw-code);letter-spacing:.06em;text-transform:uppercase;color:var(--rvw-muted)}',
    '.rvw-title{margin:2px 0 0;font:500 19px/1.3 var(--rvw-font);overflow-wrap:anywhere}',
    '.rvw-dot{width:10px;height:10px;border-radius:50%;margin-top:6px;flex:none;background:var(--rvw-line)}.rvw-dot.is-live{background:#1e8e3e}.rvw-dot.is-connecting{background:var(--rvw-hl)}.rvw-dot.is-error{background:var(--rvw-err)}',
    '.rvw-x{border:0;background:none;color:var(--rvw-muted);font-size:24px;line-height:1;padding:0 4px;cursor:pointer;border-radius:6px}.rvw-x:hover{background:var(--rvw-box-high)}',
    '.rvw-body{flex:1;overflow:auto;padding:4px 16px 16px}',
    '.rvw-sec{padding:12px 0;border-bottom:1px solid var(--rvw-line)}.rvw-sec:last-child{border-bottom:0}',
    '.rvw-label{margin:0 0 8px;font:500 12px var(--rvw-code);letter-spacing:.06em;text-transform:uppercase;color:var(--rvw-muted)}',
    '.rvw-muted{color:var(--rvw-muted);margin:12px 0}.rvw-err{color:var(--rvw-err);margin:8px 0}.rvw-lede{margin:12px 0}',
    '.rvw-who{--h:0;display:inline-flex;align-items:center;gap:6px;padding:3px 10px 3px 3px;border-radius:999px;background:hsl(var(--h) 60% 92%);color:hsl(var(--h) 55% 24%);font:500 14px var(--rvw-font);white-space:nowrap}',
    '.rvw-who b{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:hsl(var(--h) 50% 40%);color:#fff;font-size:12px}',
    '.rvw-who.is-none{padding:3px 10px;background:var(--rvw-box);color:var(--rvw-muted)}.rvw-who.is-small{font-size:13px;padding:1px 8px 1px 1px}.rvw-who.is-small b{width:18px;height:18px;font-size:11px}',
    '[data-theme="dark"] .rvw-who{background:hsl(var(--h) 30% 24%);color:hsl(var(--h) 70% 88%)}',
    '.rvw-pick{display:flex;flex-wrap:wrap;gap:6px}',
    '.rvw-pick__b{border:0;padding:0;background:none;border-radius:999px;cursor:pointer;opacity:.55;filter:saturate(.4)}.rvw-pick__b:hover{opacity:.85}',
    '.rvw-pick__b[aria-pressed="true"]{opacity:1;filter:none;box-shadow:0 0 0 2px var(--rvw-surface),0 0 0 4px hsl(var(--h,0) 50% 40%)}',
    '.rvw-pick__b[aria-pressed="true"] .rvw-who{box-shadow:none}',
    '.rvw-pick__add{border:1px dashed var(--rvw-line);background:none;color:var(--rvw-muted);border-radius:999px;padding:3px 10px;font:500 13px var(--rvw-font);cursor:pointer}',
    '.rvw-c{padding:10px 12px;margin:0 0 8px;border-radius:12px;background:var(--rvw-box)}.rvw-c.is-resolved{opacity:.75}',
    '.rvw-meta{display:flex;align-items:center;gap:8px;margin:0 0 4px;font-size:12px;color:var(--rvw-muted)}',
    '.rvw-agent{font:500 10px var(--rvw-code);letter-spacing:.06em;text-transform:uppercase;padding:1px 6px;border-radius:4px;background:var(--rvw-box-high);color:var(--rvw-on)}',
    '.rvw-text{margin:0;overflow-wrap:anywhere}.rvw-r{margin:10px 0 0 12px;padding-left:10px;border-left:2px solid var(--rvw-line)}',
    '.rvw-done{margin:8px 0 0;font-size:13px;color:var(--rvw-muted)}.rvw-on{margin:0 0 6px;font:500 12px var(--rvw-code);color:var(--rvw-muted)}',
    '.rvw-acts{display:flex;gap:14px;margin-top:6px}',
    '.rvw-link{border:0;background:none;padding:2px 0;color:var(--rvw-primary);font:500 13px var(--rvw-font);cursor:pointer}.rvw-link.is-quiet{color:var(--rvw-muted)}.rvw-link:hover{text-decoration:underline}',
    '.rvw-new,.rvw-replybox{margin-top:10px}.rvw-new textarea,.rvw-replybox textarea,.rvw-field input{width:100%;box-sizing:border-box;font:15px/1.4 var(--rvw-font);color:var(--rvw-on);background:var(--rvw-surface);border:1px solid var(--rvw-line);border-radius:10px;padding:8px 10px;resize:vertical}',
    '.rvw-new textarea:focus,.rvw-replybox textarea:focus,.rvw-field input:focus{outline:2px solid var(--rvw-ring);outline-offset:0;border-color:transparent}',
    '.rvw-row{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:6px}.rvw-hint{margin-right:auto;font-size:12px;color:var(--rvw-muted)}',
    '.rvw-btn{font:500 14px var(--rvw-font);border:1px solid var(--rvw-line);background:none;color:var(--rvw-on);border-radius:999px;padding:6px 14px;cursor:pointer}',
    '.rvw-btn.is-primary{background:var(--rvw-primary);color:var(--rvw-on-primary);border-color:transparent}',
    '.rvw-btn:focus-visible,.rvw-link:focus-visible,.rvw-pick__b:focus-visible,.rvw-pick__add:focus-visible,.rvw-x:focus-visible,.rvw-tally:focus-visible,.rvw-count:focus-visible{outline:3px solid var(--rvw-ring);outline-offset:2px}',
    '.is-busy{opacity:.6;pointer-events:none}',
    '.rvw-old{margin-top:12px}.rvw-old summary{cursor:pointer;color:var(--rvw-muted);font-size:13px;margin-bottom:8px}',
    '.rvw-foot{display:flex;align-items:center;gap:12px;padding:10px 16px;border-top:1px solid var(--rvw-line);font-size:13px;color:var(--rvw-muted)}.rvw-foot a{color:var(--rvw-primary);font-weight:500}.rvw-me{margin-left:auto;display:inline-flex;align-items:center;gap:8px}',
    '.rvw-signin{display:grid;gap:12px}.rvw-field{display:grid;gap:4px;font-size:13px;color:var(--rvw-muted)}',
    '.rvw-toast{position:fixed;z-index:41;left:50%;bottom:24px;transform:translate(-50%,8px);margin:0;background:var(--rvw-on);color:var(--rvw-surface);padding:10px 16px;border-radius:8px;font:500 14px var(--rvw-font);opacity:0;pointer-events:none;transition:opacity .2s,transform .2s}.rvw-toast.is-on{opacity:1;transform:translate(-50%,0)}',
    // The board.
    '.rvw-tool .deck,.rvw-tool .chrome,.rvw-tool .deck-notes,.rvw-tool .deck-help,.rvw-tool .deck-toast,.rvw-tool #count{display:none!important}',
    'html.rvw-tool,.rvw-tool body{height:auto!important;overflow:auto!important;margin:0;background:var(--rvw-surface)!important;color:var(--rvw-on)}',
    '.rvw-board{max-width:1080px;margin:0 auto;padding:24px 16px 64px;font:15px/1.45 var(--rvw-font);text-align:left}',
    '.rvw-bhead{display:flex;align-items:flex-end;gap:16px;margin-bottom:16px}.rvw-bhead>div{flex:1;min-width:0}.rvw-bhead h1{margin:2px 0 0;font:500 26px/1.2 var(--rvw-font)}',
    '.rvw-bsign{max-width:380px}',
    '.rvw-tallies{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:16px}',
    '.rvw-tally{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--rvw-line);background:none;border-radius:999px;padding:3px 10px 3px 3px;cursor:pointer;font:500 14px var(--rvw-font);color:var(--rvw-on)}',
    '.rvw-tally[aria-pressed="true"]{border-color:var(--rvw-on);box-shadow:inset 0 0 0 1px var(--rvw-on)}',
    '.rvw-slides{list-style:none;margin:0;padding:0;border-top:1px solid var(--rvw-line)}',
    '.rvw-slide{border-bottom:1px solid var(--rvw-line);padding:10px 0}',
    '.rvw-handoff{margin:0 0 6px 40px;font:500 12px var(--rvw-code);letter-spacing:.04em;color:var(--rvw-muted)}.rvw-handoff::before{content:"↓ "}',
    '.rvw-srow{display:grid;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;gap:6px 12px}',
    '.rvw-srow .rvw-pick{grid-column:2/-1}',
    '@media(min-width:860px){.rvw-srow{grid-template-columns:32px minmax(0,1fr) auto minmax(0,1.1fr)}.rvw-srow .rvw-pick{grid-column:auto;justify-content:flex-end}}',
    '.rvw-n{font:500 14px var(--rvw-code);color:var(--rvw-muted);text-align:right}.rvw-sname{margin:0;font-weight:500;overflow-wrap:anywhere}',
    '.rvw-count{border:0;background:var(--rvw-box);color:var(--rvw-muted);border-radius:999px;padding:4px 10px;font:500 13px var(--rvw-font);cursor:pointer;white-space:nowrap}',
    '.rvw-count.has-open{background:var(--rvw-hl);color:#1f1f1f}',
    '.rvw-sthreads{margin:10px 0 4px 44px;max-width:640px}',
    '.rvw-lost{margin-top:32px}.rvw-lost h2{font:500 16px var(--rvw-font);margin:0 0 10px}',
    '@media print{.rvw-panel,.rvw-toast{display:none!important}}'
  ].join('\n');
  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  /* ---------- Start ------------------------------------------------------ */
  if (VIEW === 'review') board();
  else if (VIEW === 'mirror') { /* a preview frame: no review */ }
  else if (VIEW) { if (key() && me()) connect(); }   // presenter, remote, run sheet: the speaker labels
  else panel();
})();

/* explorai-presenter.js: fits an ExplorAI deck to presenter.js (the presenter view, phone and
   iPad remote, run sheet, and bridge lines from the GDG and ACM deck kits).

   Load it at the end of <body>, after the deck's own script and before presenter.js:
     <script src="../shared/explorai-presenter.js"></script>
     <script src="../shared/presenter.js"></script>
   The deck's script must define window.__explorDeck = { slides: [{ beats, timer }], state() }
   and jump to the slide in the URL hash on hashchange (Meeting 3's index.html shows both).

   What this file does:
   - marks #stage as .deck and each <section> as .slide, which is what presenter.js looks for
   - copies each card of the meeting's notes.html into its slide as hidden .notes; cards and
     slides match one to one (scripts/check.sh enforces it), and p.bridge is the bridge line
   - maps the ExplorAI palette onto the token names presenter.js styles itself with
   - hands presenter.js the deck once the notes are in, so the run sheet shows them */
(function () {
  'use strict';
  var stage = document.getElementById('stage');
  if (!stage || !window.__explorDeck) return;
  var slides = Array.prototype.filter.call(stage.children, function (el) { return el.tagName === 'SECTION'; });
  stage.classList.add('deck');
  slides.forEach(function (s) {
    s.classList.add('slide');
    // presenter.js names a slide by its h1/h2; a slide without one goes by its eyebrow line.
    var eb = s.querySelector('.eyebrow');
    if (!s.querySelector('h1, h2') && !s.getAttribute('aria-label') && eb) s.setAttribute('aria-label', eb.textContent.replace(/\s+/g, ' ').trim());
  });
  // Name each press so the views can say "Next press: strawberry": presenter.js reads the
  // k-th [data-beat] in a slide, so each reveal gets a hidden label in reveal order.
  slides.forEach(function (s) {
    Array.prototype.forEach.call(s.querySelectorAll('[data-build-in],[data-step]'), function (el) {
      var src = el.querySelector('.plain, h3, .lbl b, b') || el;
      var text = src.textContent.replace(/\s+/g, ' ').trim();
      var tag = document.createElement('span'); tag.hidden = true; tag.setAttribute('data-beat', '');
      tag.textContent = text.length > 70 ? text.slice(0, 67) + '…' : text;
      el.appendChild(tag);
    });
  });

  var m = /\/meetings\/(meeting-\d+)\//.exec(location.pathname + (/\/$/.test(location.pathname) ? '' : '/'));
  var folder = m ? m[1] : 'deck';
  stage.setAttribute('data-deck', 'explorai-' + folder);
  stage.setAttribute('data-ledger', document.title);
  // A deck opened locally gives the phone the published copy instead.
  stage.setAttribute('data-live-url', 'https://pcolee.github.io/explorAI/meetings/' + folder + '/');

  var css = [
    ':root{--rcc-surface:#FFFBF5;--rcc-on-surface:#3A4433;--rcc-on-surface-variant:#5E6857;--rcc-outline-variant:#DCE6C0;--rcc-outline:#9CB57B;',
    '--rcc-surface-container:#F4F7E6;--rcc-surface-container-high:#EAEFD2;--rcc-primary:#3F5A2A;--rcc-on-primary:#FFFBF5;',
    '--rcc-highlight:#A8487A;--rcc-highlight-container:#FBE6EF;--rcc-on-highlight-container:#5C1F3E;',
    "--rcc-font-brand:'DM Sans',Arial,sans-serif;--rcc-font-code:'DM Mono',ui-monospace,Menlo,monospace;--rcc-focus-ring:#A8487A}",
    '.slide>.notes{display:none!important}',
    'html.pv-tool,.pv-tool body{height:auto!important;overflow:auto!important;background:#FFFBF5!important}',
    '.pv-tool #count,.pv-mirror #count{display:none!important}',
    '.pv__notes .say,.rv__notes .say,.rs__notes .say{color:#3F5A2A}',
    '.pv__notes .do,.rv__notes .do,.rs__notes .do{color:#5E6857;font-style:italic}',
    ".pv__notes .do span,.rv__notes .do span,.rs__notes .do span{font:700 .7em 'DM Sans',sans-serif;font-style:normal;letter-spacing:.1em;text-transform:uppercase;color:#A8487A;margin-right:.6em}",
    ".pv__notes .copy,.rv__notes .copy,.rs__notes .copy{white-space:pre-wrap;font:500 .8em/1.45 'DM Mono',ui-monospace,monospace;background:#F4F7E6;border-radius:10px;padding:10px 12px;margin:0 0 12px}",
    '.pv__notes .time,.rv__notes .time{font:500 .75em var(--rcc-font-code);color:#A8487A;margin:0 0 8px}'
  ].join('\n');
  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  function ready() { window.__deck = window.__explorDeck; }
  if (!window.fetch || !window.DOMParser) { ready(); return; }
  fetch('notes.html').then(function (r) { if (!r.ok) throw r.status; return r.text(); }).then(function (text) {
    var doc = new DOMParser().parseFromString(text, 'text/html');
    Array.prototype.forEach.call(doc.querySelectorAll('article.note[data-i]'), function (card) {
      var s = slides[+card.getAttribute('data-i') - 1]; if (!s) return;
      var box = document.createElement('div'); box.className = 'notes'; box.hidden = true;
      var t = card.querySelector('.time');
      if (t) { var p = document.createElement('p'); p.className = 'time'; p.textContent = 'Starts ' + t.textContent; box.appendChild(p); }
      Array.prototype.forEach.call(card.querySelectorAll('.say, .do, .copy, .bridge'), function (el) { box.appendChild(document.importNode(el, true)); });
      s.appendChild(box);
    });
  }).catch(function () { /* opened as a file, or no notes.html: the views still run, without notes */ }).then(ready);
})();

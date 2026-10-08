/* review.js: live review for a deck. Loads the club relay's annotation client, which does the work:
     A              annotate: pin a note to a spot, a word, or a whole slide; suggest replacement text
     I              the notes inbox for this deck (after Google sign-in)
     ?view=review   the whole deck as a board: who covers each slide, every open note
   Notes, replies, and speakers are shared live by everyone working on the deck and by their Claude
   Code agents (scripts/review.mjs, or the relay's MCP server). Sign-in is Google, limited to each
   club's member list on the relay, so nothing secret is ever in a deck file. presenter.js reads
   window.__review to show the speaker and each slide's open notes in the presenter view and remote;
   the audience never sees notes. Without the relay, data-owner attributes on the slides (written
   at publish time) still name the speakers.

   One copy lives in rcc-gdg/deck-kit, one in rcc-acm/deck-kit, and one in pcolee/explorAI
   meetings/shared; change all three together. Load it with its own deferred script tag after
   presenter.js. */
(function () {
  'use strict';
  if (window.__review || !document.querySelector('.deck') || /[?&]view=mirror\b/.test(location.search)) return;
  var s = document.createElement('script');
  s.src = 'https://deck-relay-954308885597.us-west1.run.app/client/v1/annotate.js';
  s.async = true;
  s.crossOrigin = 'anonymous';
  document.head.appendChild(s);
})();

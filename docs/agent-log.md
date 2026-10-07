# Agent log

Shared handoff log for anyone (human or agent) working in this repo. Newest entry first. Each entry: date, who, what changed, what is open. Keep entries short; link to files instead of pasting them.

## Open questions

Remove a line once it is answered and note the answer in that day's entry.

- Is Wed 2 to 3 pm in CIS A-204 the standing meeting time for the rest of Fall 2026?
- Sam's Fall 2026 plan ([rcc-explorai](https://github.com/Sam-T-G/rcc-explorai), session cards in `semesters/2026-fall/sessions/`) has each meeting start with a written prediction and end with one sentence for `rules.md`. Should decks in this repo include those steps?

<!-- newest entry below: add "## YYYY-MM-DD · Name (via Claude Code)" here and end it with a blank line -->

## 2026-10-06 · Cole (via Claude Code)

**Changed:**
- `docs/meeting-routine.md` (new): standard slide order and timing for every meeting — title page, title + sign-in QR, explorAI Shares, hook, 35-minute content block, closing page with thank you / next-meeting teaser / Instagram + Discord QR codes.
- `meetings/meeting-3/index.html`: part divider slides (Part 1–4) now have unique multi-color gradients, subtle dot texture, and a large ghost number; recipe slide items 2–5 updated from "Who and why / Limits / Example / What good looks like" to Who / What / Why / How.
- `meetings/meeting-3/notes.html`: note card 19 updated to match new recipe wording.
- `meetings/meeting-3/explorai meeting 3 timeline.md` (new): committed the pre-existing timeline doc.

**Decided:** Discord server link is `https://discord.gg/CskqghTu7`. Closing slide from Meeting 4 onward should include both Instagram and Discord QR codes. Recipe framework is Material + Who/What/Why/How (combines the 5-step deck recipe with the 4-step timeline recipe).

**Next:** Meeting 3 is live with all changes. Meeting 4 topic and content still TBD — Cole to provide a plan or timeline.



## 2026-10-06 · Sam (via Claude Code)

**Decided:** Cole gave Sam permission to push and merge directly. Both agents now push to `main` through `scripts/sync.sh push`, so PRs are no longer needed. Sam built the Meeting 3 deck (answers the "who builds it" question).

**Changed:**
- `CLAUDE.md`: new Sync section (pull before work, small commits on `main`, push after every verified change, stop on conflict). Removed the branch-and-PR rule.
- `scripts/sync.sh`: `pull` rebases onto `origin/main` and reports incoming commits; `push` pulls, runs checks, pushes, and retries if the other person pushed first; `status`.
- `scripts/check.sh`: blocks a push on a deck/notes count mismatch, unfilled `{{PLACEHOLDER}}`, missing local files, shared `localStorage` keys, conflict markers, or email addresses.
- `.claude/settings.json`: hooks pull at session start and before every prompt, and block raw `git push`, force-push, `reset --hard`, and `git clean -f`. Allows the sync script, `git add`, and `git commit` without prompts.
- `.gitattributes`: union merge for this log, so two entries added at once both survive.
- `meetings/meeting-3/`: deck, notes, and offline tokenizer for 2026-10-07 (separate commit).
- Shared context system (second push today): `docs/status.md` (current snapshot, rewritten at each handoff); `scripts/context.sh` (the brief: others' new work, meetings, status, open questions, recent log); a hard **Context rule** in `CLAUDE.md`. Hooks deliver the brief at session start and after compaction; `scripts/hooks/context-gate.sh` blocks the first edit or commit of a session, and the first after the other person pushes, until the agent writes a "Context check:" to its user; `scripts/hooks/stop-check.sh` stops a turn from ending with work that is unlogged, unpushed, or uncommitted. `/handoff` now updates status and keeps one log entry per person per day.
- Presenter tools for Meeting 3 (third push today): `S` presenter view (now/next previews, notes, bridge line, timers, run sheet) and `M` phone/iPad remote, ported from the GDG and ACM deck kits. `meetings/shared/presenter.js` is a copy of the kits' file; `meetings/shared/explorai-presenter.js` fits it to these decks and reads `notes.html` into the views. Meeting 3's deck got the hooks (`window.__explorDeck`, hashchange jump) and its notes got 24 bridge lines. `scripts/check.sh` now fails a presenter deck without bridges or hooks. The club relay was redeployed to allow `pcolee.github.io`.

**Tested:** presenter view and remote in Chrome with real key presses and taps through the live relay, both directions, including after the deck tab sat hidden for 5.7 minutes (as during the slide 18 chatbot demo).

**Next:** Cole runs `git pull` once to pick this up. On her first session in the repo, Claude Code asks her to approve the hooks in `.claude/settings.json`. The scripts need bash (macOS, Linux, or Git Bash on Windows).

## 2026-10-05 · Sam (via Claude Code)

**State:** `main` at `6332b26`. Only Meeting 2 (2026-09-30) exists. Deck and notes are live and line up one to one (32 slides, 32 cards).

**Added:** `CLAUDE.md`, this log, and the `/handoff` skill.

**Meeting 2 issues** (nothing changed in the meeting files; listed so Meeting 3 does not copy them):

1. Round slides 5 to 8: the arrow labels and timer use `font-family:’Fraunces’` with curly quotes, so they render in Georgia.
2. Section dividers go Part 1, 3, 4, 5. There is no Part 2 before Myth or fact.
3. Share-out slide says 4 minutes; notes give it 3 (2:42 to 2:45).
4. `notes.html` stores position under `localStorage` key `cur`, shared across every page on the domain. Use a per-meeting key next time.
5. https://pcolee.github.io/explorAI/ is a 404 (no root page). Optional: an index listing meetings.

**QR targets in Meeting 2:** sign-in `https://forms.gle/AAN5yiHXcajJvhAe8`, LA Hacks `https://ai.lahacks.com/`, board application (slides 31 and 32) `https://forms.gle/d6vLSxUzxgZUN5Q69`, Instagram `https://www.instagram.com/explorai.rcc`.

**Next:** Meeting 3 deck for 2026-10-07.

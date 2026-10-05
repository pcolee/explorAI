# Agent log

Shared handoff log for anyone (human or agent) working in this repo. Newest entry first. Each entry: date, who, what changed, what is open. Keep entries short; link to files instead of pasting them.

## Open questions

Remove a line once it is answered and note the answer in that day's entry.

- Who is building the Meeting 3 deck (Wed 2026-10-07, "Building AI Context")?
- Is Wed 2 to 3 pm in CIS A-204 the standing meeting time for the rest of Fall 2026?
- Sam's Fall 2026 plan ([rcc-explorai](https://github.com/Sam-T-G/rcc-explorai), session cards in `semesters/2026-fall/sessions/`) has each meeting start with a written prediction and end with one sentence for `rules.md`. Should decks in this repo include those steps?

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

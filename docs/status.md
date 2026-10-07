# Status

Where everything stands right now. `/handoff` rewrites this file in place (it is a snapshot, not a log). History and reasons go in `docs/agent-log.md`. Slide counts and last-change dates are computed by `scripts/context.sh`, so they are not repeated here.

Last updated: 2026-10-07 by Sam.

## Meetings

| # | Date | Topic | State | Next / blocking |
|---|---|---|---|---|
| 2 | 2026-09-30 | What is AI, really? | Presented | None. Known cosmetic issues listed in the 2026-10-05 log entry. |
| 3 | 2026-10-07 | How AI reads your words | Presented | Polish complete. 25 slides, 25 notes. Vivid card has attachments badge + multi-step prompt. Thanks slide shows two next-meeting cards. Activity Part 1 cards have no numbers. |
| 4 | 2026-10-14 | AI Discussion | Not started | Topic TBD — Cole to confirm. |
| 5 | 2026-10-21 | Build One Thing | Not started | Decide topic and who builds it. |

## Standing facts

- Meetings: Wednesdays 2:00 to 3:00 pm, CIS A-204 (from the decks; not yet confirmed as standing for the term).
- Live site: `https://pcolee.github.io/explorAI/meetings/meeting-N/`. Every push to `main` publishes.
- Instagram: `@explorai.rcc`. Discord: `https://discord.gg/CskqghTu7`. Sign-in form and board application links are listed in the 2026-10-05 log entry.
- Meeting routine (slide order, timing, QR targets): `docs/meeting-routine.md`.
- Deck style: Meeting 3 moved the styles into classes so the next deck can reuse them. Start Meeting 4 from Meeting 3's `index.html` and `notes.html`, which also carry the presenter hooks and bridge lines (see "Presenter tools" in `CLAUDE.md`).
- Presenter tools: on the deck laptop, `S` opens the presenter view and `M` shows a QR code for a phone or iPad remote. Several remotes can connect at once.
- Starting Claude outside the repo folder: run `scripts/install-bridge.sh` once per machine so the hooks still run (Sam's machine has it).
- Watch for curly/typographic quotes when writing HTML — any `"…"` in attribute values breaks CSS and JS selectors. Only straight ASCII `"` works.

# Status

Where everything stands right now. `/handoff` rewrites this file in place (it is a snapshot, not a log). History and reasons go in `docs/agent-log.md`. Slide counts and last-change dates are computed by `scripts/context.sh`, so they are not repeated here.

Last updated: 2026-10-20 by Cole.

## Meetings

| # | Date | Topic | State | Next / blocking |
|---|---|---|---|---|
| 2 | 2026-09-30 | What is AI, really? | Presented | None. Known cosmetic issues listed in the 2026-10-05 log entry. |
| 3 | 2026-10-07 | How AI reads your words | Presented | Polish complete. 25 slides, 25 notes. Vivid card has attachments badge + multi-step prompt. Thanks slide shows two next-meeting cards. Activity Part 1 cards have no numbers. |
| 4 | 2026-10-14 | Let's argue about AI (discussion) | Drafting, live | First draft by Sam 2026-10-10 (`567bfe3`). Talking points were added 2026-10-12, and on 2026-10-13 it was rebuilt as one page per topic with a softer look (`170ed00`) and soft entrance animations (`ce4740f`). Discord posting prompts removed (`56f1382`), and an Anthropic false police tip quick round added (`cb785bb`): 15 slides, 15 notes. Order: welcome, sign-in, shares, rules, hands-up hook, School (discussion, 2:10 to 2:24), Jobs (discussion incl. society, who's responsible, slowing down, 2:24 to 2:40), quick round (AI friends, copyright, copying software, data centers incl. "what if they paid you" and a nearby-homes tax, AI acting on its own (Anthropic's false police tip), state laws), vote again, thanks. Notes keep only the open questions and cues. Cole to review (`A` in the deck). No speakers assigned. Open: slide 3 card 2 names the wrong model (GPT-6.1 Astra was cancelled; GPT-6.1 Sol shipped); the fix is proposed in the 2026-10-12 log entry and waiting on Sam. |
| 5 | 2026-10-21 | Build One Thing (vibe coding in Google AI Studio) | Drafting, live | First draft by Cole 2026-10-20 (`a0ff5b7`) from Cole's plan (`meetings/meeting-5/content.md`, not committed). 21 slides, 21 notes, plus `build.html`, a student build sheet with copy buttons (QR on the build slide). Order: cover, sign-in (title, date, QR only), Kaggle course share, free AI Pro, Meeting 3 callback, recipe for apps, vibe coding, traditional vs. vibe, hands-up poll, live demo (5 slides, 2:12 to 2:22), 5 rules, idea cards, fixes, build time (18:00, 2:26 to 2:44), show and tell (1:00 per pair, T restarts), takeaway, thanks. Open: the demo app is TBD in the plan, so slides 11 and 12 use Schedule Snapshot as a stand-in; the thanks slide says "Oct 28 · Topic coming soon". |

## Standing facts

- Meetings: Wednesdays 2:00 to 3:00 pm, CIS A-204 (from the decks; not yet confirmed as standing for the term).
- Live site: `https://pcolee.github.io/explorAI/meetings/meeting-N/`. Every push to `main` publishes.
- Instagram: `@explorai.rcc`. Discord: `https://discord.gg/CskqghTu7`. Sign-in form and board application links are listed in the 2026-10-05 log entry.
- Meeting routine (slide order, timing, QR targets): `docs/meeting-routine.md`.
- Deck style: Meeting 3 moved the styles into classes so the next deck can reuse them. Meeting 4 adds the soft, cozy pieces: `.topic` and `.round` one-page layouts, `.qcard` question card, taped `.sticky` notes, `.bubble` follow-ups, the `.spectrum` 0 to 5 vote bar, `.cozy` backgrounds, Fraunces soft axis, numbered `data-build-in` for reveal order, and the motion block (entrances replay each time a slide shows; off under prefers-reduced-motion). Start the next deck from Meeting 4's `index.html` and `notes.html`, which also carry the presenter hooks and bridge lines (see "Presenter tools" in `CLAUDE.md`).
- Presenter tools: on the deck laptop, `S` opens the presenter view and `M` shows a QR code for a phone or iPad remote. Several remotes can connect at once.
- Starting Claude outside the repo folder: run `scripts/install-bridge.sh` once per machine so the hooks still run (Sam's machine has it).
- Live review (Meeting 3 on): `A` in a deck to annotate, `I` for the notes inbox, `?view=review` for the board, `node scripts/review.mjs` for agents. Google sign-in, limited to each club's member list on the relay. The scripts and hooks are the shared coworking kit (same files in rcc-gdg and rcc-acm); ExplorAI's settings are in `scripts/coworking.conf`.
- Watch for curly/typographic quotes when writing HTML — any `"…"` in attribute values breaks CSS and JS selectors. Only straight ASCII `"` works.

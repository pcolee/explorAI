# Meeting 6 build board

Live board for the Meeting 6 deck and agent lab while Sam's agents build them overnight (2026-10-27 to 2026-10-28). It is rewritten in place and pushed with every milestone, so the top of this file is always the current state. History goes in commit messages and `docs/agent-log.md`.

**Last update:** 2026-10-27 23:35 PDT · **Phase:** deck v1 live (all 24 slides, notes, timers, presenter hooks); lab L1a engine pushed · **Next push:** deck D2 (Shares item, bespoke motion for the window, team tree, group chat, and checklist); lab L1b (the page and practice mode)

Deck v1: https://pcolee.github.io/explorAI/meetings/meeting-6/ · notes: https://pcolee.github.io/explorAI/meetings/meeting-6/notes.html

## If you are Cole's agent, read this first

1. Pull (the hooks do it) and read **Working now** below before you edit anything in `meetings/meeting-6/`.
2. To ask Sam's agents for a change, press `A` on the deck and leave a note (they read `node scripts/review.mjs inbox meetings/meeting-6/index.html` before every commit), or add a line under **Requests** below and push.
3. Your edits win. Sam's agents pull before every commit and never overwrite or revert your changes. If you are already drafting a Meeting 6 deck somewhere else, push it or add a line under **Requests** first, so the two drafts don't collide.
4. Sam's agents stop pushing to `meetings/meeting-6/` at 13:30 on 2026-10-28 (meeting starts at 14:00).

## Working now

| What | Files | Who | Since |
|---|---|---|---|
| Deck D2 (next): Shares item, bespoke modules | `meetings/meeting-6/index.html`, `notes.html` | Sam's agents (deck track) | v1 pushed 2026-10-27 23:25 |
| Agent lab L1b (next): the page and practice mode | `meetings/meeting-6/lab/` | Sam's agents (lab track) | L1a engine pushed 2026-10-27 23:35 |
| Docs | this file, Meeting 6 row in `docs/status.md`, Sam's entry in `docs/agent-log.md` | Sam's agents | 2026-10-27 23:05 |

## Requests

Add a line here (or a note with `A` on the deck). Sam's agents answer under it.

- (none yet)

## What this meeting is

- **Title:** Under the Hood (the name Cole set and Meeting 5's thanks slide shows). **Subtitle:** How AI agents work.
- **Ask from Sam:** start from Meeting 3's context window, show how a chat session with good context grows into an agent with a clear job, then build up from one agent to a team with a boss, helpers, and check loops. Hands-on, beginner friendly, clearly labeled.
- **Running example (deck and lab use the same one):** a team that makes a game night kit. Event Lead (the boss) gives jobs to a Flyer Writer, a Caption Writer, and a Snack Planner. A Flyer Checker sends the flyer back until it passes its checklist.

## Slide plan

What each slide is for, the shared words, and the design bar: `plan.md`. The lab's contract: `lab/SPEC.md`. This table tracks each slide's state.

| # | id | Slide | Time | State |
|---|---|---|---|---|
| 1 | cover | Under the Hood · How AI agents work · Wed, Oct 28 · 2-3pm · CIS A-204 | 2:00 | v1 |
| 2 | signin | Title + sign-in QR (routine) | 2:01 | v1 (QR reused from Meeting 5, decoded) |
| 3 | shares | explorAI Shares: one verified agents news item, with source | 2:04 | v1 frame, item pending (visible "Item pending" line; D2 fills it from the facts file) |
| 4 | hook | A finished game night flyer. Guess how many AIs made it, then reveal the team, messages, and check rounds (numbers from a real lab run) | 2:07 | v1: sample flyer + team of 5; message and round counts pending the recorded run |
| 5 | part1 | Part 1 · From chat to agent | 2:10 | v1 |
| 6 | recall-chat | Meeting 3's group chat: part of the picture vs. everything | 2:10 | v1 (Meeting 3's phone and chat) |
| 7 | recall-window | The context window card, filled layer by layer. "It can't read what you didn't put in the window." | 2:12 | v1 |
| 8 | session | A chat session is a window you keep filling, one turn at a time | 2:13 | v1 (3 turns + "sent this turn" box: 1, 3, 5 messages) |
| 9 | pin | Write the instructions once: you fill the "instructions from the app" slot yourself | 2:15 | v1 |
| 10 | agent | Agent = model + instructions + tools + a loop + "done when". The session card turns into an agent card, one labeled piece per press | 2:16 | v1 (static card, one row per press) |
| 11 | loop | The loop: think, do, check, again or done (flyer example, round counter) | 2:18 | v1 (step list + round counter) |
| 12 | part2 | Part 2 · Build one agent | 2:20 | v1 |
| 13 | setup | Open the lab (QR), get a free Gemini key or use practice mode | 2:20 | v1 (lab QR decoded; key steps to check against the facts file in D2) |
| 14 | build1 | Build 1: one agent, one job | 2:22 | v1, timer 3:00; lab picture follows SPEC, match to the real lab in I1 |
| 15 | structure | Give it structure: Role, Goal, Steps, Rules, Output, Done when, and the window they fill | 2:26 | v1 |
| 16 | build2 | Build 2: add structure, run again, compare | 2:28 | v1, timer 5:00 |
| 17 | part3 | Part 3 · Build a team | 2:33 | v1 |
| 18 | team | Who's in charge: jobs go down, reports come up, the boss makes the final call | 2:33 | v1 (static tree, flow chips one per press) |
| 19 | texting | What the agents say to each other (Meeting 3 style group chat) | 2:36 | v1: bubbles name each message's kind; real text pending the recorded run |
| 20 | checkloop | "Done when": a checklist that sends work back, with a round limit | 2:38 | v1: marks follow plan.md's example; match to the recorded run in I1 |
| 21 | build3 | Build 3: make a team and add a checker | 2:40 | v1, timer 10:00 |
| 22 | wrong | When agents go wrong: Meeting 4's police tip, and the limits that prevent it | 2:50 | v1 (Meeting 4's wording and sources) |
| 23 | takeaway | One thing to remember | 2:54 | v1 |
| 24 | thanks | Thank you, next week card, Instagram + Discord QRs | 2:56 | v1 ("Topic coming soon"; QRs reused from Meeting 5, decoded) |

## Agent lab (the hands-on demo)

- **Where:** `meetings/meeting-6/lab/`, live at `https://pcolee.github.io/explorAI/meetings/meeting-6/lab/` once pushed. Status and how it works: `meetings/meeting-6/lab/README.md` (written by the lab track).
- **Stack:** one static page, no build step and no server. It calls the Gemini API straight from the browser with the student's own free key from Google AI Studio. Practice mode runs the same steps with prewritten replies, so the demo works with no key and no Wi-Fi. (Sam's 2025 demo used FastAPI + Next.js + a database; this keeps its ideas, an agent tree with a boss and helpers, with fewer parts that can break.)
- **Levels, matching the deck's parts:** 1 One agent · 2 Give it structure · 3 Build a team · 4 Add a check loop.
- **Key handling:** the key stays in that browser tab (optional "remember on this device"), is sent only to Google's API, and is never in a share link.
- **Lab state:** L1a done (engine, presets, 24 engine tests green). Next: L1b the page and practice mode, then L1c Gemini mode, then L1d the recorded Game Night run. Details: `lab/README.md`.
- **Game Night preset (matches the deck):** Event Lead gives jobs to Flyer Writer, Caption Writer, and Snack Planner; Flyer Checker grades the flyer on "Has the day, time, and room", "Under 40 words", "Ends with one clear thing to do", max 3 rounds. Event: this Friday, 5 to 7 pm, CIS A-204 (same as the deck's sample).

## Decisions made overnight

- Title stays "Under the Hood" with the subtitle "How AI agents work", so Meeting 5's thanks slide still matches. (Sam's agents, 2026-10-27)
- Lab is a static page with bring-your-own Gemini key plus practice mode, chosen for reliability tomorrow. (Sam, 2026-10-27)
- Deck back key undoes one press at a time (hides the last reveal on the slide, and only leaves the slide when nothing is revealed), as plan.md asks. Meeting 5's back jumped to the previous slide fully built. (Sam's agents, 2026-10-27)
- The hook flyer and the steering example on slides 8, 9, and 11 use a sample event (Friday, 5-7pm, CIS A-204). Integration (I1) swaps the hook's flyer for the recorded run's flyer; the teaching examples can keep the sample. (Sam's agents, 2026-10-27)
- Lab: each preset grows with the levels (1 one agent with a name and job, 2 the same agent with all six parts, 3 a lead with three helpers, 4 plus a checker). Until a student edits the team, switching levels loads that level's version; after an edit, switching levels keeps the student's team. (Sam's agents, lab track, 2026-10-27)
- Lab: the checker's message includes the word count the page counted, so "Under 40 words" is graded on a real count rather than the model's guess. (Sam's agents, lab track, 2026-10-27)
- Shares slide stays in v1 as a frame with a visible "Item pending" line, so D2 can fill it from the facts file. If it is still pending at 13:00, cut it, per plan.md. (Sam's agents, 2026-10-27)

## Needs a person before 14:00

- Cole: OK the topic, or say what "Under the Hood" was meant to cover.
- Cole or Sam: next week's (2026-11-04) topic for the thanks slide.
- Speakers: assign who covers which part (`A` in the deck, or `?view=review`).
- Presenter: make a Gemini key in AI Studio before the meeting and test one team run in the lab on the room's Wi-Fi.
- Pending the recorded lab run (`lab/examples/game-night-run.json`): the hook's message and round counts, the texting slide's real messages, and the checkloop marks. Until then those slides show plan.md's wording and say "pending" where a number would go.

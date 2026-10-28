# Meeting 6 build board

Live board for the Meeting 6 deck and agent lab while Sam's agents build them overnight (2026-10-27 to 2026-10-28). It is rewritten in place and pushed with every milestone, so the top of this file is always the current state. History goes in commit messages and `docs/agent-log.md`.

**Last update:** 2026-10-27 23:05 PDT · **Phase:** kickoff · **Next push:** deck v1 (all slides, content in place)

## If you are Cole's agent, read this first

1. Pull (the hooks do it) and read **Working now** below before you edit anything in `meetings/meeting-6/`.
2. To ask Sam's agents for a change, press `A` on the deck and leave a note (they read `node scripts/review.mjs inbox meetings/meeting-6/index.html` before every commit), or add a line under **Requests** below and push.
3. Your edits win. Sam's agents pull before every commit and never overwrite or revert your changes. If you are already drafting a Meeting 6 deck somewhere else, push it or add a line under **Requests** first, so the two drafts don't collide.
4. Sam's agents stop pushing to `meetings/meeting-6/` at 13:30 on 2026-10-28 (meeting starts at 14:00).

## Working now

| What | Files | Who | Since |
|---|---|---|---|
| Deck v1 | `meetings/meeting-6/index.html`, `notes.html` | Sam's agents (deck track) | 2026-10-27 23:05 |
| Agent lab | `meetings/meeting-6/lab/` | Sam's agents (lab track) | 2026-10-27 23:05 |
| Docs | this file, Meeting 6 row in `docs/status.md`, Sam's entry in `docs/agent-log.md` | Sam's agents | 2026-10-27 23:05 |

## Requests

Add a line here (or a note with `A` on the deck). Sam's agents answer under it.

- (none yet)

## What this meeting is

- **Title:** Under the Hood (the name Cole set and Meeting 5's thanks slide shows). **Subtitle:** How AI agents work.
- **Ask from Sam:** start from Meeting 3's context window, show how a chat session with good context grows into an agent with a clear job, then build up from one agent to a team with a boss, helpers, and check loops. Hands-on, beginner friendly, clearly labeled.
- **Running example (deck and lab use the same one):** a team that makes a game night kit. Event Lead (the boss) gives jobs to a Flyer Writer, a Caption Writer, and a Snack Planner. A Flyer Checker sends the flyer back until it passes its checklist.

## Slide plan

Draft from Sam's brief. Sam's agents refine it while building; this table tracks each slide's state.

| # | id | Slide | Time | State |
|---|---|---|---|---|
| 1 | cover | Under the Hood · How AI agents work · Wed, Oct 28 · 2-3pm · CIS A-204 | 2:00 | planned |
| 2 | signin | Title + sign-in QR (routine) | 2:01 | planned |
| 3 | shares | explorAI Shares: one verified agents news item, with source | 2:04 | planned |
| 4 | hook | A finished game night flyer. Guess how many AIs made it, then reveal the team, messages, and check rounds (numbers from a real lab run) | 2:07 | planned |
| 5 | part1 | Part 1 · From chat to agent | 2:10 | planned |
| 6 | recall-chat | Meeting 3's group chat: part of the picture vs. everything | 2:10 | planned |
| 7 | recall-window | The context window card, filled layer by layer. "It can't read what you didn't put in the window." | 2:12 | planned |
| 8 | session | A chat session is a window you keep filling, one turn at a time | 2:13 | planned |
| 9 | pin | Write the instructions once: you fill the "instructions from the app" slot yourself | 2:15 | planned |
| 10 | agent | Agent = model + instructions + tools + a loop + "done when". The session card turns into an agent card, one labeled piece per press | 2:16 | planned |
| 11 | loop | The loop: think, do, check, again or done (flyer example, round counter) | 2:18 | planned |
| 12 | part2 | Part 2 · Build one agent | 2:20 | planned |
| 13 | setup | Open the lab (QR), get a free Gemini key or use practice mode | 2:20 | planned |
| 14 | build1 | Build 1: one agent, one job | 2:22 | planned |
| 15 | structure | Give it structure: Role, Goal, Steps, Rules, Output, Done when, and the window they fill | 2:26 | planned |
| 16 | build2 | Build 2: add structure, run again, compare | 2:28 | planned |
| 17 | part3 | Part 3 · Build a team | 2:33 | planned |
| 18 | team | Who's in charge: jobs go down, reports come up, the boss makes the final call | 2:33 | planned |
| 19 | texting | What the agents say to each other (Meeting 3 style group chat) | 2:36 | planned |
| 20 | checkloop | "Done when": a checklist that sends work back, with a round limit | 2:38 | planned |
| 21 | build3 | Build 3: make a team and add a checker | 2:40 | planned |
| 22 | wrong | When agents go wrong: Meeting 4's police tip, and the limits that prevent it | 2:50 | planned |
| 23 | takeaway | One thing to remember | 2:54 | planned |
| 24 | thanks | Thank you, next week card, Instagram + Discord QRs | 2:56 | planned |

## Agent lab (the hands-on demo)

- **Where:** `meetings/meeting-6/lab/`, live at `https://pcolee.github.io/explorAI/meetings/meeting-6/lab/` once pushed. Status and how it works: `meetings/meeting-6/lab/README.md` (written by the lab track).
- **Stack:** one static page, no build step and no server. It calls the Gemini API straight from the browser with the student's own free key from Google AI Studio. Practice mode runs the same steps with prewritten replies, so the demo works with no key and no Wi-Fi. (Sam's 2025 demo used FastAPI + Next.js + a database; this keeps its ideas, an agent tree with a boss and helpers, with fewer parts that can break.)
- **Levels, matching the deck's parts:** 1 One agent · 2 Give it structure · 3 Build a team · 4 Add a check loop.
- **Key handling:** the key stays in that browser tab (optional "remember on this device"), is sent only to Google's API, and is never in a share link.

## Decisions made overnight

- Title stays "Under the Hood" with the subtitle "How AI agents work", so Meeting 5's thanks slide still matches. (Sam's agents, 2026-10-27)
- Lab is a static page with bring-your-own Gemini key plus practice mode, chosen for reliability tomorrow. (Sam, 2026-10-27)

## Needs a person before 14:00

- Cole: OK the topic, or say what "Under the Hood" was meant to cover.
- Cole or Sam: next week's (2026-11-04) topic for the thanks slide.
- Speakers: assign who covers which part (`A` in the deck, or `?view=review`).
- Presenter: make a Gemini key in AI Studio before the meeting and test one team run in the lab on the room's Wi-Fi.

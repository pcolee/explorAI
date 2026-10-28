# Meeting 6 build board

Live board for the Meeting 6 deck and agent lab while Sam's agents build them overnight (2026-10-27 to 2026-10-28). It is rewritten in place and pushed with every milestone, so the top of this file is always the current state. History goes in commit messages and `docs/agent-log.md`.

**Last update:** 2026-10-28 00:05 PDT · **Phase:** deck D2 in progress: all 11 bespoke modules polished (slides 4, 6 to 11, 15, 18 to 20); lab L1b live (page + practice mode) · **Next push:** deck D2 last part (Shares item with QR, setup slide's key and age lines, lab pictures matched to the real lab, full walks); lab L1c (Gemini mode)

Deck v1: https://pcolee.github.io/explorAI/meetings/meeting-6/ · notes: https://pcolee.github.io/explorAI/meetings/meeting-6/notes.html

## If you are Cole's agent, read this first

1. Pull (the hooks do it) and read **Working now** below before you edit anything in `meetings/meeting-6/`.
2. To ask Sam's agents for a change, press `A` on the deck and leave a note (they read `node scripts/review.mjs inbox meetings/meeting-6/index.html` before every commit), or add a line under **Requests** below and push.
3. Your edits win. Sam's agents pull before every commit and never overwrite or revert your changes. If you are already drafting a Meeting 6 deck somewhere else, push it or add a line under **Requests** first, so the two drafts don't collide.
4. Sam's agents stop pushing to `meetings/meeting-6/` at 13:30 on 2026-10-28 (meeting starts at 14:00).

## Working now

| What | Files | Who | Since |
|---|---|---|---|
| Deck D2: bespoke modules done; next: Shares, setup, lab pictures, full walks | `meetings/meeting-6/index.html`, `notes.html`, `plan.md` | Sam's agents (deck track) | 2026-10-27 23:25 |
| Agent lab L1c (next): Gemini mode | `meetings/meeting-6/lab/` | Sam's agents (lab track) | L1b page pushed 2026-10-27 23:55 |
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
| 4 | hook | A finished game night flyer. Guess how many AIs made it, then reveal the team, messages, and check rounds (numbers from a real lab run) | 2:07 | polished, 3 presses (flyer alone, then the guess, then the team of 5); sample flyer, no counts: integration pending the recorded run |
| 5 | part1 | Part 1 · From chat to agent | 2:10 | v1 |
| 6 | recall-chat | Meeting 3's group chat: part of the picture vs. everything | 2:10 | polished, 2 presses (Meeting 3's phone markup, last message then the whole chat) |
| 7 | recall-window | The context window card, filled layer by layer. "It can't read what you didn't put in the window." | 2:12 | polished, 6 presses (empty slots fill one layer per press; reply tokens appear one by one) |
| 8 | session | A chat session is a window you keep filling, one turn at a time | 2:13 | polished, 3 presses (meter: 1, 3, 5 messages; earlier messages flash as they are sent again) |
| 9 | pin | Write the instructions once: you fill the "instructions from the app" slot yourself | 2:15 | polished, 4 presses (the app's layer becomes "written by you") |
| 10 | agent | Agent = model + instructions + tools + a loop + "done when". The session card turns into an agent card, one labeled piece per press | 2:16 | polished, 5 presses (chat session card gains 4 pieces, then becomes the Flyer Writer agent card) |
| 11 | loop | The loop: think, do, check, again or done (flyer example, round counter) | 2:18 | polished, 6 presses (a spotlight moves around the think/do/check ring, round counter in the middle, log of both rounds, exits to Done; cap line) |
| 12 | part2 | Part 2 · Build one agent | 2:20 | v1 |
| 13 | setup | Open the lab (QR), get a free Gemini key or use practice mode | 2:20 | v1 (lab QR decoded; key steps to check against the facts file in D2) |
| 14 | build1 | Build 1: one agent, one job | 2:22 | v1, timer 3:00; lab picture follows SPEC, match to the real lab in I1 |
| 15 | structure | Give it structure: Role, Goal, Steps, Rules, Output, Done when, and the window they fill | 2:26 | polished, 7 presses (each part's name slides into the instructions slot, Meeting 3 recipe column, then the line) |
| 16 | build2 | Build 2: add structure, run again, compare | 2:28 | v1, timer 5:00 |
| 17 | part3 | Part 3 · Build a team | 2:33 | v1 |
| 18 | team | Who's in charge: jobs go down, reports come up, the boss makes the final call | 2:33 | polished, 4 presses (dots travel the tree lines: task down, jobs down, reports up, answer up; nodes ping on arrival; the rule in play glows) |
| 19 | texting | What the agents say to each other (Meeting 3 style group chat) | 2:36 | polished, 6 presses ("Game Night Team" chat on Meeting 3's phone, one message per press, kinds named on the left); worked example text, integration pending the recorded run |
| 20 | checkloop | "Done when": a checklist that sends work back, with a round limit | 2:38 | polished, 4 presses (draft above the checklist, marks stamp in, notes go back, round 2 draft passes, round dots 1 then 2 of 3); integration pending the recorded run |
| 21 | build3 | Build 3: make a team and add a checker | 2:40 | v1, timer 10:00 |
| 22 | wrong | When agents go wrong: Meeting 4's police tip, and the limits that prevent it | 2:50 | v1 (Meeting 4's wording and sources) |
| 23 | takeaway | One thing to remember | 2:54 | v1 |
| 24 | thanks | Thank you, next week card, Instagram + Discord QRs | 2:56 | v1 ("Topic coming soon"; QRs reused from Meeting 5, decoded) |

## Agent lab (the hands-on demo)

- **Where:** `meetings/meeting-6/lab/`, live at `https://pcolee.github.io/explorAI/meetings/meeting-6/lab/` once pushed. Status and how it works: `meetings/meeting-6/lab/README.md` (written by the lab track).
- **Stack:** one static page, no build step and no server. It calls the Gemini API straight from the browser with the student's own free key from Google AI Studio. Practice mode runs the same steps with prewritten replies, so the demo works with no key and no Wi-Fi. (Sam's 2025 demo used FastAPI + Next.js + a database; this keeps its ideas, an agent tree with a boss and helpers, with fewer parts that can break.)
- **Levels, matching the deck's parts:** 1 One agent · 2 Give it structure · 3 Build a team · 4 Add a check loop.
- **Key handling:** the key stays in that browser tab (optional "remember on this device"), is sent only to Google's API, and is never in a share link.
- **Lab state:** L1b done: the page is live and every level and preset runs in practice mode with the network off (checked with real clicks at 1440x900 and on a 390x844 phone, no console errors). Practice replies are labeled samples until L1d records a real run. Next: L1c Gemini mode, then L1d the recorded Game Night run. Details and how to present it: `lab/README.md`.
- **What the lab looks like (for the deck's lab pictures, I1):** top bar "ExplorAI · Meeting 6 / Agent Lab" with a mode chip ("Practice mode" or "Gemini · model") and "Add a Gemini key"; four level buttons (1 One agent, 2 Give it structure, 3 Build a team, 4 Add a check loop); "Your team" tree with role badges (Lead, Helper, Checker, Agent), solid arrows down to helpers, a dashed loop to the checker; the selected agent's card (Name, Look, Job, then "The six parts" and "What it sees"); the Task box with Run and Stop, and "Messages" as a group chat labeled like "Event Lead → Flyer Writer · job".
- **Game Night preset (matches the deck):** Event Lead gives jobs to Flyer Writer, Caption Writer, and Snack Planner; Flyer Checker grades the flyer on "Has the day, time, and room", "Under 40 words", "Ends with one clear thing to do", max 3 rounds. Event: this Friday, 5 to 7 pm, CIS A-204 (same as the deck's sample).

## Decisions made overnight

- Title stays "Under the Hood" with the subtitle "How AI agents work", so Meeting 5's thanks slide still matches. (Sam's agents, 2026-10-27)
- Lab is a static page with bring-your-own Gemini key plus practice mode, chosen for reliability tomorrow. (Sam, 2026-10-27)
- Deck back key undoes one press at a time (hides the last reveal on the slide, and only leaves the slide when nothing is revealed), as plan.md asks. Meeting 5's back jumped to the previous slide fully built. (Sam's agents, 2026-10-27)
- The hook flyer and the steering example on slides 8, 9, and 11 use a sample event (Friday, 5-7pm, CIS A-204). Integration (I1) swaps the hook's flyer for the recorded run's flyer; the teaching examples can keep the sample. (Sam's agents, 2026-10-27)
- Lab: each preset grows with the levels (1 one agent with a name and job, 2 the same agent with all six parts, 3 a lead with three helpers, 4 plus a checker). Until a student edits the team, switching levels loads that level's version; after an edit, switching levels keeps the student's team. (Sam's agents, lab track, 2026-10-27)
- Lab: the key dialog adds a third line, "Google's terms say you must be 18 or older to use the Gemini API. Under 18? Use practice mode." (the facts file quotes the terms; Cole or Sam can drop it). It also tells students to sign in with a personal Google account. (Sam's agents, lab track, 2026-10-27)
- Lab: practice mode replays a recorded run only when the team and task match it exactly; any edit gets labeled sample replies, so a student never sees old replies that ignore their change. (Sam's agents, lab track, 2026-10-27)
- Lab: the checker's message includes the word count the page counted, so "Under 40 words" is graded on a real count rather than the model's guess. (Sam's agents, lab track, 2026-10-27)
- Shares slide stays in v1 as a frame with a visible "Item pending" line, so D2 can fill it from the facts file. If it is still pending at 13:00, cut it, per plan.md. (Sam's agents, 2026-10-27)
- Deck steps: one press can now show several things at once (elements that share a `data-build-in` number), and each slide carries `data-step` so a module can move or change between presses. The presenter view's "Next press" labels follow the presses. Back still undoes exactly one press. (Sam's agents, deck D2, 2026-10-27)
- The loop (slide 11), the agents' group chat (19), and the checklist (20) share one example round: draft 1 is "Game Night is back! Join ExplorAI this Friday from 5 to 7pm ... RSVP in our Discord." (42 words, no room, so it fails two lines and passes the third, as plan.md's checklist says), and draft 2 is the hook's flyer text. I1 swaps in the recorded run's text where it differs. (Sam's agents, deck D2, 2026-10-27)
- The agents' group chat (19) shows a worked example in real message form (the lead's jobs, the draft, the checker's notes with "42 words", the fix, the pass, the lead's answer) instead of v1's placeholder bubbles; its notes say it is an example, not a recorded run. (Sam's agents, deck D2, 2026-10-28)
- plan.md and slide 18's notes now name the other terms as the facts file found them: Anthropic says orchestrator and workers, OpenAI says manager and specialists (v1 said "sub-agent"). (Sam's agents, deck D2, 2026-10-28)
- The hook shows no message or round counts until the recorded run exists (no visible "pending" line on screen); I1 adds them from `lab/examples/game-night-run.json`. (Sam's agents, deck D2, 2026-10-27)

## Needs a person before 14:00

- Cole: OK the topic, or say what "Under the Hood" was meant to cover.
- Cole or Sam: next week's (2026-11-04) topic for the thanks slide.
- Speakers: assign who covers which part (`A` in the deck, or `?view=review`).
- Presenter: make a Gemini key in AI Studio before the meeting and test one team run in the lab on the room's Wi-Fi.
- Pending the recorded lab run (`lab/examples/game-night-run.json`): the hook's message and round counts, the texting slide's real messages, and the checkloop marks. Until then those slides show plan.md's example wording and no counts (integration pending, stage I1).

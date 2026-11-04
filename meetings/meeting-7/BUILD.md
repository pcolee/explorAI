# Meeting 7 build board

Live board for the Meeting 7 deck. It is rewritten in place and pushed with every milestone, so the top of this file is always the current state. History goes in commit messages and `docs/agent-log.md`.

**Last update:** 2026-11-03 PST · **Phase:** V1 done. Deck (18 slides, with the Shares slide, slide 6's example, and the recap and phase-by-phase loop added 2026-11-03 evening and walked again: 50 presses each way, no overflow, no errors, the RSVP QR decoded) and notes (18 cards) are built from Cole's plan on Meeting 6's engine and look, and pushed. Checked in Chrome: 44 presses forward and 44 back with real keys (0 mismatches), every slide fully built with nothing past the slide edge, no console errors, T starts and pauses both timers, the hook's connector switch flips on press 3, all three QRs decoded (below), notes load with 16 cards in order. Next: Cole reviews (`A` on the deck), then the **Needs a person** list.

Deck: https://pcolee.github.io/explorAI/meetings/meeting-7/ · notes: https://pcolee.github.io/explorAI/meetings/meeting-7/notes.html

## If you are Sam's agent, read this first

1. Pull (the hooks do it) and read **Working now** below before you edit anything in `meetings/meeting-7/`.
2. This is Cole's meeting: Cole's plan (below) and Cole's edits win. To ask for a change, press `A` on the deck and leave a note, or add a line under **Requests** below and push.
3. Nobody pushes to `meetings/meeting-7/` during the meeting (Wed 2026-11-04, 2:00 to 3:00 pm) unless the presenter asks.
4. **Ask Cole before deleting the "Next week" pill** on the thanks slide (slide 18): always ask whether there is a new meeting topic for next week first, and act on the answer. Never remove it because no topic is written down yet. (Cole, 2026-11-03)

## Working now

| What | Files | Who | Since |
|---|---|---|---|
| Nobody. Cole's agent finished v1. | none | none | 2026-11-03 |

## Requests

Add a line here (or a note with `A` on the deck). Answers go under it.

- None yet.

## What this meeting is

Cole's plan is `meetings/meeting-7/content.md` (kept untracked, like Meetings 3, 5, and 6). What it says, so every agent has it:

- **Title:** Connecting AI to Your Apps. **Subtitle:** What MCP is and how to use it. **Date:** Wed, Nov 4 · 2–3pm · CIS A-204.
- **Audience:** beginners. Follows Meeting 6 (agents). **Format:** zero install. The main path uses claude.ai connectors; Claude Desktop with the filesystem server is an optional bonus.
- **Goal:** members understand what MCP is, see how it connects an agent to real apps, and connect at least one app themselves.
- **By the end, members can:** explain MCP in one sentence; connect an app to Claude and use it to answer a question; name one thing an agent should never do without asking first.
- **Definition (use these words):** MCP (Model Context Protocol) is one standard way for AI to connect to apps and tools.
- **Analogy:** MCP is like USB for AI. Before USB, every device needed its own cable. MCP gives every app the same plug, so any AI that supports it can use any app that supports it.
- **Three parts:** Host / client = the AI app you use (Claude, Cursor). Server = the connector for one app (Google Drive, GitHub, Notion). Tools = the actions the server offers (search files, read a doc, list events).
- **Tie back to Meeting 6:** an agent is a loop of think, act, observe, repeat. The act step is a tool call. An MCP server is a bundle of tools the agent can call in that loop. Tool results go into the agent's context, which is how it "knows" your calendar.
- **Point to land at the end:** more access means more useful, but also more risk. Good agents ask before taking actions that can't be undone.

## Slide plan

The plan's agenda (Hook 0–5, What MCP is 5–13, Live demo 13–20, Hands-on 20–40, Discussion 40–47, Wrap 47–50) placed after the routine's cover, sign-in, and Shares, starting at 2:07. All 18 slides are v1, checked in Chrome as described at the top.

| # | id | Slide | Time | State |
|---|---|---|---|---|
| 1 | cover | Connecting AI to Your Apps · What MCP is and how to use it · date, time, room · the three parts as small cards | 2:00 | v1 |
| 2 | signin | Title + sign-in QR (routine, QR reused from Meeting 6) | 2:01 | v1 |
| 3 | shares | explorAI Shares: Project Play's launch party (Fri, Nov 6, 6:00–8:30 PM, Angel City Business Lab) in Cole's words, a pink RSVP QR (`https://partiful.com/e/oQHpVqwzHjn5AMQldQeI`, the flyer's `#F32D62`), and Project Play's flyer (`project-play-flyer.jpg`). No presses | 2:04 | v1 |
| 4 | hook | Same question, twice: "What's on my calendar this week?" fails, the Google Calendar connector is turned on, then it answers. Picture of the live demo, 5 presses | 2:07 | v1 |
| 5 | part1 | Part 1 · What MCP is | 2:12 | v1 |
| 6 | define | The one-sentence definition, then Model, Context, Protocol one per press, then (press 4, Cole's request) a one-line Google Calendar example; n6 walks through how a Google Calendar connection works step by step | 2:12 | v1 |
| 7 | usb | USB for AI: a different cable for every pair, then one shared plug | 2:14 | v1 |
| 8 | parts | Host / client, Server, Tools, one per press | 2:16 | v1 |
| 9 | recap | Last week (Cole's request): "An agent is the same model with 4 more parts." Instructions, Tools, Loop, Done when in Meeting 6's words; 1 press lights Tools and Loop: "Today is about two of them: MCP gives an agent its tools, and the loop is how it uses them." | 2:18 | v1 |
| 10 | loop | The loop, one step at a time (Cole's request): Think, Act, Observe, Repeat, one per press, each with a plain description and a Google Calendar example (the hook's question); press 5: a server is a bundle of tools | 2:19 | v1 |
| 11 | part2 | Part 2 · Connect an app | 2:21 | v1 |
| 12 | demo | Live demo: connect Google Drive, ask for a doc in 3 bullets, point at search, read, answer | 2:21 | v1 |
| 13 | challenges | Hands-on: Levels 1, 2, 3 (bonus), 20:00 timer | 2:28 | v1 |
| 14 | part3 | Part 3 · Ask first | 2:48 | v1 |
| 15 | discuss | The four discussion questions, one per press, 7:00 timer; n15 has talking-point answers under each (Cole's request) | 2:48 | v1 |
| 16 | point | Fine to just do vs. ask first, then (press 3, Cole's request) "You're in control: you choose what it can reach: approve the least it needs, and you can disconnect it anytime.", then the point to land | 2:55 | v1 |
| 17 | takeaway | One thing to remember: MCP is one standard plug that lets AI use your apps | 2:57 | v1 |
| 18 | thanks | Thank you, next-meeting card "Next week · Nov 11 · Study Smarter with AI" (Cole), Instagram + Discord QRs (reused, decoded below) | 2:58 | v1 |

## Decisions made while building

- Shares (slide 3): Project Play's launch party, with Cole's description. Cole wrote "next Friday, Nov 6"; the slide says "this Friday, Nov 6", since Nov 6 is two days after the meeting. The RSVP QR is in the flyer's pink at Cole's request. Adding it moved every later slide 3 minutes (hook 2:07, hands-on 2:27 to 2:47, thanks 2:57); the plan's section lengths are unchanged. (Cole, 2026-11-03)
- The demo asks for "my doc about game night" so the slide shows a real prompt instead of "[topic]". Slide 12 shows it searching for "game night" and reading a doc named "Game Night Plan". The demo doc in Drive must match (see **Needs a person**), or change slide 12 and n12. The slide draws the answer as three grey lines, not made-up bullets. (Cole's agent, 2026-11-03)
- Look: Meeting 6's cozy washes, taped notes, part cards on the cover and part slides, and its deck engine (back undoes one press, timers keep their count). New modules: a chat window with a connector switch (4), the nine-cables vs. one-plug drawing (7), the three parts with arrows (8), Meeting 6's four parts as cards (9), Meeting 6's loop ring beside one row per phase (10). (Cole's agent, 2026-11-03)
- Slides 9 and 10 (Cole, 2026-11-03): a recap of Meeting 6 before the loop so it doesn't feel daunting, and the loop walked phase by phase with one description each. The loop now uses the hook's Google Calendar question instead of the earlier Drive search and context-window card (the window is in Observe's description). Every later slide moved 1 minute (hands-on 2:28 to 2:48, thanks 2:58).
- The hook's calendar answer on slide 4 is a labeled example ("Example calendar"), since the live answer comes from the presenter's own calendar. (Cole's agent, 2026-11-03)
- Slide 16's two lists (fine to just do / ask first) are an addition that serves the plan's third objective; Cole can drop them and keep only the point to land. (Cole's agent, 2026-11-03)

## Needs a person before 14:00

From Cole's prep checklist, in the order to do them:

1. Create the test Google account with sample docs and calendar events, and a demo doc in Drive named "Game Night Plan" (slide 12's prompt says "my doc about game night"). Share the test account's sign-in in person only, never in the repo.
2. Check whether claude.ai connectors (Google Drive, Google Calendar) work on a free plan. If not, the notes already say to pair members up; say so on slide 13 too.
3. Test the connector flow on a phone and a laptop, and confirm the menu path to Connectors in claude.ai settings (n12 says "Settings, then Connectors").
4. Test Claude Desktop + the filesystem server on Mac and Windows for Level 3.
5. Write the one-page setup guide with screenshots. When it exists, add its QR to slide 17 and the decoded URL to the log.
6. Done 2026-11-03: Cole set Meeting 8 (Nov 11) as "Study Smarter with AI" (building a study assistant; the title stays vague on purpose) and Meeting 9 (Nov 18) as "Lab: Automate One Boring Thing". The thanks slide's pill says "Next week · Nov 11 · Study Smarter with AI", and n18 says both.
7. Speakers: assign who covers which part (`A` in the deck, or `?view=review`).

## QR targets (reused from Meeting 6, decoded from the Meeting 7 deck in Chrome on 2026-11-03)

- Sign-in: `https://forms.gle/AAN5yiHXcajJvhAe8`
- Shares RSVP (new, pink): `https://partiful.com/e/oQHpVqwzHjn5AMQldQeI`
- Instagram: `https://www.instagram.com/explorai.rcc`
- Discord: `https://discord.gg/wymCa4EPj` (expires 2026-11-20 06:37 UTC, checked 2026-11-03; replace it before Meeting 9)

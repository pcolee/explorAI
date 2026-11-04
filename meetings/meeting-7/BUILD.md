# Meeting 7 build board

Live board for the Meeting 7 deck. It is rewritten in place and pushed with every milestone, so the top of this file is always the current state. History goes in commit messages and `docs/agent-log.md`.

**Last update:** 2026-11-03 PST · **Phase:** V1 done. Deck (17 slides, with the Shares slide added 2026-11-03 evening and walked again: 45 presses each way, no overflow, no errors, the RSVP QR decoded) and notes (17 cards) are built from Cole's plan on Meeting 6's engine and look, and pushed. Checked in Chrome: 44 presses forward and 44 back with real keys (0 mismatches), every slide fully built with nothing past the slide edge, no console errors, T starts and pauses both timers, the hook's connector switch flips on press 3, all three QRs decoded (below), notes load with 16 cards in order. Next: Cole reviews (`A` on the deck), then the **Needs a person** list.

Deck: https://pcolee.github.io/explorAI/meetings/meeting-7/ · notes: https://pcolee.github.io/explorAI/meetings/meeting-7/notes.html

## If you are Sam's agent, read this first

1. Pull (the hooks do it) and read **Working now** below before you edit anything in `meetings/meeting-7/`.
2. This is Cole's meeting: Cole's plan (below) and Cole's edits win. To ask for a change, press `A` on the deck and leave a note, or add a line under **Requests** below and push.
3. Nobody pushes to `meetings/meeting-7/` during the meeting (Wed 2026-11-04, 2:00 to 3:00 pm) unless the presenter asks.

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

The plan's agenda (Hook 0–5, What MCP is 5–13, Live demo 13–20, Hands-on 20–40, Discussion 40–47, Wrap 47–50) placed after the routine's cover, sign-in, and Shares, starting at 2:07. All 17 slides are v1, checked in Chrome as described at the top.

| # | id | Slide | Time | State |
|---|---|---|---|---|
| 1 | cover | Connecting AI to Your Apps · What MCP is and how to use it · date, time, room · the three parts as small cards | 2:00 | v1 |
| 2 | signin | Title + sign-in QR (routine, QR reused from Meeting 6) | 2:01 | v1 |
| 3 | shares | explorAI Shares: Project Play's launch party (Fri, Nov 6, 6:00–8:30 PM, Angel City Business Lab) in Cole's words, a pink RSVP QR (`https://partiful.com/e/oQHpVqwzHjn5AMQldQeI`, the flyer's `#F32D62`), and Project Play's flyer (`project-play-flyer.jpg`). No presses | 2:04 | v1 |
| 4 | hook | Same question, twice: "What's on my calendar this week?" fails, the Google Calendar connector is turned on, then it answers. Picture of the live demo, 5 presses | 2:07 | v1 |
| 5 | part1 | Part 1 · What MCP is | 2:12 | v1 |
| 6 | define | The one-sentence definition, then Model, Context, Protocol one per press | 2:12 | v1 |
| 7 | usb | USB for AI: a different cable for every pair, then one shared plug | 2:14 | v1 |
| 8 | parts | Host / client, Server, Tools, one per press | 2:16 | v1 |
| 9 | loop | Meeting 6's loop: act is a tool call, the result goes into the context window, a server is a bundle of tools | 2:18 | v1 |
| 10 | part2 | Part 2 · Connect an app | 2:20 | v1 |
| 11 | demo | Live demo: connect Google Drive, ask for a doc in 3 bullets, point at search, read, answer | 2:20 | v1 |
| 12 | challenges | Hands-on: Levels 1, 2, 3 (bonus), 20:00 timer | 2:27 | v1 |
| 13 | part3 | Part 3 · Ask first | 2:47 | v1 |
| 14 | discuss | The four discussion questions, one per press, 7:00 timer | 2:47 | v1 |
| 15 | point | Fine to just do vs. ask first, then the point to land | 2:54 | v1 |
| 16 | takeaway | One thing to remember: MCP is one standard plug that lets AI use your apps | 2:56 | v1 |
| 17 | thanks | Thank you, next-meeting card, Instagram + Discord QRs (reused, decoded below) | 2:57 | v1 |

## Decisions made while building

- Shares (slide 3): Project Play's launch party, with Cole's description. Cole wrote "next Friday, Nov 6"; the slide says "this Friday, Nov 6", since Nov 6 is two days after the meeting. The RSVP QR is in the flyer's pink at Cole's request. Adding it moved every later slide 3 minutes (hook 2:07, hands-on 2:27 to 2:47, thanks 2:57); the plan's section lengths are unchanged. (Cole, 2026-11-03)
- The demo asks for "my doc about game night" so the slide shows a real prompt instead of "[topic]". Slide 11 shows it reading a doc named "Game Night Plan", and slide 9's tool call searches "game night". The demo doc in Drive must match (see **Needs a person**), or change slides 9 and 11 and n9, n11. The slide draws the answer as three grey lines, not made-up bullets. (Cole's agent, 2026-11-03)
- Look: Meeting 6's cozy washes, taped notes, part cards on the cover and part slides, and its deck engine (back undoes one press, timers keep their count). New modules: a chat window with a connector switch (4), the nine-cables vs. one-plug drawing (7), the three parts with arrows (8), Meeting 6's loop ring beside Meeting 3's context window (9). (Cole's agent, 2026-11-03)
- The hook's calendar answer on slide 4 is a labeled example ("Example calendar"), since the live answer comes from the presenter's own calendar. (Cole's agent, 2026-11-03)
- Slide 15's two lists (fine to just do / ask first) are an addition that serves the plan's third objective; Cole can drop them and keep only the point to land. (Cole's agent, 2026-11-03)

## Needs a person before 14:00

From Cole's prep checklist, in the order to do them:

1. Create the test Google account with sample docs and calendar events, and a demo doc in Drive named "Game Night Plan" (slide 11's prompt says "my doc about game night"). Share the test account's sign-in in person only, never in the repo.
2. Check whether claude.ai connectors (Google Drive, Google Calendar) work on a free plan. If not, the notes already say to pair members up; say so on slide 12 too.
3. Test the connector flow on a phone and a laptop, and confirm the menu path to Connectors in claude.ai settings (n11 says "Settings, then Connectors").
4. Test Claude Desktop + the filesystem server on Mac and Windows for Level 3.
5. Write the one-page setup guide with screenshots. When it exists, add its QR to slide 16 and the decoded URL to the log.
6. Confirm the next meeting date for the thanks slide: it says "Next week · Nov 11", and Nov 11 is Veterans Day. Also the topic (it says "Topic coming soon").
7. Speakers: assign who covers which part (`A` in the deck, or `?view=review`).

## QR targets (reused from Meeting 6, decoded from the Meeting 7 deck in Chrome on 2026-11-03)

- Sign-in: `https://forms.gle/AAN5yiHXcajJvhAe8`
- Shares RSVP (new, pink): `https://partiful.com/e/oQHpVqwzHjn5AMQldQeI`
- Instagram: `https://www.instagram.com/explorai.rcc`
- Discord: `https://discord.gg/wymCa4EPj` (expires 2026-11-20 06:37 UTC, checked 2026-11-03; replace it before Meeting 9)

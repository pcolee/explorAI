# Meeting 8 build board

Live board for the Meeting 8 deck. Rewritten in place; history goes in commit messages and `docs/agent-log.md`.

**Last update:** 2026-11-17 PST · **Phase:** v1 done. Deck (10 slides), notes (10 cards), and the student build sheet (`build.html`) built from Cole's plan on Meeting 7's engine and look. Checked in Chrome: 20 presses forward and 20 back with real keys (back to slide 1, step 0), every slide fully built at least 96px inside the stage edges, T runs the build timer, no console errors, notes load with 11 cards, the build sheet has no sideways scroll at 390px. Next: Cole reviews (`A` on the deck), then **Needs a person**.

Deck: https://pcolee.github.io/explorAI/meetings/meeting-8/ · notes: https://pcolee.github.io/explorAI/meetings/meeting-8/notes.html · build sheet: https://pcolee.github.io/explorAI/meetings/meeting-8/build.html

## If you are Sam's agent, read this first

1. This is Cole's meeting: Cole's plan and Cole's edits win. To ask for a change, press `A` on the deck or add a line under **Requests** and push.
2. Nobody pushes to `meetings/meeting-8/` during the meeting (Wed 2026-11-18, 2:00 to 2:50 pm) unless the presenter asks.

## Working now

| What | Files | Who | Since |
|---|---|---|---|
| Nobody. Cole's agent finished v1. | none | none | 2026-11-17 |

## Requests

- None yet.

## What this meeting is

Cole's plan is `meetings/meeting-8/content.md` (untracked, like Meetings 3, 5, 6, 7). In short:

- **Finals Toolkit Lab**, the semester capstone. Wed, Nov 18 · 2:00–2:50 · CIS A-204. It moved from Nov 11 (no school on Veterans Day), so the Veterans Day Shares idea is dropped.
- Every member builds one tool they'll use during finals week in **Google AI Studio (Build) with Gemini**, stacking the semester: context (M3), vibe coding (M5), agents (M6), connecting apps (M7, optional).
- **Demo (Cole, 2026-11-17):** members already know how to build, so the demo shows what to do with a finished app: use it, find it (`aistudio.google.com/apps`), share it, publish it (free `.ai.studio` URL). Steps and the 2-app free tier are from Google's "Deploying from Google AI Studio" docs, checked 2026-11-17.
- **Shares:** the Cybersecurity Open House, Mon Nov 30, 6–8 PM, BLCIS A-114A/B. Volunteers: message us on Discord or find Cole outside after the meeting (no form, Cole).
- **Close (Cole):** ask the room what to do for the last meeting of the semester, after Thanksgiving break (dinner, café social, …). Sign-in slide at the start and the end (Cole, standing rule).

## Slide plan

| # | id | Slide | Time |
|---|---|---|---|
| 1 | cover | Finals Toolkit Lab, three part cards (use and publish, build time, show and tell) | 2:00 |
| 2 | signin | Sign-in QR | 2:01 |
| 3 | recap | The semester's four skills, one per press, then "today you build a tool" (5 presses) | 2:02 |
| 4 | shares | Cybersecurity Open House: details, blue registration QR, volunteer ask, the flyer (`open-house-flyer.jpg`) | 2:03 |
| 5 | demo | Use it, find it, share it, publish it (press 4 swaps the address bar to the public link), sticky: 2 free apps, personal Gmail (5 presses) | 2:08 |
| 6 | ideas | Five starters and the build sheet QR | 2:13 |
| 7 | build | 26:00 timer, Round 1 Build 10 / Round 2 Fix 10 / Round 3 Keep it 6, build sheet QR | 2:14 |
| 8 | show | Show and tell, 2:00 per person (T restarts) | 2:40 |
| 9 | last | What should we do to end the semester? | 2:47 |
| 10 | thanks | Sign-in QR (green, "Did you sign in?"), Instagram + Discord QRs (accent pink), open house "wanna help out?" card, last-meeting card (Cole, 2026-11-17: end sign-in moved onto the thanks slide) | 2:49 |

## Decisions made while building (Cole's agent)

- The build sheet keeps Cole's five prompts. Changes: the mock exam pastes a study guide instead of "upload"; the focus station's "connect Spotify" became a button that opens a pasted playlist link, since a Build app can't sign in to Spotify on its own. Added: a context-first step, a "publishing makes it public" warning, six fix-it prompts, the Keep it steps, and a sample syllabus, notes, and finals schedule (made up, labeled Sample).
- The flyer's registration QR is redrawn larger in the flyer's blue so the room can scan it (same URL, decoded below).

## Needs a person before 14:00

1. Build the grade calculator ahead of time in AI Studio on a personal Gmail (build sheet prompt + sample syllabus). Don't publish it before the demo.
2. Check the Share option's location in AI Studio and that Publish shows "Continue with free URL" on that account (n5 assumes the docs' labels).
3. Test the four starter prompts in AI Studio.

## QR targets (decoded 2026-11-17)

- Sign-in (reused): `https://forms.gle/AAN5yiHXcajJvhAe8`
- Open house registration (new, blue, from the flyer): `https://forms.cloud.microsoft/r/ZL9NATLGSV?origin=QRCode`
- Build sheet (new): `https://pcolee.github.io/explorAI/meetings/meeting-8/build.html`
- Instagram (reused): `https://www.instagram.com/explorai.rcc`
- Discord (new invite): `https://discord.gg/NGS8BuwnF`, expires 2026-12-18 04:29 UTC

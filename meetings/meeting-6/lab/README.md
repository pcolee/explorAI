# Agent Lab (Meeting 6)

Students build one agent, give it structure, then grow it into a team with a lead, helpers, and a checker that sends work back. The contract is `SPEC.md`; this file says where the build stands.

Live: `https://pcolee.github.io/explorAI/meetings/meeting-6/lab/`

## Status

| Part | State |
|---|---|
| L1a engine, presets, engine tests | Done: `engine.js`, `presets.js`, `tests/engine.test.mjs` |
| L1b page and practice mode | Done: `index.html`, `ui.js`, `practice.js`. Checked in headless Chrome with the network off, real clicks and typing, at 1440x900 and 390x844: all four levels, all three presets, tree tools, Stop, Reset and Undo, share link, reload. No console errors. |
| L1c Gemini mode | Done: `gemini.js`, `tests/gemini.test.mjs` (fake fetch), `tests/live.mjs` (real API, passing 2026-10-28). One browser run of each level with a real key, plus a fake key in the dialog and on Run. |
| L1d recorded Game Night run | Done: `examples/game-night-run.json`, recorded 2026-10-27 23:59 PDT with gemini-3.5-flash-lite. Practice mode replays it for the Game Night preset at level 4. |
| L2 review fixes | Done 2026-10-28 00:50 PDT: every finding from the two lab reviews (2 high, 10 med, 14 low). Real recorded Game Night runs added for levels 1 to 3 (`examples/game-night-l1.json`, `-l2`, `-l3`). 64 node tests pass, `tests/live.mjs` passes. Checked in headless Chrome with real clicks: practice mode with the network off at 1440x900, 1920x1080, and 390x844 (all four levels replay real runs, rerun scrolls into view, Stop, Remove and Undo, Clear, key dialog), and Gemini mode against a faked API (Stop while connecting, bad key, a 429 wait, a 500 on one agent, a broken share link). |

## The recorded run (numbers for the deck)

`examples/game-night-run.json`, Game Night preset, level 4, default task. Every reply is the model's text as it came back (`tests/record.mjs` saves it; nothing was edited).

- 5 agents, 10 model calls, 9.4 seconds.
- 12 messages between agents (15 counting your task, Event Lead's plan note, and the final answer to you).
- 3 check rounds, 2 send-backs. Flyer Writer's first draft was 51 words and ended with two things to do (fail, fail). The second was exactly 40 words (fail: 40 is not under 40). The third was 38 words and passed all three lines.
- The flyer that passed: "This Friday, 5 to 7 pm, in CIS A-204, join our game night! Play Codenames, Catan, Uno, and Jenga to win a prize. All games are provided, admission is free, and beginners are welcome. RSVP in our Discord."

The Game Night preset was tuned so a send-back is likely and honest: the Flyer Writer's own rules ask for full sentences and every game by name, which pull against its "Under 40 words" line, and the Flyer Checker's rules say two actions fail "Ends with one clear thing to do". With those settings the flyer was sent back in each of the 3 live runs after the change (the recording, `tests/live.mjs`, and the browser run); before them it was sent back in 2 of 14. If you change any Game Night text, practice mode stops replaying the recording (it falls back to labeled samples) and `tests/recording.test.mjs` fails; re-record with `tests/record.mjs`.

### Levels 1 to 3 (recorded 2026-10-28 00:29 PDT, gemini-3.5-flash-lite)

- Level 1 (name and job only): a 101-word flyer with a headline, emoji, and lines the task never gave, such as a 20-sided die and "Grab a snack". This is the guessing that Build 1 talks about.
- Level 2 (all six parts): "ExplorAI Board Game Night is this Friday from 5 to 7 pm in CIS A-204. It will be fun because all games are provided and beginners are welcome. Bring a friend." (31 words.)
- Level 3 (Event Lead and three helpers): 5 model calls, 6 messages between agents, 4.6 s; the final kit has a flyer, a caption, and a snack list that totals $26.00.

## How to present it

1. Open the live URL on the projector and zoom the browser to 150% (Cmd and +) so the text reads from the back. It starts in practice mode with the Game Night preset at level 1, so it works with no key and no Wi-Fi once the page has loaded.
2. Levels match the deck: 1 One agent (Build 1), 2 Give it structure (Build 2), 3 Build a team, 4 Add a check loop (Build 3). Students can open any level at any time.
3. Until a student edits the team, each level loads the preset's version for that level. After an edit, switching levels keeps their team, and a "Load Game Night for level N" button brings the example back. Reset, the example buttons, and Remove each offer Undo for 8 seconds.
4. Press Run. Messages show as a group chat: who sent what to whom, check results as a checklist with a round badge, and the final answer in its own card with Copy. A new run scrolls into view and the list follows it; scroll up to read and it stops following. On a phone, a floating Run button shows when the real one is off screen.
5. In practice mode, Game Night replays a real recorded run at every level (the line under "Run N" says so), so Build 1 and Build 2 compare two real flyers. Any edit to the team or task gets sample replies that say they are samples.
6. "What it sees" (level 2 and up) shows the exact instructions the model gets, then the chat so far and the new message, like Meeting 3's context window. After a run it shows what that agent saw on its last call.
7. For Gemini mode, press "Add a Gemini key", follow the three steps, and press "Check key and use Gemini". The key check lists the models the key can use and makes one tiny call. If the Wi-Fi or Gemini fails, every error card has a "Switch to practice mode" button.

## How it works

- `engine.js` is pure logic. `runTeam(team, task, { adapter, limits, signal, onEvent })` starts at the top agent. A lead makes a JSON plan (helper names limited to its own helpers), its helpers run (at most 2 model calls at once), and the lead combines their reports. A checker grades the work against the agent's "Done when" lines; the engine decides pass or fail from every line, and a fail sends the notes back for a new version, up to the round limit.
- Each agent keeps its own conversation for the whole run, so a revision sees its first draft and the checker's notes.
- Limits per run: 24 model calls, 8 agents, 3 levels, 4 helpers per lead, 3 check rounds. Hitting one ends the run with a message that names it (the round limit lets the run go on with the last version). The team also needs one agent at the top and a different name for each agent.
- The checker's message includes the word count the page counted, so a word limit is graded on a real count.
- `gemini.js` calls `generateContent` on `v1beta` with the key in the `x-goog-api-key` header (never in a URL). Models, best first: gemini-3.5-flash-lite, gemini-3.1-flash-lite, gemini-3.6-flash, gemini-3.8-flash, gemini-flash-lite-latest (the key check keeps the ones the key lists). Thinking is set to the lowest level each model takes (MINIMAL, or LOW on 3.8-flash). Plans and checks use `responseJsonSchema`.
- Pacing: at most 2 requests at once, 0.7 s apart, and 15 per minute (a guess: Google shows free-tier limits only inside AI Studio). A 429 waits the delay Google gives and shows "waiting Ns for Google's free limit" in the thread; a 429 that names the per-minute limit lowers the pace to it (a bare 429 only waits); a daily-limit 429 or a missing model moves to the next model and says so. Network errors and 5xx retry with backoff (3 tries), each request times out at 45 seconds (one retry), and a 400 on an optional setting retries without it (the setting the message names first) and remembers that only once the retry works. A reply cut off at the length cap retries once with twice the room when it is empty or is JSON (a plan or a check); the check budget grows with the number of Done when lines. If a request fails for good, the agent it hit shows "Error" on the tree and the alert names it. Bad key, API turned off, leaked key, blocked region, and daily quota each get a plain message that ends with "or switch to practice mode".
- `practice.js` replays a recorded real run (`examples/`, one per Game Night level) only when the team and task match it exactly (every agent's instructions, its lead, its checker, and the task). Anything else gets sample replies that say they are samples and list which of the six parts the agent was given, so level 1 and level 2 still differ. Samples fail the first check line in round 1 and pass in round 2.
- `ui.js` renders everything with text nodes. Model text goes through a small formatter that builds DOM nodes for paragraphs, lists, headings, and bold; nothing uses `innerHTML`.
- Saved in this browser: the team, level, and task (`localStorage` key `m6-lab-team`). The key: `sessionStorage` key `m6-lab-key`, plus `localStorage` only if "Remember on this device" is ticked. "Forget key" clears both. "Copy link to this team" puts the team, level, and task in the URL hash (never the key); opening the link loads the team and clears the hash. A team too long for a link (over 40,000 characters) gets a message instead of a link, and a link that can't be read says so and opens the saved team.

## Run the tests

From the repo root:

    node --test meetings/meeting-6/lab/tests/*.test.mjs
    GEMINI_API_KEY=... node meetings/meeting-6/lab/tests/live.mjs
    GEMINI_API_KEY=... node meetings/meeting-6/lab/tests/record.mjs game-night 4 --dry

(Node 22 reads a bare folder name after `--test` as a file, so give the glob.) No packages to install. `package.json` here only marks the files as ES modules for Node. `live.mjs` makes about 15 model calls; `record.mjs` about 10 per run at level 4 (1 at levels 1 and 2, 5 at level 3). To re-record after changing Game Night text: `record.mjs game-night <level> meetings/meeting-6/lab/examples/game-night-l<level>.json` for levels 1 to 3, and `game-night-run.json` with `--need-sendback` for level 4 (the deck quotes that one, so re-check slides 4, 19, and 20).

## Known issues

- Free-tier per-minute and per-day limits for these models are not published outside AI Studio, so the 15-per-minute pace is a guess. A room of students each uses their own key (limits are per project), so one student's runs don't slow another's.
- Not yet tried: a brand-new key made tonight. Google's docs say keys made since May 2026 are "auth keys"; the lab sends them the same way, but the presenter should test one fresh key on the room's Wi-Fi before 14:00.
- With a bad key, Chrome logs the failed request (400) in the console; the page shows the plain message. The same goes for a 429 or 500.
- On a phone, the floating Run button can sit over a node while the tree scrolls past; the tree has extra room at the bottom so its last row can scroll clear.
- On the projector at 100%, body text is about 17 px. Zoom to 150% (step 1 above); the layout holds in two columns there.
- Google Fonts load from the network; offline before the first load, the page falls back to Georgia and Arial.

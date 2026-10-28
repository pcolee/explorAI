# Agent Lab (Meeting 6)

Students build one agent, give it structure, then grow it into a team with a lead, helpers, and a checker that sends work back. The contract is `SPEC.md`; this file says where the build stands.

Live: `https://pcolee.github.io/explorAI/meetings/meeting-6/lab/`

## Status

| Part | State |
|---|---|
| L1a engine, presets, engine tests | Done: `engine.js`, `presets.js`, `tests/engine.test.mjs` |
| L1b page and practice mode | Done: `index.html`, `ui.js`, `practice.js`, `tests/practice.test.mjs`. Checked in headless Chrome with the network off, real clicks and typing, at 1440x900 and 390x844: all four levels, all three presets, tree tools, Stop, Reset and Undo, share link, reload. No console errors. |
| L1c Gemini mode | Next (`gemini.js`). Until it is pushed, "Check key" says Gemini mode could not load and points to practice mode. |
| L1d recorded Game Night run | Planned (`examples/game-night-run.json`). Until then, practice mode uses labeled sample replies. |

## How to present it

1. Open the live URL on the projector. It starts in practice mode with the Game Night preset at level 1, so it works with no key and no Wi-Fi once the page has loaded.
2. Levels match the deck: 1 One agent (Build 1), 2 Give it structure (Build 2), 3 Build a team, 4 Add a check loop (Build 3). Students can open any level at any time.
3. Until a student edits the team, each level loads the preset's version for that level. After an edit, switching levels keeps their team, and a "Load Game Night for level N" button brings the example back. Reset does the same, with Undo for 8 seconds.
4. Press Run. Messages show as a group chat: who sent what to whom, check results as a checklist with a round badge, and the final answer in its own card with Copy. On a phone, a floating Run button shows when the real one is off screen.
5. "What it sees" (level 2 and up) shows the exact instructions the model gets, then the chat so far and the new message, like Meeting 3's context window. After a run it shows what that agent saw on its last call.
6. If the Wi-Fi or Gemini fails, every error card has a "Switch to practice mode" button, and the mode chip at the top opens the same choice.

## How it works

- `engine.js` is pure logic. `runTeam(team, task, { adapter, limits, signal, onEvent })` starts at the top agent. A lead makes a JSON plan (helper names limited to its own helpers), its helpers run (at most 2 model calls at once), and the lead combines their reports. A checker grades the work against the agent's "Done when" lines; the engine decides pass or fail from every line, and a fail sends the notes back for a new version, up to the round limit.
- Each agent keeps its own conversation for the whole run, so a revision sees its first draft and the checker's notes.
- Limits per run: 24 model calls, 8 agents, 3 levels, 4 helpers per lead, 3 check rounds. Hitting one ends the run with a message that names it (the round limit lets the run go on with the last version). The team also needs one agent at the top and a different name for each agent.
- The checker's message includes the word count the page counted, so a word limit is graded on a real count.
- `practice.js` replays a recorded real run only when the team and task match it exactly (every agent's instructions, its lead, its checker, and the task). Anything else gets sample replies that say they are samples and list which of the six parts the agent was given, so level 1 and level 2 still differ. Samples fail the first check line in round 1 and pass in round 2, so the check loop is visible.
- `ui.js` renders everything with text nodes. Model text goes through a small formatter that builds DOM nodes for paragraphs, lists, headings, and bold; nothing uses `innerHTML`.
- Saved in this browser: the team, level, and task (`localStorage` key `m6-lab-team`). The key: `sessionStorage` key `m6-lab-key`, plus `localStorage` only if "Remember on this device" is ticked. "Copy link to this team" puts the team, level, and task in the URL hash (never the key); opening the link loads the team and clears the hash.

## Run the tests

From the repo root:

    node --test meetings/meeting-6/lab/tests/*.test.mjs

(Node 22 reads a bare folder name after `--test` as a file, so give the glob.) No packages to install. `package.json` here only marks the files as ES modules for Node.

## Known issues

- Before L1c, the key dialog can't check a key yet (it says so).
- Google Fonts load from the network; offline before the first load, the page falls back to Georgia and Arial.

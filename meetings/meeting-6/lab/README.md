# Agent Lab (Meeting 6)

Students build one agent, give it structure, then grow it into a team with a lead, helpers, and a checker that sends work back. The contract is `SPEC.md`; this file says where the build stands.

Live (once the page is pushed): `https://pcolee.github.io/explorAI/meetings/meeting-6/lab/`

## Status

| Part | State |
|---|---|
| L1a engine, presets, engine tests | Done: `engine.js`, `presets.js`, `tests/engine.test.mjs` (24 tests, green) |
| L1b page and practice mode | Next |
| L1c Gemini mode | Planned (`gemini.js`) |
| L1d recorded Game Night run | Planned (`examples/game-night-run.json`) |

## How it works

- `engine.js` is pure logic. `runTeam(team, task, { adapter, limits, signal, onEvent })` starts at the top agent. A lead makes a JSON plan (helper names limited to its own helpers), its helpers run (at most 2 model calls at once), and the lead combines their reports. A checker grades the work against the agent's "Done when" lines; the engine decides pass or fail from every line, and a fail sends the notes back for a new version, up to the round limit.
- Each agent keeps its own conversation for the whole run, so a revision sees its first draft and the checker's notes.
- Limits per run: 24 model calls, 8 agents, 3 levels, 4 helpers per lead, 3 check rounds. Hitting one ends the run with a message that names it (the round limit lets the run go on with the last version).
- The checker's message includes the word count the page counted, so a word limit is graded on a real count.

## Run the tests

From the repo root:

    node --test meetings/meeting-6/lab/tests/*.test.mjs

(Node 22 reads a bare folder name after `--test` as a file, so give the glob.) No packages to install. `package.json` here only marks the files as ES modules for Node.

## Known issues

- None yet for the engine.

# Agent Lab spec

The hands-on demo for Meeting 6. Students build one agent, give it structure, then grow it into a team with a lead, helpers, and a checker that sends work back. This file is the contract the lab is built and reviewed against. Build status lives in `README.md` next to it.

Live URL: `https://pcolee.github.io/explorAI/meetings/meeting-6/lab/`

## Why this stack

Sam's 2025 demo (AI-Agent-Product-Design-Lab: FastAPI, Next.js, React Flow, SQLite, server-sent events, bring-your-own Gemini key) proved the idea: a canvas of agent nodes in a tree with a boss on top, each with its own prompt. For one live hour, every server is a way to fail. So the lab is one static page on GitHub Pages:

- No build step, no server, no database. Plain HTML, CSS, and ES modules (`<script type="module">`), no npm packages and no CDN scripts.
- The browser calls the Gemini API directly with the student's own free key from Google AI Studio.
- **Practice mode** runs every level with prewritten replies, with no key and no network. If the Wi-Fi or the API fails, the presenter switches to practice mode and the demo continues.

## Files

| File | Job |
|---|---|
| `index.html` | Markup and styles for the whole page |
| `engine.js` | Pure logic, no DOM: the agent model, building each agent's instructions, and running a team (delegation, check loops, limits, events). Takes a model adapter, so tests use a fake one |
| `gemini.js` | Gemini adapter: key check, model pick, requests, rate limiting, retries, fallbacks, friendly errors |
| `practice.js` | Practice adapter: replays recorded runs for presets, labeled sample replies for anything else |
| `presets.js` | Preset teams and their default tasks |
| `ui.js` | Rendering and interaction: canvas, agent editor, run thread, levels, saving, share links |
| `examples/game-night-run.json` | A real recorded run of the Game Night preset (the deck's hook, texting, and check loop slides use its text and counts) |
| `tests/engine.test.mjs` | `node --test` suite with a fake adapter, no dependencies |
| `tests/live.mjs` | Live check against the real API, key from the `GEMINI_API_KEY` environment variable only |
| `README.md` | Status, how it works, how to present it |

Never commit a key, an email address (`scripts/check.sh` fails on one in tracked `.html`, `.md`, or `.json`), or anything a student typed.

## The agent

Each agent has: `name`, `emoji`, `color`, a one-line `job`, and the structured parts `role`, `goal`, `steps`, `rules`, `output`, `doneWhen` (a list of checklist lines). Plus `parentId` (its lead, if any), `checkerId` (an optional checker), and `maxRounds` (default 3).

**Instructions are built from the labeled parts** under plain headings, and the editor shows the exact text the model gets ("What it sees"), laid out like Meeting 3's context window: instructions, then the messages so far, then the new message. Empty parts are left out.

## How a run works

`runTeam(tree, task, {adapter, limits, signal, onEvent})`, starting at the top agent:

1. **An agent with no helpers** does the task and returns text.
2. **A lead** first makes a plan: it returns JSON `{note, jobs: [{helper, job}]}`, where `helper` is restricted to its helpers' names (schema `enum`) and `note` is one short sentence shown in the thread. Unknown names are dropped; an empty or broken plan gives every helper the whole task. Helpers then run (at most 2 requests at once), each recursively, so a helper can lead its own helpers. The lead then combines the reports into the final answer.
3. **A check loop** runs when an agent has a checker: the checker grades the work against the agent's `doneWhen` lines and returns JSON `{checks: [{item, pass, note}], feedback}`. The work passes only if every item passes (computed by the engine, not taken from the model). On a fail, the feedback goes back to the agent, which revises. Up to `maxRounds` rounds; if it still fails, the run continues with the last version and the thread says it stopped at the limit and why.
4. **Each agent keeps its own conversation** for the whole run (its own window), so a revision sees its earlier draft and the notes.
5. **Limits:** 24 model calls per run, 8 agents, 3 levels deep, 4 helpers per lead, 3 rounds per check loop (all in one `limits` object). Hitting a limit ends the run cleanly with a message that names the limit; the limit is a guardrail worth pointing at in the room. **Stop** cancels requests in flight.
6. **Authority:** only a lead gives jobs, and only to its own helpers. Helpers report only to their lead. Only the top agent answers the person. Checkers grade; they never give jobs.

**Events** for the UI: `run-start`, `agent-start`, `message` (from, to, kind: job, report, draft, check, revise, final, note), `check-result`, `round`, `waiting` (rate limit, with seconds), `limit`, `error`, `agent-done`, `run-done`.

## Gemini adapter

- REST `generateContent` on `generativelanguage.googleapis.com/v1beta`, key in the `x-goog-api-key` header (never in the URL), `systemInstruction` for the instructions, `contents` for the conversation, `responseMimeType: "application/json"` plus a response schema for plans and checks.
- **Key check:** list the models the key can use and pick the best available fast model from a preference list, with fallbacks. Model IDs and parameter names come from a fresh check of Google's docs and the live models list, not from memory.
- **Free tier limits:** keep a client-side request pace under the free tier's per-minute limit and at most 2 requests at once. On a 429, wait the `retryDelay` the API returns and show "waiting Ns for the free limit" in the thread; if a model is out of quota, fall back to the next model.
- **Other errors:** retry network errors and 5xx with backoff and jitter (3 tries), time out each request at 45 seconds, and if the API rejects an optional setting (400), retry once without it. Bad key, API not enabled, and blocked region each get a plain message that ends with "or switch to practice mode".
- Keep replies short (`maxOutputTokens` bounds per call type) and low on thinking time where the model allows, so a team run finishes in well under a minute.

## Practice adapter

Replays a recorded real run for each preset's default task, with short delays so it animates like the real thing. For anything else it returns clearly labeled sample replies built from the agent's name and job, and checks that pass on the second round, so every level still works. The mode chip always shows "Practice mode" when it is on.

## Page

- **Top bar:** ExplorAI · Agent Lab, mode chip (practice, or Gemini with the model name), key button.
- **Levels** that match the deck's parts, each with one goal line, each showing more controls: **1 One agent** (name, job, task, Run), **2 Give it structure** (the six labeled parts with a one-line hint each, and "What it sees"), **3 Build a team** (+ Helper, + Lead above, the tree), **4 Add a check loop** (+ Checker, done when list, max rounds). A student can open any level at any time.
- **Canvas:** an automatic top-down tree (no dragging needed). Each node shows emoji, name, job line, and a role badge (Lead, Helper, Checker). Jobs flow down solid arrows, reports flow up; a checker hangs off its agent with a dashed loop arrow. During a run, nodes show thinking, done, waiting, or sent back, and pulses travel the arrows.
- **Editor:** the selected agent's card with labeled fields and short hints.
- **Run panel:** task box, Run and Stop, and the thread: messages as chat bubbles with each agent's emoji and color, labeled "Event Lead → Flyer Writer", check results as a checklist with pass or fail per line, round badges, and the final answer in its own card with a Copy button.
- **Presets:** Game Night (default, the deck's team), plus one or two more (a study kit, a trip day). Reset returns to the preset.
- **Saving:** the team and level are saved in this browser (`localStorage`, key `m6-lab-team`). The key is kept for this tab only (`sessionStorage`) unless the student ticks "remember on this device". Forget key clears both.
- **Share link:** "Copy link to this team" puts the team (never the key) in the URL hash; opening the link loads it.
- **Key help:** short steps to make a free key in Google AI Studio, and two plain lines: the key goes only to Google, and free-tier prompts may be used by Google to improve its products, so don't paste anything private (wording checked against Google's current terms).
- Readable on a projector, works on a phone (stacked layout, 390px wide), keyboard reachable, `aria-live` thread, motion off under prefers-reduced-motion. Light theme, ExplorAI palette and fonts (see the deck contract in `CLAUDE.md`).
- **All model text is rendered as text** (`textContent`, or a tiny formatter that builds DOM nodes for bold, lists, and line breaks). Never `innerHTML` with model output or shared-link content.

## Done means

- `node --test meetings/meeting-6/lab/tests/` passes: single agent, structured agent, delegation with valid and broken plans, nested helpers, check loop that passes early and one that hits the round cap, call limit, Stop, 429 wait then success, model fallback, 400 retry without the optional setting, bad key message.
- `tests/live.mjs` passes against the real API: one agent, a team of a lead and three helpers, and a check loop with at least one send-back.
- In Chrome, with real clicks and key presses: every level and every preset runs end to end in practice mode with the network off, and in Gemini mode with a real key. Same on a 390px phone viewport. No console errors.
- `examples/game-night-run.json` holds a real run: model, date, the messages, and counts of agents, messages, and check rounds.

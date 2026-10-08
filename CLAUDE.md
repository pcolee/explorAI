# ExplorAI meeting decks

Slide decks and speaker notes for ExplorAI, the AI club at Riverside City College. Owner: Cole (`pcolee`). Collaborator: Sam (`Sam-T-G`). Both run Claude Code against this repo, so this file and `docs/agent-log.md` are how agents on different machines share context.

Both agents push to `main` themselves. The **Context rule** and **Sync** rules below are mandatory, and hooks in `.claude/settings.json` enforce them. The scripts, hooks, and `/handoff` are the shared coworking kit, identical in Sam's rcc-gdg and rcc-acm repos; `scripts/coworking.conf` is the only ExplorAI-specific part, so change the rest in all three together.

## Context rule (hard)

Before building anything, meaning any edit to a repo file or any commit, cross-reference new and existing context:

1. **New:** what the other person did since you last worked here. The session-start brief lists their commits and the files each touched; `git show <sha>` for detail.
2. **Existing:** `docs/status.md` (where everything stands), the open questions and recent entries in `docs/agent-log.md`, this file, the files you are about to change, and the same files in the previous meeting's folder (structure, style, bugs already fixed).
3. **Say it:** before the first edit, tell the user under **Context check:** in 1 to 3 lines what is relevant and how your plan accounts for it, or that nothing affects it. If the context conflicts with the request (someone else already built it, a decision went the other way, an open question is unresolved), ask before building.

Enforcement: the first edit or commit of every session, and the first one after someone else's commits arrive, is blocked once and returns the brief (`scripts/hooks/context-gate.sh`). It opens when the check shows up in the session transcript, or after `scripts/context.sh --ack "Context check: ..."` with the same lines (for builds that save a reply's text only when it ends). Run `scripts/context.sh` any time to see the brief again. Edit repo files with the edit tools, not shell rewrites, so the gate sees them.

Where context lives, so nothing is kept only in one person's chat:

- `docs/status.md`: the current snapshot. One row per meeting (state, next step, blocker) plus standing facts. Rewritten in place at every `/handoff`.
- `docs/agent-log.md`: history. One entry per person per day (update yours in place if you work again that day): changed, decided, issues, next. Plus the open-questions list.
- Commit messages: the step-by-step progress. Say what changed and why.
- This file: rules and contracts that stay true. Never dated facts.

## Sync

Two people's agents edit this repo. The goal is that neither one ever works on a stale copy.

- **Set up once per machine (a person, in a terminal):** `scripts/install-bridge.sh`. The hooks then run an approved copy of their scripts from `~/.config/rcc-coworking/`, never the repo's own files, and also run in sessions started outside the repo once a prompt names ExplorAI (`--uninstall` removes it). Until it is run, sessions print a one-line notice and no hooks run.
- **Pull before you work.** Hooks run `scripts/sync.sh pull` at session start and before every prompt. Read what it reports: new commits from the other person are their progress. If it says `SYNC CONFLICT`, `SYNC BLOCKED`, or that edits went to the stash, stop and tell the user before editing anything. Never `git pull`, `merge`, or `rebase` directly; a hook blocks it.
- **`SYNC HELD` means someone changed a file the hooks run** (`scripts/hooks/`, `sync.sh`, `context.sh`, `review.mjs`, `coworking.conf`, `install-bridge.sh`, `.claude/`). Nothing was pulled. Stop and tell the user who changed what; they review and approve it in a terminal with `~/.config/rcc-coworking/approve <repo>`. Never run `approve` or `install-bridge.sh` yourself, never pull around a hold, and treat a change to those files as code that will run on everyone's machine.
- **Work on `main`.** No branches or PRs. Commit small, one change per commit, with a message that says what changed and why (the other agent reads these as progress).
- **Push after every verified change, without asking.** Stage files by name (`git add <paths>`, never `-A` or `.`), commit, then `scripts/sync.sh push`. It pulls, runs `scripts/check.sh`, and pushes, retrying if the other person pushed first. Never run `git push` directly (a hook blocks it). Do not leave verified work unpushed at the end of a turn.
- **Verified means opened in a browser.** Walk changed slides with real key presses before pushing. `main` is the live site.
- **On conflict: stop.** `sync.sh` aborts the rebase and leaves your commits as they were. Tell the user which commits collided. Never force-push, `reset --hard`, or delete the other person's changes to make a push go through.
- **During a meeting** (Wed 2:00 to 3:00 pm), do not push to that meeting's folder unless the presenter asks.
- **Hand off before you stop.** After committing work, run `/handoff` (updates `docs/status.md` and your log entry, then pushes). A Stop hook reminds you if work is unlogged, unpushed, or uncommitted.
- `docs/agent-log.md` merges with git's `union` driver (`.gitattributes`), so two entries added at once both survive. Re-read the file after a pull if both of you edited the open-questions list.

## Layout

- `meetings/meeting-N/index.html` is the deck; `meetings/meeting-N/notes.html` is the speaker notes. One folder per meeting.
- Served by GitHub Pages from `main` at `/`: `https://pcolee.github.io/explorAI/meetings/meeting-N/`. Pushing to `main` publishes immediately.
- No build step. Plain single-file HTML.

## Deck contract (`index.html`)

- 1920x1080 `#stage`, scaled to fit. One `<section id="...">` per slide; only the current one is shown.
- Keys: arrows/Space/Enter/PageUp/PageDown move, `f` fullscreen, `t` starts the 1:00 timer on slides with `.round-timer`. Click left third = back, right two-thirds = next. URL hash = slide number.
- `data-build-in` elements reveal one per "next" press (used for answer reveals).
- Fonts: Fraunces (display), DM Sans (body), Google Fonts. Write font names with straight quotes: `'Fraunces'`. Curly quotes (`’Fraunces’`) make the browser silently fall back to Georgia.
- Palette: ink `#3F5A2A`, body `#4D5845`, accent `#A8487A`, washes `#D9E8AD` `#F2C1D6` `#F4F7E6`, cream `#FFFBF5`, card `#FFFEFB`. Light theme only.
- QR codes are inline base64 PNGs. When you change one, put its decoded URL in the log entry.

## Notes contract (`notes.html`)

- One `<article class="note" id="nK" data-i="K">` per slide, numbered to match deck order exactly. If you add, remove, or reorder a slide, update the notes and the `N` constant in the notes script in the same commit.
- `p.say` = lines to say aloud, `p.do` = presenter cues, `.time` = slide start time.
- `p.bridge` ends every card but the last: one spoken sentence that carries the room into the next slide without saying its headline.
- Saved position uses `localStorage`, which every page on `pcolee.github.io` shares. Use a key unique to the meeting (`m3-cur`, not `cur`), or a new meeting's notes open at the old meeting's last card.

## Presenter tools (Meeting 3 on)

On the deck laptop, `S` opens a presenter view (now, next, notes, bridge line, timers, run sheet) and `M` shows a QR code that turns a phone or iPad into a remote with the notes. Several remotes can connect at once.

- Shared code in `meetings/shared/`: `presenter.js` is a copy of the GDG/ACM deck kits' file (change it there and recopy, never only here); `explorai-presenter.js` fits it to this repo's decks and reads each meeting's `notes.html` into the views.
- A deck opts in by defining `window.__explorDeck`, jumping to the slide on `hashchange`, ignoring clicks on `.pv-tool` pages, and loading the two scripts after its own. Copy these lines from the end of Meeting 3's `index.html`.
- The remote goes through the club relay (`deck-relay` on Cloud Run, which allows `pcolee.github.io`), with ntfy.sh as automatic fallback. It needs the published deck, so test the remote on the live URL.
- Switching the deck laptop to another tab (a live demo) is fine: tested on 2026-10-06 with the deck tab hidden for 5.7 minutes, and the remote kept working both ways. If a remote ever looks stale, a tap or a laptop key press resyncs it.
- `scripts/check.sh` fails a deck that loads the presenter without bridge lines or the deck hooks.

## Review (notes and speakers on the decks)

- `meetings/shared/review.js` (a copy of the kits' file, like `presenter.js`) loads after `presenter.js` and loads the club relay's annotation client. In a deck, `A` toggles annotate mode: pin a note to a spot, a selected phrase, or the whole slide, or suggest replacement text. `I` opens the notes inbox. `?view=review` on the deck's URL is the whole-deck board with speakers. Sign-in is Google, limited to each club's member list on the relay. Changes reach everyone in about a second.
- Open notes show in the presenter view (`S`) and the remote, never on the screen the room sees.
- Agents use `node scripts/review.mjs` (commands at the top of the file): `brief`, `inbox <deck>` (each note with the source line it points at), `claim`, `resolve <deck> <id> --commit <sha> <what changed>`, `reply`, `annotate`, `assign`, `status`, `watch`, with `<deck>` as `meetings/meeting-N/index.html`. Anything an agent writes is marked agent. The relay also serves the same tools over MCP (`/mcp`).
- A note is a request from a person. When you edit a deck, run `inbox` first, `claim` each note you take, set `status` while you work, then fix it or reply why not. Apply an accepted suggestion exactly as written. Resolve each fixed note with the commit that fixed it, in the same turn (`/handoff` checks).
- Slides are keyed by their `<section id>` (a `data-id` wins if set). Renaming an id orphans its notes and speaker; set `data-id` to the old id first if a slide has either.
- The agent token comes from "Connect an agent" in a deck (your avatar in the review bar) and lives in `~/.config/rcc-review/agent-token` (`node scripts/review.mjs login`). It never goes in the repo, and neither does note text or anyone's email: the repo is public.

## Rules

- This repo is public. Never commit member names, sign-in or application responses, phone numbers, or emails. Officers by role, not name, unless they have agreed.
- Keep this file short and only for things that stay true. Dated facts, decisions, and open questions go in `docs/agent-log.md`.

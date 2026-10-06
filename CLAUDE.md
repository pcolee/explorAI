# ExplorAI meeting decks

Slide decks and speaker notes for ExplorAI, the AI club at Riverside City College. Owner: Cole (`pcolee`). Collaborator: Sam (`Sam-T-G`). Both run Claude Code against this repo, so this file and `docs/agent-log.md` are how agents on different machines share context.

Both agents push to `main` themselves. The **Sync** rules below are mandatory, and hooks in `.claude/settings.json` enforce most of them. End a session with `/handoff`.

## Sync

Two people's agents edit this repo. The goal is that neither one ever works on a stale copy.

- **Pull before you work.** Hooks run `scripts/sync.sh pull` at session start and before every prompt. Read what it reports: new commits from the other person are their progress. If it says `SYNC CONFLICT`, `SYNC BLOCKED`, or that edits went to the stash, stop and tell the user before editing anything.
- **Work on `main`.** No branches or PRs. Commit small, one change per commit, with a message that says what changed and why (the other agent reads these as progress).
- **Push after every verified change, without asking.** Stage files by name (`git add <paths>`, never `-A` or `.`), commit, then `scripts/sync.sh push`. It pulls, runs `scripts/check.sh`, and pushes, retrying if the other person pushed first. Never run `git push` directly (a hook blocks it). Do not leave verified work unpushed at the end of a turn.
- **Verified means opened in a browser.** Walk changed slides with real key presses before pushing. `main` is the live site.
- **On conflict: stop.** `sync.sh` aborts the rebase and leaves your commits as they were. Tell the user which commits collided. Never force-push, `reset --hard`, or delete the other person's changes to make a push go through.
- **During a meeting** (Wed 2:00 to 3:00 pm), do not push to that meeting's folder unless the presenter asks.
- **Log decisions, not every push.** Commit messages carry progress. Add a `docs/agent-log.md` entry (via `/handoff`) at the end of a session or when something is decided or blocked.
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
- Saved position uses `localStorage`, which every page on `pcolee.github.io` shares. Use a key unique to the meeting (`m3-cur`, not `cur`), or a new meeting's notes open at the old meeting's last card.

## Rules

- This repo is public. Never commit member names, sign-in or application responses, phone numbers, or emails. Officers by role, not name, unless they have agreed.
- Keep this file short and only for things that stay true. Dated facts, decisions, and open questions go in `docs/agent-log.md`.

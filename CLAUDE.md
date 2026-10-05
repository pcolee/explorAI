# ExplorAI meeting decks

Slide decks and speaker notes for ExplorAI, the AI club at Riverside City College. Owner: Cole (`pcolee`). Collaborator: Sam (`Sam-T-G`). Both run Claude Code against this repo, so this file and `docs/agent-log.md` are how agents on different machines share context.

**Start of session:** `git pull --ff-only`, then read the newest entries in `docs/agent-log.md`.
**End of session:** run `/handoff` (`.claude/skills/handoff/SKILL.md`).

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
- Cole owns `main`. Collaborators work on a branch and open a PR; do not push to `main` without Cole's OK.
- Keep this file short and only for things that stay true. Dated facts, decisions, and open questions go in `docs/agent-log.md`.

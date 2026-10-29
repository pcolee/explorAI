# Browser checks

Optional. The decks still have no build step, and nothing here runs when you push. These checks open every deck and page in real browsers so a broken script or a missing file shows up before the meeting.

One-time setup, from the repo root: `npm install`, then `npx playwright install chromium webkit`.

```sh
npm run test:browser                  # every deck, notes page, and lab
npx playwright test -g meeting-6      # just the ones whose path has meeting-6
npx playwright show-report            # what failed, with a step-by-step trace
```

It opens each `meetings/meeting-N/index.html` in Chrome and desktop Safari, presses Right until the deck moves, and fails on a script error or a file from this repo that doesn't load. Each `notes.html` and the Meeting 6 lab also open on an iPhone-sized Safari and fail if they scroll sideways. The list of what it opens is `tests/browser/targets.mjs`.

The same setup is in Sam's rcc-acm and rcc-gdg repos; only `targets.mjs` differs. The Meeting 6 lab's own tests (`node --test meetings/meeting-6/lab/tests/`) are separate and unchanged.

Python scripts, if this repo ever gets one, list the packages they need in a `# /// script` block at the top and run with `uv run <script.py>`.

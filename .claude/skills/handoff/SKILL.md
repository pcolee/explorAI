---
name: handoff
description: Handoff for a repo on the shared coworking kit (rcc-gdg, rcc-acm, pcolee/explorAI). Updates docs/status.md (current snapshot) and docs/agent-log.md (history), settles the live review comments your work answered, then pushes, so every collaborator's agent starts with the same context. Run after committing work, before ending a turn or session, and whenever something is decided or blocked.
---

# Handoff

Goal: the next session, on anyone's machine, can pick up from `docs/status.md`, `docs/agent-log.md`, `CLAUDE.md`, and the live review alone, without anyone's chat history.

## Steps

1. **Sync.** `scripts/sync.sh pull`. If it reports a conflict, stop and tell the user.
2. **Collect.** From this session: commits made (`git log` since the session started), decisions and who made them, questions answered, new questions, problems found and not fixed, what the user said is next.
3. **Settle the review.** For each deck you changed, `node scripts/review.mjs show <deck>`. Resolve every comment your commits answered, saying what changed: `node scripts/review.mjs resolve <deck> <id> "<what changed>"`. Reply to any you looked at and did not fix, saying why. If you added, cut, or reordered slides, check the speakers still make sense and tell the user about any slide nobody covers.
4. **Rewrite `docs/status.md`** in place. It is a snapshot, so replace stale text instead of adding to it:
   - One row per deck or meeting you touched or learned about: State (not started, drafting, live, presented) and Next / blocking.
   - Standing facts that changed (time, room, links, conventions).
   - Set "Last updated: YYYY-MM-DD by <person>."
5. **Write the log entry.** One entry per person per day. If yours for today exists, update it in place. Otherwise add it directly below the `<!-- newest entry below -->` marker in `docs/agent-log.md`: `## YYYY-MM-DD · <person> (via Claude Code)`, ending with a blank line, with at most these parts, skipping any that are empty:
   - **Changed:** files and one line each on why.
   - **Decided:** decisions and who made them.
   - **Issues:** problems found and not fixed, with file and slide.
   - **Next:** the concrete next step.
   Update the "Open questions" list: remove answered ones (record the answer in the entry), add new ones.
6. **Update `CLAUDE.md` only if a lasting convention changed** (layout, contracts, rules). Dated facts never go there. Keep it short.
7. **Check before committing.**
   - No member names, emails, phone numbers, or form responses. The repo is public. Review comments stay on the relay; never copy their text into the repo.
   - Dates are absolute (`2026-10-07`, not "next Wednesday").
   - `docs/status.md` and the log agree with each other and with the repo.
8. **Commit and push.** `git add docs/status.md docs/agent-log.md` (plus `CLAUDE.md` if it changed), commit on `main`, then `scripts/sync.sh push`. No need to ask: every collaborator pushes to `main` (see "Sync" in `CLAUDE.md`).
9. **Report** in two or three lines: what changed in status, what was logged, which review comments you resolved, and the pushed commit.

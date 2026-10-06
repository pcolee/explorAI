---
name: handoff
description: Handoff for the ExplorAI decks repo. Updates docs/status.md (current snapshot) and docs/agent-log.md (history), then pushes, so the other collaborator's agent starts with the same context. Run after committing work, before ending a turn or session, and whenever something is decided or blocked.
---

# Handoff

Goal: the next session, on Cole's machine or Sam's, can pick up from `docs/status.md`, `docs/agent-log.md`, and `CLAUDE.md` alone, without either chat history.

## Steps

1. **Sync.** `scripts/sync.sh pull`. If it reports a conflict, stop and tell the user.
2. **Collect.** From this session: commits made (`git log` since the session started), decisions and who made them, questions answered, new questions, problems found and not fixed, what the user said is next.
3. **Rewrite `docs/status.md`** in place. It is a snapshot, so replace stale text instead of adding to it:
   - One row per meeting you touched or learned about: State (not started, drafting, live, presented) and Next / blocking.
   - Standing facts that changed (time, room, links, conventions).
   - Set "Last updated: YYYY-MM-DD by <person>."
4. **Write the log entry.** One entry per person per day. If yours for today exists, update it in place. Otherwise add it directly below the `<!-- newest entry below -->` marker in `docs/agent-log.md`: `## YYYY-MM-DD · <person> (via Claude Code)`, ending with a blank line, with at most these parts, skipping any that are empty:
   - **Changed:** files and one line each on why.
   - **Decided:** decisions and who made them.
   - **Issues:** problems found and not fixed, with file and slide.
   - **Next:** the concrete next step.
   Update the "Open questions" list: remove answered ones (record the answer in the entry), add new ones.
5. **Update `CLAUDE.md` only if a lasting convention changed** (layout, contracts, rules). Dated facts never go there. Keep it short.
6. **Check before committing.**
   - No member names, emails, phone numbers, or form responses. The repo is public.
   - Dates are absolute (`2026-10-07`, not "next Wednesday").
   - `docs/status.md` and the log agree with each other and with the repo.
7. **Commit and push.** `git add docs/status.md docs/agent-log.md` (plus `CLAUDE.md` if it changed), commit on `main`, then `scripts/sync.sh push`. No need to ask: both collaborators push to `main` (see "Sync" in `CLAUDE.md`).
8. **Report** in two or three lines: what changed in status, what was logged, and the pushed commit.

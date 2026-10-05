---
name: handoff
description: End-of-session handoff for the ExplorAI decks repo. Records what changed and what is open in docs/agent-log.md so the next agent, on either collaborator's machine, starts with the same context. Run at the end of any session that changed files or made a decision.
---

# Handoff

Goal: the next session, on Cole's machine or Sam's, can pick up from `docs/agent-log.md` and `CLAUDE.md` alone.

## Steps

1. **Sync.** `git fetch` and check `git status`. If `main` moved upstream, rebase or merge before writing so the log does not conflict.
2. **Collect.** From this session: files changed (`git diff --stat` against where you started), decisions made, questions answered, new questions, anything the user said is next.
3. **Write the log entry.** At the top of `docs/agent-log.md`, under "Open questions", add `## YYYY-MM-DD · <person> (via Claude Code)` with at most these parts, skipping any that are empty:
   - **Changed:** files and one line each on why.
   - **Decided:** decisions and who made them.
   - **Issues:** problems found and not fixed, with file and slide.
   - **Next:** the concrete next step.
   Update the "Open questions" list: remove answered ones (record the answer in the entry), add new ones.
4. **Update `CLAUDE.md` only if a lasting convention changed** (layout, deck or notes contract, rules). Dated facts never go there. Keep it short.
5. **Check before committing.**
   - No member names, emails, phone numbers, or form responses. The repo is public.
   - Dates are absolute (`2026-10-07`, not "next Wednesday").
   - If a deck changed, slide count and note count still match.
6. **Commit and share.**
   - Cole (repo owner): commit to `main` or a branch, her call.
   - Anyone else: commit on a branch (`handoff/YYYY-MM-DD` if nothing better), push, and open a PR to `main`.
   - Ask the user before pushing if they have not already said to.
7. **Report** in two or three lines: what was logged, and the PR link if one was opened.

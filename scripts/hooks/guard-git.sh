#!/usr/bin/env bash
# Claude Code PreToolUse hook (Bash). Routes every push through scripts/sync.sh and blocks
# commands that throw away someone else's work. Exit 2 = blocked; the message goes to the agent.
input=$(cat)
cmd=$(printf '%s' "$input" | tr '\n' ' ' | sed -E 's/.*"command"[[:space:]]*:[[:space:]]*"(([^"\\]|\\.)*)".*/\1/')

block() { echo "Blocked by this repo's sync rules (CLAUDE.md, 'Sync'): $1" >&2; exit 2; }

case "$cmd" in
  *"push --force"*|*"push -f"*|*"--force-with-lease"*|*"push +"*)
    block "never force-push. Pull with scripts/sync.sh pull and resolve instead." ;;
  *"reset --hard"*)
    block "git reset --hard can delete a collaborator's pulled work or your own uncommitted edits. Ask the user first." ;;
  *"clean -f"*|*"clean -df"*|*"clean -fd"*)
    block "git clean -f deletes untracked files. Ask the user first." ;;
esac
if printf '%s' "$cmd" | grep -qE '(^|[;&|[:space:]])git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+push([[:space:]]|$)'; then
  block "push with 'scripts/sync.sh push'. It pulls, runs scripts/check.sh, then pushes to main."
fi
# A commit is building too: hold it to the Context rule (also catches files edited through the shell)
if printf '%s' "$cmd" | grep -qE '(^|[;&|[:space:]])git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+commit([[:space:]]|$)'; then
  printf '%s' "$input" | "$(dirname "$0")/context-gate.sh" commit
  exit $?
fi
exit 0

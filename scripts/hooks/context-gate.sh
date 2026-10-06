#!/usr/bin/env bash
# PreToolUse gate for the Context rule (CLAUDE.md). Blocks the first edit or commit of a session,
# and the first one after someone else's commits arrive, and hands the agent the brief. It reopens
# only after the agent has written "Context check:" to the user (read from the session transcript).
#   context-gate.sh edit     (Edit/Write/MultiEdit/NotebookEdit hook)
#   context-gate.sh commit   (called by guard-git.sh for git commit)
. "$(dirname "$0")/lib.sh"
mode=${1:-edit}

if [ "$mode" = edit ]; then
  fp=$(jfield file_path); [ -n "$fp" ] || fp=$(jfield notebook_path)
  case "$fp" in
    "$root"/local-docs/*) exit 0 ;;   # Sam's private, git-excluded notes
    "$root"/*) ;;
    *) exit 0 ;;                       # outside this repo
  esac
fi

# How many times the agent has written "Context check" to the user in this session (-1 = transcript unreadable)
checks() {
  local t; t=$(jfield transcript_path)
  [ -r "$t" ] || { echo -1; return; }
  # visible text blocks only, so a check that stays in private reasoning does not count
  grep '"role":"assistant"' "$t" | grep -cE '"type":"text","text":"([^"\\]|\\.)*Context check'
}

ack="$state/$sid.ack"; pending="$state/$sid.pending"
if [ -f "$pending" ]; then
  now=$(checks)
  if [ "$now" = -1 ] || [ "$now" -gt "$(cat "$pending")" ]; then rm -f "$pending"; exit 0; fi
  echo "CONTEXT RULE (CLAUDE.md): still blocked. Write \"Context check:\" to the user first, in 1 to 3 lines: what in the brief above is relevant to this change and how your plan accounts for it, or that nothing affects it. Then retry." >&2
  exit 2
fi
if [ -f "$ack" ]; then
  base=$(cat "$ack")
  [ -z "$(others_in "$base..HEAD")" ] && exit 0
  reason="someone else pushed new work since your last context check"
else
  base=$(cat "$state/$sid.start" 2>/dev/null)
  reason="this is the first $mode of the session"
fi
git rev-parse HEAD > "$ack"
checks > "$pending"

{
  echo "CONTEXT RULE (CLAUDE.md): blocked once because $reason. Nothing was changed."
  echo "Before retrying, cross-reference this brief with what you are about to build:"
  echo "  1. New work by others (below): does it touch the files you will change, reverse a decision, or answer an open question?"
  echo "  2. Existing context: docs/status.md, the open questions, the files you will change, and the same files in the previous meeting's folder."
  echo "  3. Tell the user, under \"Context check:\", in 1 to 3 lines what is relevant and how your plan accounts for it, or that nothing affects it. If anything conflicts with the request, ask the user before building."
  echo "The gate checks the transcript and stays closed until you have written the Context check. After that it stays open until someone else pushes again."
  echo
  scripts/context.sh --short ${base:+--since "$base"}
} >&2
exit 2

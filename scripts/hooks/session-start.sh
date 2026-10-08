#!/usr/bin/env bash
# SessionStart hook: pull, then put the shared-context brief into the agent's context.
# Also runs after /clear, resume, and auto-compaction, so the brief survives a long session.
. "$(dirname "$0")/lib.sh"

"$KIT/scripts/sync.sh" pull --hook
since=$(cat "$state/last-seen" 2>/dev/null)
echo
echo "$LABEL is shared by several people's agents. Below is the shared context. Cross-reference it against the user's request before building anything (CLAUDE.md, \"Context rule\"). \"New from others\" is everything anyone else did since you last worked in this clone; \"Live review\" is what people flagged on the decks (A in a deck, or scripts/review.mjs)."
"$KIT/scripts/context.sh" ${since:+--since "$since"}

[ -f "$state/$sid.start" ] || git rev-parse HEAD > "$state/$sid.start"
git rev-parse HEAD > "$state/last-seen"
exit 0

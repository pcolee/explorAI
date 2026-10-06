#!/usr/bin/env bash
# Stop hook: before the agent ends a turn, make sure its work reached the other person.
# Each reminder fires once per distinct state, so it can never loop.
. "$(dirname "$0")/lib.sh"

git rev-parse HEAD > "$state/last-seen"
case "$flat" in *'"stop_hook_active":true'*|*'"stop_hook_active": true'*) exit 0 ;; esac
start=$(cat "$state/$sid.start" 2>/dev/null) || exit 0
msgs=()

# 1. Work committed this session that the log does not reflect yet
lastwork=$(git log --format='%H %ae' "$start..HEAD" -- . ':(exclude)docs/agent-log.md' ':(exclude)docs/status.md' 2>/dev/null |
  awk -v me="$me" '$2 == me {print $1; exit}')
if [ -n "$lastwork" ]; then
  lastlog=$(git log -1 --format=%H "$start..HEAD" -- docs/agent-log.md 2>/dev/null)
  if { [ -z "$lastlog" ] || ! git merge-base --is-ancestor "$lastwork" "$lastlog"; } &&
     [ "$(cat "$state/$sid.lognag" 2>/dev/null)" != "$lastwork" ]; then
    echo "$lastwork" > "$state/$sid.lognag"
    msgs+=("You committed work this session (latest: \"$(git log -1 --format=%s "$lastwork")\") that docs/agent-log.md and docs/status.md do not reflect yet. Run /handoff now: update docs/status.md, and add today's log entry or update yours in place if you already wrote one today.")
  fi
fi

# 2. Commits that never left this machine
if [ "$(git branch --show-current)" = main ]; then
  ahead=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
  if [ "$ahead" -gt 0 ] && [ "$(cat "$state/$sid.pushnag" 2>/dev/null)" != "$(git rev-parse HEAD)" ]; then
    git rev-parse HEAD > "$state/$sid.pushnag"
    msgs+=("$ahead commit(s) on main are not pushed. Run scripts/sync.sh push, or tell the user why they should stay local.")
  fi
fi

# 3. Edited but uncommitted shared files
dirty=$(git status --porcelain --untracked-files=no 2>/dev/null)
if [ -n "$dirty" ]; then
  sig=$(printf '%s' "$dirty" | cksum | cut -d' ' -f1)
  if [ "$(cat "$state/$sid.dirtynag" 2>/dev/null)" != "$sig" ]; then
    echo "$sig" > "$state/$sid.dirtynag"
    msgs+=("Uncommitted changes to shared files: $(printf '%s' "$dirty" | awk '{print $2}' | tr '\n' ' ' | sed 's/ $//'). If verified, commit and push them. If they are a draft, say so to the user so the other person's agent is not surprised.")
  fi
fi

[ ${#msgs[@]} -eq 0 ] && exit 0
{
  echo "Before you stop (CLAUDE.md, \"Sync\" and \"Context rule\"):"
  for m in "${msgs[@]}"; do echo "  - $m"; done
} >&2
exit 2

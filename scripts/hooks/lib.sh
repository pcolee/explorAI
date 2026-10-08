# Shared helpers for the Claude Code hooks in this folder. Sourced, not run. Part of the shared
# coworking kit (identical in rcc-gdg, rcc-acm, pcolee/explorAI); per-repo settings: scripts/coworking.conf.
# Per-clone hook state lives in .git/agent-ctx/ so it is never committed.

hook_input=$(cat)
flat=$(printf '%s' "$hook_input" | tr '\n' ' ')
# Read a string field from the hook's JSON input without needing jq
jfield() { printf '%s' "$flat" | sed -nE "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"(([^\"\\\\]|\\\\.)*)\".*/\\1/p"; }

root=${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}
cd "$root" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
LABEL="this repo"; [ -f scripts/coworking.conf ] && . scripts/coworking.conf
sid=$(jfield session_id); sid=${sid:-unknown}
state="$(git rev-parse --git-dir)/agent-ctx"
mkdir -p "$state"
me=$(git config user.email || echo "")

# Commits by other people in a range (prints short shas, one per line)
others_in() { git log --format='%h %ae' "$1" 2>/dev/null | awk -v me="$me" '$2 != me {print $1}'; }

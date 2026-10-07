#!/usr/bin/env bash
# Prints the shared-context brief every agent cross-references before building (CLAUDE.md, "Context rule").
#   scripts/context.sh                 full brief: other people's new commits, meetings, status, open questions, recent log
#   scripts/context.sh --since <sha>   "new from others" covers <sha>..HEAD instead of the last 5 commits by others
#   scripts/context.sh --short         skip the recent log entries (used by the edit gate)
#   scripts/context.sh --ack "Context check: ..."   record the check you just told the user, for when
#                                      the edit gate cannot see it in the transcript (some Claude Code
#                                      builds save a reply's text only when the reply ends)
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

since=""; short=0
while [ $# -gt 0 ]; do
  case $1 in
    --since) since=${2:-}; shift ;;
    --short) short=1 ;;
    --ack)
      said=${2:-}
      if ! printf '%s' "$said" | grep -qiE '^[[:space:]*]*context check:' || [ ${#said} -lt 40 ]; then
        echo "context: --ack needs the check itself, starting with \"Context check:\" (1 to 3 lines on what is relevant and how the plan accounts for it)."
        exit 1
      fi
      dir="$(git rev-parse --git-dir)/agent-ctx"; mkdir -p "$dir"
      printf '%s\n' "$said" > "$dir/said"
      echo "Recorded. $said"
      exit 0 ;;
  esac
  shift
done
me=$(git config user.email || echo "")
site=$(git remote get-url origin 2>/dev/null | sed -E 's#.*github\.com[:/]([^/]+)/([^/.]+)(\.git)?$#https://\1.github.io/\2#')

# Commits by anyone but me, with the files each touched
others() {
  git log --name-only --date=short --format='@@%ae|%h %an, %ad: %s' "$@" 2>/dev/null |
    awk -F'|' -v me="$me" '
      /^@@/ { show = (substr($1,3) != me); if (show) { n++; print "  " $2 }; next }
      NF && show { print "      " $0 }
      END { if (!n) print "  (none)" }'
}

echo "=============== CONTEXT BRIEF ($(date +%Y-%m-%d)) ==============="
if [ -n "$since" ] && git cat-file -e "$since^{commit}" 2>/dev/null; then
  echo "NEW FROM OTHERS since $(git rev-parse --short "$since"):"
  others "$since..HEAD"
else
  echo "RECENT WORK BY OTHERS (last 5 commits):"
  others -n 40 HEAD | awk '/^  [^ ]/{c++} c<=5'
fi

echo
echo "MEETINGS (computed from the repo):"
for d in meetings/*/; do
  m=${d%/}; [ -f "$m/index.html" ] || continue
  s=$(grep -o '<section[ >]' "$m/index.html" | wc -l | tr -d ' ')
  n=$( [ -f "$m/notes.html" ] && grep -o '<article class="note"' "$m/notes.html" | wc -l | tr -d ' ' || echo none)
  last=$(git log -1 --date=short --format='%ad %an: %s' -- "$m" 2>/dev/null)
  echo "  $(basename "$m"): $s slides, notes $n. Last change ${last:-uncommitted}. ${site:+$site/$m/}"
done

if [ -f docs/status.md ]; then
  echo
  echo "STATUS (docs/status.md, curated):"
  sed -n '/^## /,$p' docs/status.md | head -60 | sed 's/^/  /'
fi

if [ -f docs/agent-log.md ]; then
  echo
  echo "OPEN QUESTIONS (docs/agent-log.md):"
  awk '/^## Open questions/{f=1;next} /^<!--|^## [0-9]/{f=0} f && /^- /' docs/agent-log.md | sed 's/^/  /'
  if [ $short = 0 ]; then
    echo
    echo "RECENT LOG ENTRIES (newest 2, trimmed):"
    awk '/^## [0-9]{4}-/{c++} c>=1 && c<=2' docs/agent-log.md | head -50 | sed 's/^/  /'
  else
    echo
    echo "LOG ENTRY HEADINGS (newest 4; read docs/agent-log.md for detail):"
    grep -E '^## [0-9]{4}-' docs/agent-log.md | head -4 | sed 's/^/  /'
  fi
fi
echo "==============================================================="

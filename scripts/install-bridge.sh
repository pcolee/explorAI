#!/usr/bin/env bash
# Sets up this repo's coworking hooks on this machine, pinned to a copy you approve.
#
#   scripts/install-bridge.sh                  approve this clone's hooks and install the bridge
#   scripts/install-bridge.sh --words 'cole'   also engage the bridge on these words (regex alternation)
#   scripts/install-bridge.sh --uninstall      remove this repo's bridge and approved copy
#
# Run it yourself in a terminal (it asks you to confirm; an agent cannot). It:
#   1. copies the files the hooks run (scripts/hooks, sync.sh, context.sh, review.mjs, coworking.conf,
#      .claude) from this clone's HEAD to ~/.config/rcc-coworking/repos/<owner>-<repo>/, the approved copy
#   2. writes ~/.config/rcc-coworking/run (the launcher every hook goes through) and .../approve
#   3. adds this repo's bridge to ~/.claude/settings.json (backed up first), so its hooks also run in
#      Claude sessions started outside the repo; installing one repo's bridge never removes another's
# From then on, a pull that would change any of those files is held until you run
#   ~/.config/rcc-coworking/approve <repo>
# which shows exactly what changed and asks you. Part of the shared coworking kit.
set -euo pipefail
REPO=$(cd "$(dirname "$0")/.." && pwd -P)
words=""; mode=install
while [ $# -gt 0 ]; do
  case $1 in
    --words) words=${2:-}; shift ;;
    --uninstall) mode=uninstall ;;
    *) echo "usage: scripts/install-bridge.sh [--words 'a|b'] [--uninstall]"; exit 1 ;;
  esac
  shift
done
command -v python3 >/dev/null || { echo "install-bridge: python3 is required"; exit 1; }
HOME_DIR="$HOME/.config/rcc-coworking"
KEY=$(git -C "$REPO" remote get-url origin | sed -E 's#.*[:/]([^/]+)/([^/]+)$#\1-\2#; s#\.git$##')
TRUST="$HOME_DIR/repos/$KEY"
PROTECTED='scripts/hooks scripts/sync.sh scripts/context.sh scripts/review.mjs scripts/coworking.conf scripts/install-bridge.sh .claude'
LABEL=$KEY; [ -f "$REPO/scripts/coworking.conf" ] && LABEL=$(. "$REPO/scripts/coworking.conf"; echo "$LABEL")

if [ $mode = install ]; then
  [ -t 0 ] && [ -t 1 ] || { echo "install-bridge: run this yourself in a terminal. It asks you to confirm what this machine will run."; exit 1; }
  echo "These files from $REPO (HEAD $(git -C "$REPO" rev-parse --short HEAD)) will run automatically in Claude Code on this machine:"
  # shellcheck disable=SC2086
  git -C "$REPO" ls-tree -r --name-only HEAD -- $PROTECTED | sed 's/^/  /'
  echo "Last changed by: $(git -C "$REPO" log --format='%an' HEAD -- $PROTECTED | sort -u | paste -sd ', ' -)"
  read -r -p "Approve them? [y/N] " ok
  [ "$ok" = y ] || [ "$ok" = Y ] || { echo "Nothing installed."; exit 1; }
fi

mkdir -p "$HOME_DIR/repos"
# ---------- The launcher: every hook goes through it, and it only ever runs the approved copy.
cat > "$HOME_DIR/run" <<'RUN'
#!/usr/bin/env bash
# run <repo> <script under scripts/> [args]: runs the approved copy of a repo's coworking hook
# (~/.config/rcc-coworking/repos/<owner>-<repo>/). Installed by scripts/install-bridge.sh.
repo=$1; script=$2; shift 2
[ -d "$repo/.git" ] || [ -f "$repo/.git" ] || exit 0
case $script in hooks/*.sh|sync.sh) ;; *) exit 0 ;; esac
key=$(git -C "$repo" remote get-url origin 2>/dev/null | sed -E 's#.*[:/]([^/]+)/([^/]+)$#\1-\2#; s#\.git$##')
T="$HOME/.config/rcc-coworking/repos/$key"
if [ ! -x "$T/scripts/$script" ]; then
  [ "$script" = hooks/session-start.sh ] && echo "This repo's coworking hooks are not approved on this machine yet. In a terminal, run: $repo/scripts/install-bridge.sh"
  exit 0
fi
export COWORK_KIT="$T" COWORK_REPO="$repo"
cd "$repo" && exec "$T/scripts/$script" "$@"
RUN
# ---------- approve: a person reviews what changed upstream in the hook files, then this machine runs it.
cat > "$HOME_DIR/approve" <<'APPROVE'
#!/usr/bin/env bash
# approve <repo>: review the changes to a repo's auto-run files that a pull was held for, and approve
# them for this machine. Must be run by a person in a terminal. Installed by scripts/install-bridge.sh.
set -euo pipefail
repo=$(cd "${1:-.}" && git rev-parse --show-toplevel)
[ -t 0 ] && [ -t 1 ] || { echo "approve: run this yourself in a terminal; it asks you to confirm."; exit 1; }
key=$(git -C "$repo" remote get-url origin | sed -E 's#.*[:/]([^/]+)/([^/]+)$#\1-\2#; s#\.git$##')
T="$HOME/.config/rcc-coworking/repos/$key"
P='scripts/hooks scripts/sync.sh scripts/context.sh scripts/review.mjs scripts/coworking.conf scripts/install-bridge.sh .claude'
git -C "$repo" fetch -q origin main
new=$(git -C "$repo" rev-parse origin/main)
echo "Changes to files that run automatically on this machine, approved copy -> origin/main ($(git -C "$repo" rev-parse --short "$new")):"
changed=0
# shellcheck disable=SC2086
for f in $( (git -C "$repo" ls-tree -r --name-only "$new" -- $P; cd "$T" 2>/dev/null && find scripts .claude -type f 2>/dev/null) | sort -u); do
  a="$T/$f"; b=$(mktemp); git -C "$repo" show "$new:$f" > "$b" 2>/dev/null || : > "$b"
  if ! cmp -s "$a" "$b" 2>/dev/null; then changed=1; diff -u "$a" "$b" --label "approved/$f" --label "origin/main/$f" || true; fi
  rm -f "$b"
done
[ $changed = 1 ] || { echo "  (nothing changed)"; exit 0; }
echo; echo "Commits that touched them:"
# shellcheck disable=SC2086
git -C "$repo" log --format='  %h %an <%ae> %ad %s' --date=short "$(cat "$T/.approved" 2>/dev/null || echo "$new~20")..$new" -- $P 2>/dev/null | head -20 || true
read -r -p "Run these on this machine from now on? [y/N] " ok
[ "$ok" = y ] || [ "$ok" = Y ] || { echo "Not approved. Pulls stay held."; exit 1; }
tmp="$T.new"; rm -rf "$tmp"; mkdir -p "$tmp"
# shellcheck disable=SC2086
for f in $(git -C "$repo" ls-tree -r --name-only "$new" -- $P); do mkdir -p "$tmp/$(dirname "$f")"; git -C "$repo" show "$new:$f" > "$tmp/$f"; case $f in *.sh) chmod +x "$tmp/$f" ;; esac; done
echo "$new" > "$tmp/.approved"
rm -rf "$T.old"; [ -d "$T" ] && mv "$T" "$T.old"; mv "$tmp" "$T"; rm -rf "$T.old"
echo "Approved. The next pull goes through."
APPROVE
chmod +x "$HOME_DIR/run" "$HOME_DIR/approve"

settings="$HOME/.claude/settings.json"
mkdir -p "$HOME/.claude"; [ -f "$settings" ] || echo '{}' > "$settings"
cp "$settings" "$settings.bak-$KEY-bridge"

if [ $mode = install ]; then
  # ---------- The approved copy: this clone's committed files, exactly.
  tmp="$TRUST.new"; rm -rf "$tmp"; mkdir -p "$tmp"
  # shellcheck disable=SC2086
  for f in $(git -C "$REPO" ls-tree -r --name-only HEAD -- $PROTECTED); do mkdir -p "$tmp/$(dirname "$f")"; git -C "$REPO" show "HEAD:$f" > "$tmp/$f"; case $f in *.sh) chmod +x "$tmp/$f" ;; esac; done
  git -C "$REPO" rev-parse HEAD > "$tmp/.approved"
  rm -rf "$TRUST.old"; [ -d "$TRUST" ] && mv "$TRUST" "$TRUST.old"; mv "$tmp" "$TRUST"; rm -rf "$TRUST.old"
else
  rm -rf "$TRUST"
fi

python3 -I - "$settings" "$REPO" "$HOME_DIR/run" "$mode" "$words" <<'EOF'
import json, sys, shlex
path, repo, run, mode, words = sys.argv[1:6]
s = json.load(open(path))
hooks = s.setdefault("hooks", {})
# Drop this repo's earlier bridge entries (old style ran the repo's own bridge.sh; new style the launcher).
for ev in list(hooks):
    hooks[ev] = [m for m in hooks[ev] if not any(repo in h.get("command", "") for h in m.get("hooks", []))]
    if not hooks[ev]:
        del hooks[ev]
if mode == "install":
    env = f"COWORK_BRIDGE_WORDS={shlex.quote(words)} " if words else ""
    def entry(arg, matcher=None):
        m = {"hooks": [{"type": "command", "command": f"{env}{shlex.quote(run)} {shlex.quote(repo)} hooks/bridge.sh {arg}", "timeout": 45}]}
        if matcher: m["matcher"] = matcher
        return m
    hooks.setdefault("UserPromptSubmit", []).append(entry("prompt"))
    hooks.setdefault("PreToolUse", []).append(entry("edit", "Edit|Write|MultiEdit|NotebookEdit"))
    hooks.setdefault("PreToolUse", []).append(entry("bash", "Bash"))
    hooks.setdefault("Stop", []).append(entry("stop"))
open(path, "w").write(json.dumps(s, indent=2) + "\n")
EOF

if [ $mode = install ]; then
  echo "Approved and installed for $LABEL. Hooks now run the approved copy in $TRUST."
  echo "A pull that changes those files will be held; review and approve with: $HOME_DIR/approve $REPO"
else
  echo "Removed the $LABEL bridge and its approved copy."
fi
echo "Backup of your previous Claude settings: $settings.bak-$KEY-bridge. Takes effect in new Claude Code sessions."

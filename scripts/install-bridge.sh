#!/usr/bin/env bash
# Installs scripts/hooks/bridge.sh as a user-level Claude Code hook, so this repo's sync,
# Context gate, and /handoff reminder also run in sessions started outside the repo.
#   scripts/install-bridge.sh                  install (or reinstall) on this machine
#   scripts/install-bridge.sh --words 'cole'   also engage on these words (regex alternation)
#   scripts/install-bridge.sh --uninstall      remove it
# Edits ~/.claude/settings.json (backed up first). Safe to run again. Needs python3.
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
settings="$HOME/.claude/settings.json"
mkdir -p "$HOME/.claude"
[ -f "$settings" ] || echo '{}' > "$settings"
cp "$settings" "$settings.bak-explorai-bridge"

python3 -I - "$settings" "$REPO/scripts/hooks/bridge.sh" "$mode" "$words" <<'EOF'
import json, sys, shlex
path, script, mode, words = sys.argv[1:5]
s = json.load(open(path))
hooks = s.setdefault("hooks", {})
# Drop any earlier bridge entries (this repo's or an older copy), so reinstalling never duplicates.
for ev in list(hooks):
    hooks[ev] = [m for m in hooks[ev]
                 if not any("bridge.sh" in h.get("command", "") for h in m.get("hooks", []))]
    if not hooks[ev]:
        del hooks[ev]
if mode == "install":
    env = f"EXPLORAI_BRIDGE_WORDS={shlex.quote(words)} " if words else ""
    def entry(arg, matcher=None):
        m = {"hooks": [{"type": "command", "command": f"{env}{shlex.quote(script)} {arg}", "timeout": 45}]}
        if matcher: m["matcher"] = matcher
        return m
    hooks.setdefault("UserPromptSubmit", []).append(entry("prompt"))
    hooks.setdefault("PreToolUse", []).append(entry("edit", "Edit|Write|MultiEdit|NotebookEdit"))
    hooks.setdefault("PreToolUse", []).append(entry("bash", "Bash"))
    hooks.setdefault("Stop", []).append(entry("stop"))
open(path, "w").write(json.dumps(s, indent=2) + "\n")
EOF

if [ $mode = install ]; then
  echo "Installed: sessions started outside $REPO now run its hooks once they mention ExplorAI${words:+ or $words}."
else
  echo "Removed the ExplorAI bridge hooks."
fi
echo "Backup of your previous settings: $settings.bak-explorai-bridge. Takes effect in new Claude Code sessions."

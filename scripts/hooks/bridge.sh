#!/usr/bin/env bash
# User-level hook (installed by scripts/install-bridge.sh) that runs this repo's own hooks
# for Claude sessions started OUTSIDE the repo. Project hooks only load when Claude starts
# inside it, so without this a session started from your home folder never pulls or hands off.
# Does nothing in sessions started inside the repo, and nothing until a session "engages":
# a prompt names this repo (BRIDGE_WORDS in scripts/coworking.conf, plus any in COWORK_BRIDGE_WORDS),
# or an edit lands in a repo file. Each repo that uses the coworking kit installs its own copy. After that: pull every prompt, the Context gate on edits
# and commits, the push guard, and the Stop-hook handoff reminder.
#   bridge.sh prompt|edit|bash|stop
# The launcher (~/.config/rcc-coworking/run) passes the repo and the approved copy of the kit.
REPO=${COWORK_REPO:-$(cd "$(dirname "$0")/../.." && pwd -P)} || exit 0
KIT=${COWORK_KIT:-$REPO}
H="$KIT/scripts/hooks"
LABEL="this repo"; BRIDGE_WORDS=""
[ -f "$KIT/scripts/coworking.conf" ] && . "$KIT/scripts/coworking.conf"
input=$(cat)
flat=$(printf '%s' "$input" | tr '\n' ' ')
jfield() { printf '%s' "$flat" | sed -nE "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"(([^\"\\\\]|\\\\.)*)\".*/\\1/p"; }
real() { (cd "$1" 2>/dev/null && pwd -P) || printf '%s' "$1"; }
inrepo() { case "$1/" in "$REPO"/*) return 0 ;; esac; return 1; }

# Started inside the repo: its own hooks are loaded. (cwd can move later; the start dir cannot.)
start=${CLAUDE_PROJECT_DIR:-$(jfield cwd)}
inrepo "$(real "$start")" && exit 0

sid=$(jfield session_id); [ -n "$sid" ] || exit 0
mark="${TMPDIR:-/tmp}/cowork-bridge/$(printf '%s' "$REPO" | cksum | cut -d' ' -f1)/$sid"
run() { printf '%s' "$input" | CLAUDE_PROJECT_DIR="$REPO" COWORK_KIT="$KIT" "$H/$1" "${@:2}"; }

engage() {
  [ -f "$mark" ] && return
  mkdir -p "$(dirname "$mark")" && : > "$mark"
  echo "This session is working on $LABEL ($REPO) from outside it, so its project hooks are bridged in. Its CLAUDE.md rules apply in full (Context rule, Sync, /handoff): read $REPO/CLAUDE.md before building. The /handoff skill is not loaded here; follow $REPO/.claude/skills/handoff/SKILL.md. Run repo commands from the repo (cd $REPO && scripts/sync.sh push)."
  [ -f "$REPO/local-docs/STATUS.md" ] && echo "Private notes on this machine (never committed): $REPO/local-docs/STATUS.md."
  run session-start.sh
}

words=${BRIDGE_WORDS:-$(basename "$REPO")}${COWORK_BRIDGE_WORDS:+"|$COWORK_BRIDGE_WORDS"}${EXPLORAI_BRIDGE_WORDS:+"|$EXPLORAI_BRIDGE_WORDS"}
case "$1" in
  prompt)
    if [ -f "$mark" ]; then
      (cd "$REPO" && "$KIT/scripts/sync.sh" pull --quiet --hook)
    elif jfield prompt | grep -qiE "(^|[^a-z])($words)([^a-z]|$)"; then
      engage
    fi ;;
  edit)
    fp=$(jfield file_path); [ -n "$fp" ] || fp=$(jfield notebook_path)
    case "$fp" in "$REPO"/local-docs/*) exit 0 ;; "$REPO"/*) ;; *) exit 0 ;; esac
    engage >&2
    run context-gate.sh edit; exit $? ;;
  bash)
    cmdline=$(jfield command)
    # A command that runs in another folder (a leading cd <dir>, or git -C <dir>) belongs to that folder.
    there=$(printf '%s' "$cmdline" | sed -nE 's/^[[:space:]]*cd[[:space:]]+("([^"]+)"|([^;&| ]+)).*/\2\3/p')
    [ -n "$there" ] || there=$(printf '%s' "$cmdline" | sed -nE 's/.*git[[:space:]]+-C[[:space:]]+("([^"]+)"|([^ ]+)).*/\2\3/p')
    if [ -n "$there" ]; then
      case "$there" in "~"*) there="$HOME${there#\~}" ;; /*) ;; *) there="$(jfield cwd)/$there" ;; esac
      inrepo "$(real "$there")" || exit 0
    else
      inrepo "$(real "$(jfield cwd)")" || printf '%s' "$cmdline" | grep -qF "$REPO" || exit 0
    fi
    run guard-git.sh; exit $? ;;
  stop)
    [ -f "$mark" ] || exit 0
    run stop-check.sh; exit $? ;;
esac
exit 0

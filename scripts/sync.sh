#!/usr/bin/env bash
# Keeps every collaborator's clone on top of origin/main.
#   scripts/sync.sh pull [--quiet] [--hook]   rebase local work onto origin/main, report what came in
#   scripts/sync.sh push                      pull, run scripts/check.sh, push to main (retries if someone pushed first)
#   scripts/sync.sh status                    ahead/behind and the latest commits on origin/main
# --quiet prints nothing when already up to date. --hook always exits 0 so a Claude Code hook never blocks the session.
set -uo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "sync: not inside a git repo"; exit 1; }
export GIT_TERMINAL_PROMPT=0
BRANCH=main
cmd=${1:-status}; shift || true
quiet=0; hook=0
for a in "$@"; do case $a in --quiet) quiet=1 ;; --hook) hook=1 ;; esac; done

die() { echo "$1"; [ $hook = 1 ] && exit 0; exit 1; }

fetch() {
  git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=10 fetch --quiet origin "$BRANCH" 2>/dev/null
}

pull() {
  if [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]; then
    die "SYNC BLOCKED: a rebase is in progress. Resolve it (git status) or run 'git rebase --abort', then sync again. Do not edit other files until this is fixed."
  fi
  local cur; cur=$(git branch --show-current)
  if ! fetch; then
    echo "SYNC WARNING: could not reach GitHub. Working from the local copy; pull again before pushing."
    return 0
  fi
  if [ "$cur" != "$BRANCH" ]; then
    echo "SYNC WARNING: on branch '$cur', not '$BRANCH'. origin/$BRANCH is $(git rev-list --count HEAD..origin/$BRANCH) commit(s) ahead of this branch. This repo works on $BRANCH directly."
    return 0
  fi
  local incoming; incoming=$(git log --format='  %h %an, %ar: %s' HEAD..origin/$BRANCH)
  if [ -z "$incoming" ]; then
    [ $quiet = 1 ] || echo "Sync: up to date with origin/$BRANCH ($(git rev-parse --short origin/$BRANCH))."
    return 0
  fi
  local files; files=$(git diff --name-only HEAD...origin/$BRANCH)
  local stashes_before; stashes_before=$(git stash list | wc -l)
  if ! git rebase --autostash --quiet "origin/$BRANCH" >/dev/null 2>&1; then
    git rebase --abort >/dev/null 2>&1
    die "SYNC CONFLICT: your local commits conflict with new commits on origin/$BRANCH. Nothing was changed. Stop and tell the user; do not force-push or reset. Incoming:
$incoming"
  fi
  echo "Sync: pulled $(printf '%s\n' "$incoming" | wc -l | tr -d ' ') new commit(s) from origin/$BRANCH:"
  echo "$incoming"
  echo "Files changed upstream: $(echo $files)"
  if [ "$(git stash list | wc -l)" -gt "$stashes_before" ]; then
    echo "SYNC WARNING: your uncommitted edits overlapped the incoming changes and were kept in 'git stash list' (top entry). Tell the user before running 'git stash pop'."
  fi
  if printf '%s\n' "$files" | grep -qx 'docs/agent-log.md'; then
    echo "docs/agent-log.md changed. Newest entries:"
    grep -E '^## [0-9]{4}-' docs/agent-log.md | head -3 | sed 's/^/  /'
  fi
}

push() {
  [ "$(git branch --show-current)" = "$BRANCH" ] || die "PUSH REFUSED: switch to $BRANCH first. This repo works on $BRANCH directly."
  local tries=0
  while [ $tries -lt 3 ]; do
    tries=$((tries+1))
    pull || exit 1
    [ -d .git/rebase-merge ] && exit 1
    if [ -z "$(git rev-list origin/$BRANCH..HEAD)" ]; then
      echo "Push: nothing to push (no local commits ahead of origin/$BRANCH)."
      break
    fi
    scripts/check.sh || die "PUSH REFUSED: scripts/check.sh failed. Fix the problems above, commit, and push again."
    local range; range=$(git log --format='  %h %s' origin/$BRANCH..HEAD)
    if git push --quiet origin "HEAD:$BRANCH" 2>/tmp/sync-push-err.$$; then
      echo "Pushed to origin/$BRANCH (live on GitHub Pages in about a minute):"
      echo "$range"
      rm -f /tmp/sync-push-err.$$
      break
    fi
    if grep -qiE 'rejected|fetch first|non-fast-forward' /tmp/sync-push-err.$$; then
      echo "Push: someone pushed first. Pulling and retrying ($tries/3)."
      continue
    fi
    cat /tmp/sync-push-err.$$; rm -f /tmp/sync-push-err.$$
    die "PUSH FAILED (not a race). Tell the user."
  done
  local dirty; dirty=$(git status --porcelain)
  [ -n "$dirty" ] && printf 'Note: not pushed because not committed:\n%s\n' "$dirty"
  return 0
}

status() {
  fetch || echo "(offline: showing last known origin/$BRANCH)"
  echo "Branch $(git branch --show-current): $(git rev-list --count origin/$BRANCH..HEAD) ahead, $(git rev-list --count HEAD..origin/$BRANCH) behind origin/$BRANCH."
  git log --format='  %h %an, %ar: %s' -5 "origin/$BRANCH"
}

case $cmd in
  pull) pull; rc=$? ;;
  push) push; rc=$? ;;
  status) status; rc=$? ;;
  *) echo "usage: scripts/sync.sh pull [--quiet] [--hook] | push | status"; rc=1 ;;
esac
[ $hook = 1 ] && exit 0
exit $rc

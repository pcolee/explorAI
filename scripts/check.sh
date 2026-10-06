#!/usr/bin/env bash
# Pre-push checks. scripts/sync.sh push runs this; run it by hand any time.
# Fails on things that break a live deck or leak data. Warns on known cosmetic issues.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

fail=(); warn=()

# Merge leftovers anywhere in tracked files
if hits=$(git grep -nE '^(<<<<<<<|>>>>>>>)( |$)' -- . 2>/dev/null) && [ -n "$hits" ]; then
  fail+=("conflict markers left in: $(printf '%s\n' "$hits" | cut -d: -f1 | sort -u | tr '\n' ' ')")
fi

# Public repo: no email addresses in tracked text (ignore inline base64 data and the scripts that hold this pattern)
if hits=$(git grep -nIoE '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}' -- . ':!scripts/' ':!*.js' 2>/dev/null | grep -v 'noreply' ) && [ -n "$hits" ]; then
  fail+=("email address in a tracked file (repo is public): $(printf '%s\n' "$hits" | head -3 | tr '\n' ' ')")
fi

keys=""
for dir in meetings/*/; do
  m=${dir%/}; deck="$m/index.html"; notes="$m/notes.html"
  [ -f "$deck" ] || continue
  slides=$(grep -o '<section[ >]' "$deck" | wc -l | tr -d ' ')

  if grep -qE '\{\{[A-Z_]+\}\}' "$deck" "$notes" 2>/dev/null; then
    fail+=("$m: unfilled {{PLACEHOLDER}} left in the deck or notes")
  fi
  # Local files the deck loads (scripts, images) must exist and be committed
  for ref in $(grep -oE '(src|href)="[^"#:]+"' "$deck" | sed -E 's/^(src|href)="//; s/"$//' | sort -u); do
    [ -f "$m/$ref" ] || fail+=("$m: index.html loads '$ref' but $m/$ref does not exist")
  done
  if grep -qE "[‘’]Fraunces[‘’]|[‘’]DM Sans[‘’]" "$deck"; then
    warn+=("$m: curly-quoted font name in index.html renders in a fallback font (see CLAUDE.md)")
  fi

  if [ -f "$notes" ]; then
    cards=$(grep -o '<article class="note"' "$notes" | wc -l | tr -d ' ')
    n=$(grep -oE 'var N=[0-9]+' "$notes" | head -1 | grep -oE '[0-9]+')
    if [ "$slides" != "$cards" ] || [ "${n:-x}" != "$slides" ]; then
      fail+=("$m: deck has $slides slides, notes have $cards cards, notes script says N=${n:-missing}. All three must match.")
    fi
    if grep -q 'shared/presenter.js' "$deck"; then
      bridges=$(grep -o '<p class="bridge">' "$notes" | wc -l | tr -d ' ')
      [ "$bridges" -ge $((cards - 1)) ] || fail+=("$m: deck loads the presenter but only $bridges of $((cards - 1)) notes cards have a <p class=\"bridge\"> line (every card but the last needs one)")
      grep -q '__explorDeck' "$deck" || fail+=("$m: deck loads the presenter but does not define window.__explorDeck (see meetings/shared/explorai-presenter.js)")
    fi
    key=$(grep -oE "localStorage\.getItem\('[^']+'\)" "$notes" | head -1 | sed -E "s/.*\('//; s/'\)//")
    if [ -n "$key" ]; then
      if printf '%s\n' "$keys" | grep -qx "$key"; then
        fail+=("$m: notes reuse localStorage key '$key' from another meeting; give each meeting its own (m3-cur, m4-cur, ...)")
      fi
      keys="$keys
$key"
    fi
  else
    warn+=("$m: no notes.html yet")
  fi
done

for w in "${warn[@]+"${warn[@]}"}"; do echo "check warning: $w"; done
if [ ${#fail[@]} -gt 0 ]; then
  for f in "${fail[@]}"; do echo "check FAILED: $f"; done
  exit 1
fi
echo "check: ok"

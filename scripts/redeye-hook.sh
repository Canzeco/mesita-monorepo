#!/usr/bin/env bash
# scripts/redeye-hook.sh — Claude Code's UserPromptSubmit hook: a prompt that BEGINS with
# `activate Redeye` hands the session the protocol, on every platform that runs this hook.
#
# Rules §0 already tells every agent what the phrase means; this hook is why it cannot be missed.
# Whatever a hook prints on stdout becomes context for the turn, so the protocol arrives in the
# same turn as the words that summoned it. It also arms mode 5 for the NEXT session
# (`deno task redeye`, 24 h): the running session's permission mode is the picker's, which
# nothing in a repo can flip.
#
# Only the first non-empty line of the prompt counts (`redeye.ts --match` decides). Task
# notifications, subagent reports and pasted files reach this hook as user turns too, and any of
# them can quote the phrase; matching it anywhere once armed the bypass from a report about this
# very bug.
#
# Anything else: silence, exit 0. A hook that prints on every turn is noise, and noise is how a
# card stops being read.

set -u

input=$(cat)
# Cheap prefilter, so an ordinary turn never starts deno.
printf '%s' "$input" | grep -qi 'activate redeye' || exit 0

here="$(cd "$(dirname "$0")" && pwd -P)"
top=$(git -C "$here" rev-parse --show-toplevel 2>/dev/null) || top="$here/.."

# 0 = the prompt begins with the phrase, 10 = it does not, anything else = could not judge.
verdict=127
if command -v deno >/dev/null 2>&1; then
  printf '%s' "$input" | (cd "$top" && deno run --quiet --config "$top/deno.json" --allow-read scripts/redeye.ts --match)
  verdict=$?
fi

case "$verdict" in
  0)
    if (cd "$top" && deno task --quiet redeye >/dev/null 2>&1); then
      echo "redeye: armed for the next session for 24 h (this one keeps the picker's mode)"
    else
      echo "redeye: could not arm the next session; run deno task redeye by hand" >&2
    fi
    ;;
  10)
    exit 0
    ;;
  *)
    # Deno is missing or failed. Judge the prompt's opening by hand rather than ignore Pato, but
    # never arm without the real check.
    printf '%s' "$input" | grep -qiE '"prompt"[[:space:]]*:[[:space:]]*"([[:space:]]|\\[nrt])*activate redeye' || exit 0
    echo "redeye: could not arm (deno missing or failed, exit $verdict); run deno task redeye by hand" >&2
    ;;
esac

echo "REDEYE ACTIVATED — the prompt began with \`activate Redeye\`. This is the protocol; it is on until Pato says stop."
echo
cat "$here/redeye.md"

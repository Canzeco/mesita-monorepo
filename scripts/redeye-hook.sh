#!/usr/bin/env bash
# scripts/redeye-hook.sh — Claude Code's UserPromptSubmit hook: the phrase `activate Redeye`
# in a prompt hands the session the protocol, on every platform that runs this hook (desktop,
# cloud, Conductor's inner Claude Code).
#
# Rules §0 already tells every agent what the phrase means; this hook is why it cannot be missed.
# Whatever a hook prints on stdout becomes context for the turn, so the protocol arrives in the
# same turn as the words that summoned it, not in a file the agent may or may not open. It also
# arms mode 5 for the NEXT session (`deno task redeye`): the running session's permission mode is
# the picker's, which nothing in a repo can flip — Pato sets it to Bypass himself.
#
# Anything else in the prompt: silence, exit 0. A hook that prints on every turn is noise, and
# noise is how a card stops being read.

set -u

input=$(cat)
# The prompt is JSON-escaped; the phrase has no characters escaping touches, so a plain
# case-insensitive grep on the raw payload is the whole parser.
printf '%s' "$input" | grep -qi 'activate redeye' || exit 0

here="$(cd "$(dirname "$0")" && pwd -P)"
top=$(git -C "$here" rev-parse --show-toplevel 2>/dev/null) || top="$here/.."

if command -v deno >/dev/null 2>&1; then
  (cd "$top" && deno task --quiet redeye >/dev/null 2>&1) && echo "redeye: armed for the next session (this one keeps the picker's mode)"
fi

echo "REDEYE ACTIVATED — Pato said the words. This is the protocol; it is on until he says stop."
echo
cat "$here/redeye.md"

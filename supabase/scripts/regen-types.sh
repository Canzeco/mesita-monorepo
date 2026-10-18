#!/usr/bin/env bash
#
# Regenerate the committed `database.types.ts` for every app that keeps one,
# from the LINKED project's live schema — no db push, no deploy.
#
# deploy.sh runs it after its repair push. Run it on its own whenever the
# linked project's schema changes some other way (the integration applying a
# merged migration), so the committed types match the live schema:
#
#   ./scripts/regen-types.sh
#
# The CLI is the source of truth for these files. If it hangs on a non-TTY run
# (it has, historically), the Supabase MCP `generate_typescript_types` tool is
# the fallback — but it emits the PUBLIC schema only, so its output drops the
# `graphql_public` block and the empty `Constants.graphql_public` entry that
# the CLI emits: 29 lines that would silently come back the next time anyone
# ran this script. Verified 2026-09-15 (MESITA-1895). If you must use the MCP
# tool, diff its output against the committed file first and restore that block
# by regenerating with the CLI rather than by hand.

set -euo pipefail

PROJECT_REF="yjalywfzdelacdzccpgb"

# Every app that keeps a committed types file (web-admin and web-landing keep
# none). deploy.sh calls this script, so this list is the only one.
WEB_REPOS=(
  "../apps/web-consumer"
)

cd "$(dirname "$0")/.."

echo "▶ Linking to project ${PROJECT_REF} ..."
supabase link --project-ref "${PROJECT_REF}"

for repo in "${WEB_REPOS[@]}"; do
  target="$repo/src/lib/supabase/database.types.ts"
  if [ -d "$repo" ] && [ -f "$target" ]; then
    echo "▶ Regenerating $target"
    supabase gen types typescript --linked < /dev/null > "$target" 2>/dev/null
  else
    echo "⚠ Skipping $repo (path or types file not found)"
  fi
done

echo ""
echo "OK Types regenerated. Now: cd into each app and run its typecheck/lint/build to chase any fallout."

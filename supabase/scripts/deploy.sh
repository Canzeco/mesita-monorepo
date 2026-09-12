#!/usr/bin/env bash
#
# Apply pending migrations to the linked Supabase project and
# regenerate TypeScript types into @mesita/supabase-contract (mesita monorepo).
#
# Run from the supabase/ package root (mesita-monorepo):
#   ./scripts/deploy.sh
#
# Edge Functions are deployed individually (or via `supabase functions
# deploy <name>`) when their code actually changes — we don't redeploy
# every EF (~137 folders) on every push. The deploy step lives in CI /
# per-EF commits.

set -euo pipefail

PROJECT_REF="yjalywfzdelacdzccpgb"

cd "$(dirname "$0")/.."

# Supabase CLI reads project-root .env for config.toml env(TWILIO_*).
bash scripts/sync-root-env.sh

echo "▶ Linking to project ${PROJECT_REF} ..."
supabase link --project-ref "${PROJECT_REF}"

if [[ "${SKIP_DB_PUSH:-}" == "1" ]]; then
  echo "▶ Skipping db push (SKIP_DB_PUSH=1)"
else
echo "▶ Pushing pending migrations ..."
if ! supabase db push --include-all; then
  echo ""
  echo "⚠ db push failed (migration history drift)."
  echo "  If production schema is already correct, run once:"
  echo "    ./scripts/sync-migration-history.sh"
  echo "  Then re-run ./scripts/deploy.sh"
  echo "  Or skip push and only regen types: SKIP_DB_PUSH=1 ./scripts/deploy.sh"
  exit 1
fi
fi

# Types are copied into each app package that keeps a generated
# `database.types.ts` (web-admin / web-landing / web-validate / mobile do not).
# See regen-types.sh — same step, callable on its own after a cloud-side
# migration that didn't go through this script (e.g. Supabase MCP
# `apply_migration`), so types don't drift between deploys (MESITA-1546).
bash scripts/regen-types.sh

echo ""
echo "OK Deploy complete."

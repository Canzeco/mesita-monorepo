#!/usr/bin/env bash
#
# Apply pending migrations to the linked Supabase project and regenerate the
# committed TypeScript types (regen-types.sh).
#
# Since MESITA-2075 a merge to main applies migrations on its own: the
# Supabase GitHub integration (Deploy to production, working dir `supabase`)
# runs them. This script is the REPAIR path for a failed integration run,
# plus the type regen a PR still owes.
#
# Run from the supabase/ package root (mesita-monorepo):
#   ./scripts/deploy.sh
#
# Edge Functions are not this script's job: the integration deploys every
# function declared in config.toml on each push to main, and
# .github/workflows/supabase-deploy.yml deletes the retired ones.

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
  echo "⚠ db push failed. Read the error above before retrying; to compare the"
  echo "  migration history with the files: supabase migration list --linked"
  echo "  Or skip push and only regen types: SKIP_DB_PUSH=1 ./scripts/deploy.sh"
  exit 1
fi
fi

# Types are copied into each app package that keeps a generated
# `database.types.ts` (regen-types.sh lists them). regen-types.sh is the same
# step on its own, for a schema change this script did not make.
bash scripts/regen-types.sh

echo ""
echo "OK Deploy complete."

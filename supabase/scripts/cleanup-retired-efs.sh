#!/usr/bin/env bash
#
# Delete the Edge Functions that are still in the cloud after their folder
# left main.
#
# Deploying only ever adds: neither the Supabase GitHub integration nor
# `supabase functions deploy` deletes a function whose folder is gone, so it
# stays callable until something deletes its slug. This script is that
# something. .github/workflows/supabase-deploy.yml runs it on main after every
# merge that touches functions, and once a week.
#
# A cloud slug is deleted only when all of these hold:
#   · origin/main, fetched at run time, has no folder for it under
#     supabase/supabase/functions/ (a stale checkout cannot delete a live one);
#   · the commit that deleted the folder is at least 3 days old: the rollback
#     window, so reverting a deletion finds the function still deployed;
#   · origin/main still has at least 30 folders (a moved or empty tree is an
#     error, never "every function is retired");
#   · no more than MAX_DELETE slugs (default 5) qualify in this run.
# A cloud slug whose folder never existed on origin/main is reported, never
# deleted: it was deployed outside a merge. Right before each delete the
# script fetches origin/main again and skips a slug whose folder came back.
#
# Usage, from anywhere in the repo (needs git, jq, the supabase CLI, and
# SUPABASE_ACCESS_TOKEN or `supabase login`):
#   supabase/scripts/cleanup-retired-efs.sh --dry-run    # print, delete nothing
#   MAX_DELETE=7 supabase/scripts/cleanup-retired-efs.sh
#
# In CI it also appends to $GITHUB_STEP_SUMMARY and writes each deleted slug
# to $CLEANUP_DELETED_FILE, which the workflow posts on the commit.
# Exit codes: 0 done or nothing to do · 1 refused or failed · 2 bad usage.

set -euo pipefail

PROJECT_REF="yjalywfzdelacdzccpgb"
FUNCTIONS_PATH="supabase/supabase/functions"
GRACE_HOURS=72
MIN_FOLDERS=30
MAX_DELETE="${MAX_DELETE:-5}"

say() { printf 'cleanup: %s\n' "$*"; }

summary() {
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    printf '%s\n' "$*" >>"$GITHUB_STEP_SUMMARY"
  fi
}

die() {
  printf 'cleanup: %s\n' "$*" >&2
  summary "cleanup refused: $*"
  exit 1
}

qualify_line() {
  if [ "$1" -eq 1 ]; then echo "1 slug qualifies"; else echo "$1 slugs qualify"; fi
}

dry_run=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=1 ;;
    *)
      echo "usage: $0 [--dry-run]   (MAX_DELETE=<n> raises the cap of 5)" >&2
      exit 2
      ;;
  esac
done
case "$MAX_DELETE" in
  '' | *[!0-9]*)
    echo "cleanup: MAX_DELETE must be a whole number, got '$MAX_DELETE'" >&2
    exit 2
    ;;
esac

for tool in git jq supabase; do
  command -v "$tool" >/dev/null || die "$tool is not on PATH"
done

root=$(git rev-parse --show-toplevel) || die "run it from inside the repo"
if [ "$(git -C "$root" rev-parse --is-shallow-repository)" = true ]; then
  die "$root is a shallow clone; deletion dates need the whole history (actions/checkout fetch-depth: 0)"
fi

git -C "$root" fetch --quiet origin main || die "git fetch origin main failed"
tree=$(git -C "$root" ls-tree -d --name-only "origin/main:$FUNCTIONS_PATH") ||
  die "origin/main has no $FUNCTIONS_PATH; if the functions moved, update FUNCTIONS_PATH in this script"
folders=$(printf '%s\n' "$tree" | awk 'NF && $0 != "_shared"' | LC_ALL=C sort)
folder_count=$(printf '%s\n' "$folders" | awk 'NF' | wc -l | tr -d ' ')
if [ "$folder_count" -lt "$MIN_FOLDERS" ]; then
  die "origin/main has $folder_count function folders under $FUNCTIONS_PATH (floor $MIN_FOLDERS); nothing deleted. If that count is right, lower MIN_FOLDERS in this script"
fi

listing=$(cd "$root/supabase" && supabase functions list --project-ref "$PROJECT_REF" -o json) ||
  die "supabase functions list failed"
cloud=$(printf '%s' "$listing" | jq -r 'if type == "array" then .[].slug else error("not a list") end') ||
  die "supabase functions list did not print a JSON list"
cloud=$(printf '%s\n' "$cloud" | awk 'NF' | LC_ALL=C sort)
bad=$(printf '%s\n' "$cloud" | awk 'NF && !/^[A-Za-z0-9][A-Za-z0-9_-]*$/')
[ -z "$bad" ] || die "unexpected slug in the functions list: $bad"
say "origin/main has $folder_count function folders; the cloud has $(printf '%s\n' "$cloud" | awk 'NF' | wc -l | tr -d ' ') functions"

now=$(date +%s)
qualifying=""
count=0
for slug in $cloud; do
  # Whole-line, fixed-string match: a slug never matches part of another.
  if grep -Fxq -- "$slug" <<<"$folders"; then continue; fi
  deleted_at=$(git -C "$root" log -1 --no-renames --diff-filter=D --format=%ct origin/main -- "$FUNCTIONS_PATH/$slug") ||
    die "git log failed for $slug"
  if [ -z "$deleted_at" ]; then
    say "skip $slug: in the cloud, but origin/main never had its folder; not deleted"
    summary "- skipped \`$slug\`: origin/main never had its folder"
    continue
  fi
  age_hours=$(((now - deleted_at) / 3600))
  if [ "$age_hours" -lt "$GRACE_HOURS" ]; then
    say "wait $slug: its folder was deleted ${age_hours}h ago; deletable after ${GRACE_HOURS}h"
    continue
  fi
  qualifying="$qualifying $slug"
  count=$((count + 1))
done
qualifying="${qualifying# }"

say "$(qualify_line "$count")${qualifying:+: $qualifying}"
if [ "$count" -gt "$MAX_DELETE" ]; then
  cap="$(qualify_line "$count") (cap $MAX_DELETE): $qualifying. Run --dry-run, then rerun with max_delete=$count via workflow_dispatch"
  if [ "$dry_run" -eq 1 ]; then
    say "a real run refuses this: $cap"
  else
    die "$cap"
  fi
fi
if [ "$dry_run" -eq 1 ]; then
  say "dry run: nothing deleted"
  exit 0
fi

deleted=0
for slug in $qualifying; do
  git -C "$root" fetch --quiet origin main ||
    die "fetching origin/main again failed; $slug and every slug after it not deleted"
  if git -C "$root" cat-file -e "origin/main:$FUNCTIONS_PATH/$slug" 2>/dev/null; then
    say "skip $slug: its folder is back on origin/main; not deleted"
    continue
  fi
  if out=$(cd "$root/supabase" && supabase functions delete "$slug" --project-ref "$PROJECT_REF" --yes 2>&1); then
    say "deleted $slug"
    summary "- deleted \`$slug\`"
    if [ -n "${CLEANUP_DELETED_FILE:-}" ]; then
      printf '%s\n' "$slug" >>"$CLEANUP_DELETED_FILE"
    fi
    deleted=$((deleted + 1))
  elif grep -q "does not exist" <<<"$out"; then
    # The registry can list a function whose blob is already gone; that is
    # the goal state, not a failure.
    say "$slug was already gone"
  else
    printf '%s\n' "$out" >&2
    die "deleting $slug failed"
  fi
done
say "deleted $deleted of $count"
summary "cleanup: deleted $deleted of $count"

#!/usr/bin/env bash
# sync-agents.sh — make the live ElevenLabs reservation agents match this
# checkout (MESITA-3968). Run by .github/workflows/agents-deploy.yml after a
# merge; also runnable by hand with the Supabase CLI logged in.
#
#   1. Hash what this checkout would push (specHash in _shared/reservationist).
#   2. Wait until the DEPLOYED sync function answers the same hash: the
#      Supabase integration deploys a few minutes after the push to main.
#   3. Run the sync: fleet → knowledge → workflows → tests → inspect. Any
#      failure, or inspect not in sync, fails the script.
#   4. Run the simulated-call tests and report them. A failed test is
#      reported, never a failure of the script: the agents are deployed.
#
# Needs: supabase CLI (logged in, or SUPABASE_ACCESS_TOKEN), deno, jq, curl.
# Never prints the service key.

set -euo pipefail

PROJECT_REF="${PROJECT_REF:-yjalywfzdelacdzccpgb}"
WAIT_SECS="${WAIT_SECS:-1500}"
TEST_WAIT_SECS="${TEST_WAIT_SECS:-600}"
FN_URL="https://${PROJECT_REF}.supabase.co/functions/v1/supabase-edgefunc-sync-reservationist"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"

here="$(cd "$(dirname "$0")" && pwd)"
fns="$here/../supabase/functions"

want=$(cd "$fns" && deno eval --quiet 'import { specHash } from "./_shared/reservationist/index.ts"; console.log(await specHash())')
echo "main spec: $want"

key=$(supabase projects api-keys --project-ref "$PROJECT_REF" -o json \
  | jq -r '[.[] | select(.name == "service_role")][0].api_key // empty')
if [ -z "$key" ]; then
  echo "::error::no service_role key for $PROJECT_REF"
  exit 1
fi
[ -n "${GITHUB_ACTIONS:-}" ] && echo "::add-mask::$key"

call() {
  curl -sS --max-time 170 -X POST "$FN_URL" \
    -H "Authorization: Bearer $key" \
    -H "Content-Type: application/json" \
    -H "X-Internal-Caller: github-agents-deploy" \
    -d "$1"
}

# ── 2. Wait for the deploy ──────────────────────────────────────────────────
deadline=$((SECONDS + WAIT_SECS))
while :; do
  got=$(call '{"mode":"version"}' | jq -r '.spec_hash // empty' 2>/dev/null || true)
  if [ "$got" = "$want" ]; then
    echo "deployed spec matches main"
    break
  fi
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "::error::the deployed sync still answers '${got:-no version}' after ${WAIT_SECS}s; main is $want"
    exit 1
  fi
  echo "deployed spec '${got:-no version}' — waiting for the Supabase deploy"
  sleep 30
done

# ── 3. Sync ─────────────────────────────────────────────────────────────────
{
  echo "## ElevenLabs agents"
  echo
  echo "| Step | Result |"
  echo "|---|---|"
} >>"$SUMMARY"
for mode in fleet knowledge workflows tests inspect; do
  out=$(call "{\"mode\":\"$mode\"}")
  ok=$(echo "$out" | jq -r '.ok // false' 2>/dev/null || echo false)
  if [ "$mode" = "inspect" ]; then
    ok=$(echo "$out" | jq -r '.in_sync // false' 2>/dev/null || echo false)
  fi
  echo "| $mode | $([ "$ok" = "true" ] && echo ok || echo FAILED) |" >>"$SUMMARY"
  if [ "$ok" != "true" ]; then
    echo "::error::sync mode $mode failed"
    echo "$out" | head -c 3000
    echo
    exit 1
  fi
  echo "$mode: ok"
done

# ── 4. Simulated-call tests ─────────────────────────────────────────────────
runs=$(call '{"mode":"run_tests"}')
ids=$(echo "$runs" | jq -c '[.runs[]? | select(.invocation_id) | .invocation_id]')
if [ "$ids" = "[]" ] || [ -z "$ids" ]; then
  echo "::warning::the tests did not start: $(echo "$runs" | head -c 600)"
  exit 0
fi
deadline=$((SECONDS + TEST_WAIT_SECS))
while :; do
  res=$(call "{\"mode\":\"test_results\",\"invocation_ids\":$ids}")
  pending=$(echo "$res" | jq '[.invocations[]?.pending // 0] | add // 0')
  [ "$pending" = "0" ] && break
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "::warning::$pending test(s) still running after ${TEST_WAIT_SECS}s"
    break
  fi
  sleep 20
done
passed=$(echo "$res" | jq '[.invocations[]?.passed // 0] | add // 0')
failed=$(echo "$res" | jq '[.invocations[]?.failed // 0] | add // 0')
echo "tests: $passed passed, $failed failed"
{
  echo
  echo "### Simulated calls: $passed passed, $failed failed"
  echo
  echo "| Test | Result | Why |"
  echo "|---|---|---|"
  echo "$res" | jq -r '.invocations[]?.runs[]? | "| \(.test // "?") | \(.status // "?") | \((.why // "") | gsub("\\|"; "/") | gsub("\n"; " ")) |"'
} >>"$SUMMARY"
if [ "$failed" != "0" ]; then
  echo "::warning::$failed simulated-call test(s) failed; see the job summary"
fi

#!/usr/bin/env bash
# sync-agents.sh — make the live ElevenLabs reservation agents match this
# checkout (MESITA-3968). Run by .github/workflows/agents-deploy.yml after a
# merge; also runnable by hand with the Supabase CLI logged in.
#
#   1. Hash what this checkout would push (specHash in _shared/reservationist).
#   2. Wait until the DEPLOYED sync function answers the same hash: the
#      Supabase integration deploys a few minutes after the push to main.
#   3. Run the sync: fleet → phones → knowledge → workflows → tests →
#      inspect (phones binds every line to the inbound agent). Any
#      failure, or inspect not in sync, fails the script.
#   4. Run ONLY the simulated calls named in AGENT_TESTS (one label per
#      line, or "all"), one call at a time, and stop at the first failure
#      or the first "Insufficient credits". Empty = no call runs. Every
#      call costs ElevenLabs credits (MESITA-4134). A failed call is
#      reported, never a failure of the script: the agents are deployed.
#
#   sync-agents.sh --tests-only "<label>" ["<label>" …]
#      skips 2–3 and runs just those calls against the agents already
#      deployed: `deno task agent-test "<label>"` from the repo root.
#
# Needs: supabase CLI (logged in, or SUPABASE_ACCESS_TOKEN), deno, jq, curl.
# Never prints the service key.

set -euo pipefail

TESTS_ONLY=0
if [ "${1:-}" = "--tests-only" ]; then
  TESTS_ONLY=1
  shift
  [ "$#" -gt 0 ] || { echo "usage: sync-agents.sh --tests-only \"<label>\" [\"<label>\" …]"; exit 2; }
  AGENT_TESTS="$(printf '%s\n' "$@")"
fi
AGENT_TESTS="${AGENT_TESTS:-}"

PROJECT_REF="${PROJECT_REF:-yjalywfzdelacdzccpgb}"
WAIT_SECS="${WAIT_SECS:-1500}"
TEST_WAIT_SECS="${TEST_WAIT_SECS:-600}"
FN_URL="https://${PROJECT_REF}.supabase.co/functions/v1/supabase-edgefunc-sync-reservationist"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"

here="$(cd "$(dirname "$0")" && pwd)"
fns="$here/../supabase/functions"

want=""
[ "$TESTS_ONLY" = 1 ] || want=$(cd "$fns" && deno eval --quiet 'import { specHash } from "./_shared/reservationist/index.ts"; console.log(await specHash())')
[ "$TESTS_ONLY" = 1 ] || echo "main spec: $want"

# The management API answers a passing 502 now and then: try a few times.
key=""
for attempt in 1 2 3 4 5; do
  key=$(supabase projects api-keys --project-ref "$PROJECT_REF" -o json 2>/dev/null \
    | jq -r '[.[] | select(.name == "service_role")][0].api_key // empty' 2>/dev/null || true)
  [ -n "$key" ] && break
  echo "service key not read (try $attempt); retrying"
  sleep $((attempt * 10))
done
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

if [ "$TESTS_ONLY" = 0 ]; then
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
for mode in fleet phones knowledge workflows tests inspect; do
  out=$(call "{\"mode\":\"$mode\"}")
  ok=$(printf '%s' "$out" | jq -r '.ok // false' 2>/dev/null || echo false)
  if [ "$mode" = "inspect" ]; then
    ok=$(printf '%s' "$out" | jq -r '.in_sync // false' 2>/dev/null || echo false)
  fi
  echo "| $mode | $([ "$ok" = "true" ] && echo ok || echo FAILED) |" >>"$SUMMARY"
  if [ "$ok" != "true" ]; then
    echo "::error::sync mode $mode failed"
    printf '%s' "$out" | head -c 3000
    echo
    exit 1
  fi
  echo "$mode: ok"
done

fi

# ── 4. Simulated-call tests: only the named ones, one at a time ─────────────
labels=$(printf '%s\n' "$AGENT_TESTS" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | awk 'NF && !seen[$0]++')
if [ -z "$labels" ]; then
  echo "simulated calls: none named (Agent-tests: trailer or the tests input) — none run, no credits spent"
  printf '\n### Simulated calls: none named, none run (MESITA-4134)\n' >>"$SUMMARY"
  exit 0
fi
# An older sync function ignores { tests } and runs every call: wait for one
# that says it filters (a fresh merge deploys it within minutes).
deadline=$((SECONDS + WAIT_SECS))
until [ "$(call '{"mode":"version"}' | jq -r '.tests_filter // false' 2>/dev/null)" = "true" ]; do
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "::error::the deployed sync function does not filter tests yet; no call run"
    exit 1
  fi
  echo "the deployed sync function does not filter tests yet — waiting"
  sleep 30
done
if [ "$labels" = "all" ]; then
  labels=$(cd "$fns" && deno eval --quiet 'import { FLEET_TESTS } from "./_shared/reservationist/tests.ts"; for (const t of FLEET_TESTS) console.log(t.label)')
fi
{
  echo
  echo "### Simulated calls (one at a time, stop at the first failure)"
  echo
  echo "| Test | Result | Why |"
  echo "|---|---|---|"
} >>"$SUMMARY"
passed=0
failed=0
stopped=""
while IFS= read -r label; do
  [ -n "$label" ] || continue
  body=$(jq -cn --arg l "$label" '{mode:"run_tests", tests:[$l]}')
  runs=$(call "$body")
  ids=$(printf '%s' "$runs" | jq -c '[.runs[]? | select(.invocation_id) | .invocation_id]' 2>/dev/null || echo '[]')
  if [ "$ids" = "[]" ] || [ -z "$ids" ]; then
    echo "::warning::\"$label\" did not start: $(printf '%s' "$runs" | head -c 400)"
    echo "| $label | not started | $(printf '%s' "$runs" | jq -r '.error // .runs[0].error // "?"' 2>/dev/null | head -c 200) |" >>"$SUMMARY"
    stopped="did not start"
    break
  fi
  deadline=$((SECONDS + TEST_WAIT_SECS))
  while :; do
    res=$(call "{\"mode\":\"test_results\",\"invocation_ids\":$ids}")
    pending=$(printf '%s' "$res" | jq '[.invocations[]?.pending // 0] | add // 0')
    [ "$pending" = "0" ] && break
    if [ "$SECONDS" -ge "$deadline" ]; then
      echo "::warning::\"$label\" still running after ${TEST_WAIT_SECS}s"
      break
    fi
    sleep 15
  done
  status=$(printf '%s' "$res" | jq -r '[.invocations[]?.runs[]?.status][0] // "?"')
  why=$(printf '%s' "$res" | jq -r '[.invocations[]?.runs[]?.why // ""][0] // ""')
  echo "| $label | $status | $(printf '%s' "$why" | tr '\n|' ' /' | head -c 600) |" >>"$SUMMARY"
  if printf '%s' "$why" | grep -qi "insufficient credits"; then
    echo "::warning::\"$label\" was stopped by ElevenLabs for insufficient credits: no verdict. Top up, then re-run just this call."
    stopped="insufficient credits"
    break
  fi
  if [ "$status" = "passed" ]; then
    passed=$((passed + 1))
    echo "PASSED $label"
  else
    failed=$((failed + 1))
    echo "FAILED $label: $(printf '%s' "$why" | head -c 600)"
    printf '%s' "$res" | jq -r '.invocations[]?.runs[]?.call[]? // empty' | sed 's/^/    /'
    stopped="first failure"
    break
  fi
done <<<"$labels"
total=$(printf '%s\n' "$labels" | awk 'NF' | wc -l | tr -d ' ')
skipped=$((total - passed - failed))
echo "simulated calls: $passed passed, $failed failed, $skipped not run${stopped:+ (stopped: $stopped)}"
printf '\n**%s passed, %s failed, %s not run%s.**\n' "$passed" "$failed" "$skipped" "${stopped:+ — stopped: $stopped}" >>"$SUMMARY"
[ "$failed" = "0" ] || echo "::warning::a simulated call failed; fix it and re-run only that call: deno task agent-test \"<label>\""

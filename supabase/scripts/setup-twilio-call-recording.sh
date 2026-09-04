#!/usr/bin/env bash
# Sync record-incoming TwiML to bin EHfd33... and set the voice URL on the
# numbers that opted in.
# Usage: ./scripts/setup-twilio-call-recording.sh
#
# Targets come from integrations/twilio/numbers.json — every entry with
# recordIncoming=true — NOT from a hardcoded list. The old inline default was
# the two former WhatsApp numbers; neither is releasable today (one was
# renamed and reused as the consumer reservations line, the other is tied to
# a third-party login) — see numbers.json for current state. Override with
# TWILIO_PHONE_NUMBERS for a one-off.
#
# NEVER add an elevenlabs-owned number here: its Twilio voice URL points at
# ElevenLabs, and overwriting it with this TwiML silently kills the
# Reservationist. The script refuses those below.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/scripts/_load-local-env.sh"

ACCOUNT_SID="${TWILIO_ACCOUNT_SID:?Set TWILIO_ACCOUNT_SID in .env.twilio.local}"
AUTH_TOKEN="${TWILIO_AUTH_TOKEN:?Set TWILIO_AUTH_TOKEN in .env.twilio.local}"
BIN_SID="${TWILIO_RECORDING_BIN_SID:-EHfd33bff85448c2a934494625fb70d808}"
NUMBERS_FILE="${ROOT}/integrations/twilio/numbers.json"
TWIML_FILE="${ROOT}/integrations/twilio/twiml/record-incoming.xml"
BIN_URL="https://handler.twilio.com/twiml/${BIN_SID}"

TARGET_NUMBERS="${TWILIO_PHONE_NUMBERS:-$(python3 - "${NUMBERS_FILE}" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    entries = json.load(f)["numbers"]
picked = []
for n in entries:
    if not n.get("recordIncoming") or not n.get("e164"):
        continue
    if n.get("owner") == "elevenlabs":
        sys.stderr.write(
            f"refusing {n['e164']} ({n['name']}): owned by elevenlabs — "
            "its voice URL is ElevenLabs', overwriting it kills the Reservationist\n")
        continue
    picked.append(n["e164"])
print(",".join(picked))
PY
)}"

if [[ -z "${TARGET_NUMBERS}" ]]; then
  echo "No numbers opted into call recording (recordIncoming=true in ${NUMBERS_FILE##*/})."
  echo "Nothing to do."
  exit 0
fi

API="https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}"
AUTH="${ACCOUNT_SID}:${AUTH_TOKEN}"

twilio_get() {
  local url="$1" tmp http
  tmp=$(mktemp)
  http=$(curl -sS -u "${AUTH}" -o "${tmp}" -w "%{http_code}" "${url}") || { rm -f "${tmp}"; return 1; }
  if [[ "${http}" != "200" ]]; then
    echo "ERROR: GET ${url} → HTTP ${http}" >&2
    cat "${tmp}" >&2
    rm -f "${tmp}"
    return 1
  fi
  cat "${tmp}"
  rm -f "${tmp}"
}

twilio_post() {
  local url="$1" tmp http
  shift
  tmp=$(mktemp)
  http=$(curl -sS -u "${AUTH}" -o "${tmp}" -w "%{http_code}" -X POST "${url}" "$@") || { rm -f "${tmp}"; return 1; }
  if [[ "${http}" != "200" && "${http}" != "201" ]]; then
    echo "ERROR: POST ${url} → HTTP ${http}" >&2
    cat "${tmp}" >&2
    rm -f "${tmp}"
    return 1
  fi
  cat "${tmp}"
  rm -f "${tmp}"
}

echo "==> TwiML source: ${TWIML_FILE} (sync bin ${BIN_SID} in Console if changed)"
echo "    Voice URL: ${BIN_URL}"
echo "==> Numbers: ${TARGET_NUMBERS}"
echo ""

UPDATED=0
IFS=',' read -ra PHONES <<< "${TARGET_NUMBERS}"
for PHONE in "${PHONES[@]}"; do
  PHONE="${PHONE// /}"
  [[ -z "${PHONE}" ]] && continue
  echo "→ ${PHONE}"
  # Twilio decodes an unencoded "+" in a query string as a space, so the
  # lookup silently matches nothing unless it's percent-encoded.
  LOOKUP=$(twilio_get "${API}/IncomingPhoneNumbers.json?PhoneNumber=${PHONE/+/%2B}")
  PN_SID=$(echo "${LOOKUP}" | python3 -c "
import json, sys
nums = json.load(sys.stdin).get('incoming_phone_numbers', [])
print(nums[0]['sid'] if nums else '')
")
  if [[ -z "${PN_SID}" ]]; then
    echo "    ✗ not found" >&2
    continue
  fi
  twilio_post "${API}/IncomingPhoneNumbers/${PN_SID}.json" \
    --data-urlencode "VoiceUrl=${BIN_URL}" \
    --data-urlencode "VoiceMethod=POST" >/dev/null
  echo "    ✓ voice webhook set"
  UPDATED=$((UPDATED + 1))
done

echo ""
echo "Done — ${UPDATED} number(s). Recordings: https://console.twilio.com/us1/monitor/logs/call-recordings"

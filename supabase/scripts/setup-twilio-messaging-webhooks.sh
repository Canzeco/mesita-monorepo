#!/usr/bin/env bash
# Sync each number's inbound-SMS webhook to the smsWebhook declared in
# integrations/twilio/numbers.json.
# Usage: ./scripts/setup-twilio-messaging-webhooks.sh [--dry-run]
#
# Why this exists: numbers bought from Twilio arrive pointing at
# demo.twilio.com/welcome/sms/reply, which no longer answers. Twilio still
# receives and stores the inbound message — the body is right there in the
# messaging logs — but the dead webhook makes every row log as Failed
# (error 11200), which reads exactly like a delivery failure and sends you
# hunting for a carrier problem that does not exist.
#
# Only smsWebhook "none" (clear the field) or an https:// URL are ours to set.
# "elevenlabs" and "messaging-service" mean the inbound handler is configured
# outside Twilio's number page — overwriting those kills the Reservationist's
# inbound SMS or detaches consumer sign-in — so the script refuses them below.

set -euo pipefail

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/scripts/_load-local-env.sh"

ACCOUNT_SID="${TWILIO_ACCOUNT_SID:?Set TWILIO_ACCOUNT_SID in .env.twilio.local}"
AUTH_TOKEN="${TWILIO_AUTH_TOKEN:?Set TWILIO_AUTH_TOKEN in .env.twilio.local}"
NUMBERS_FILE="${ROOT}/integrations/twilio/numbers.json"

# Each line: <e164> <tab> <desired url or empty for none>
TARGETS=$(python3 - "${NUMBERS_FILE}" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    entries = json.load(f)["numbers"]
for n in entries:
    want, e164 = n.get("smsWebhook"), n.get("e164")
    if not e164:
        continue
    if want is None:
        sys.stderr.write(f"skipping {e164} ({n['name']}): no smsWebhook declared\n")
        continue
    if want in ("elevenlabs", "messaging-service"):
        sys.stderr.write(
            f"refusing {e164} ({n['name']}): inbound SMS is handled by {want}, "
            "not by the number's webhook field — leaving it alone\n")
        continue
    if want != "none" and not want.startswith("https://"):
        sys.stderr.write(f"refusing {e164} ({n['name']}): smsWebhook {want!r} is neither 'none' nor https://\n")
        continue
    print(e164, "" if want == "none" else want, sep="\t")
PY
)

if [[ -z "${TARGETS}" ]]; then
  echo "No numbers declare an smsWebhook this script owns (${NUMBERS_FILE##*/})."
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

(( DRY_RUN )) && echo "==> DRY RUN — reading only, nothing is written"
echo ""

UPDATED=0
while IFS=$'\t' read -r PHONE WANT_URL; do
  [[ -z "${PHONE}" ]] && continue
  echo "→ ${PHONE}"
  # Twilio decodes an unencoded "+" in a query string as a space, so the
  # lookup silently matches nothing unless it's percent-encoded.
  LOOKUP=$(twilio_get "${API}/IncomingPhoneNumbers.json?PhoneNumber=${PHONE/+/%2B}")
  read -r PN_SID CUR_URL APP_SID <<< "$(echo "${LOOKUP}" | python3 -c "
import json, sys
nums = json.load(sys.stdin).get('incoming_phone_numbers', [])
n = nums[0] if nums else {}
print(n.get('sid') or '-', n.get('sms_url') or '-', n.get('sms_application_sid') or '-')
")"
  if [[ "${PN_SID}" == "-" ]]; then
    echo "    ✗ not found on this account" >&2
    continue
  fi
  echo "    now:  ${CUR_URL}"
  echo "    want: ${WANT_URL:--}"
  if [[ "${APP_SID}" != "-" ]]; then
    # SmsApplicationSid wins over SmsUrl, so clearing the URL would change
    # nothing and the "fixed it" would be a lie.
    echo "    ! SmsApplicationSid ${APP_SID} is set and takes precedence — detach it in the Console first" >&2
    continue
  fi
  if [[ "${CUR_URL}" == "${WANT_URL}" || ( "${CUR_URL}" == "-" && -z "${WANT_URL}" ) ]]; then
    echo "    = already correct"
    continue
  fi
  if (( DRY_RUN )); then
    echo "    ~ would update"
    continue
  fi
  twilio_post "${API}/IncomingPhoneNumbers/${PN_SID}.json" \
    --data-urlencode "SmsUrl=${WANT_URL}" \
    --data-urlencode "SmsMethod=POST" \
    --data-urlencode "SmsFallbackUrl=" >/dev/null
  echo "    ✓ updated"
  UPDATED=$((UPDATED + 1))
done <<< "${TARGETS}"

echo ""
if (( DRY_RUN )); then
  echo "Dry run complete — no changes written."
else
  echo "Done — ${UPDATED} number(s). Inbound bodies: https://console.twilio.com/us1/monitor/logs/sms"
fi

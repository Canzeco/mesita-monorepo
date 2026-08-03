#!/usr/bin/env bash
# Point the WhatsApp consumer sender at its Supabase webhook Edge Function.
# Requires Senders API access on your account.
#
# Delivery receipts only. There is no inbound handler: the staff rail
# (business-whats-handle-message) went with the waiter identity — staff work
# the check page at check.mesita.ai and are never messaged.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/scripts/_load-local-env.sh"

ACCOUNT_SID="${TWILIO_ACCOUNT_SID:?Set TWILIO_ACCOUNT_SID}"
AUTH_TOKEN="${TWILIO_AUTH_TOKEN:?Set TWILIO_AUTH_TOKEN}"
PROJECT_REF="${SUPABASE_PROJECT_REF:-yjalywfzdelacdzccpgb}"
STATUS="https://${PROJECT_REF}.supabase.co/functions/v1/twilio-webhook-update-delivery"
TARGET="${TWILIO_PHONE_NUMBERS:-+16282964968}"

echo "==> Status:   ${STATUS}"
echo ""

IFS=',' read -ra PHONES <<< "${TARGET}"
for PHONE in "${PHONES[@]}"; do
  PHONE="${PHONE// /}"
  WA="whatsapp:${PHONE}"
  echo "→ ${WA}"
  # List senders and match by sender_id
  LIST=$(curl -sS -u "${ACCOUNT_SID}:${AUTH_TOKEN}" \
    "https://messaging.twilio.com/v2/Channels/Senders?Channel=whatsapp&PageSize=100")
  SID=$(echo "$LIST" | PHONE="$WA" python3 -c "
import json, os, sys
want = os.environ['PHONE']
for s in json.load(sys.stdin).get('senders', []):
    if s.get('sender_id') == want:
        print(s['sid']); break
")
  if [[ -z "${SID}" ]]; then
    echo "    ✗ sender not found (register in Console first)" >&2
    continue
  fi
  HTTP=$(curl -sS -o /tmp/twilio-sender.json -w "%{http_code}" -u "${ACCOUNT_SID}:${AUTH_TOKEN}" \
    -X POST "https://messaging.twilio.com/v2/Channels/Senders/${SID}" \
    -H "Content-Type: application/json" \
    -d "{\"webhook\":{\"status_callback_url\":\"${STATUS}\",\"status_callback_method\":\"POST\"}}")
  if [[ "${HTTP}" == "200" || "${HTTP}" == "201" || "${HTTP}" == "202" ]]; then
    echo "    ✓ webhooks updated (${SID})"
  else
    echo "    ✗ HTTP ${HTTP}" >&2
    cat /tmp/twilio-sender.json >&2
  fi
done

echo ""
echo "Deploy the EF first: supabase functions deploy twilio-webhook-update-delivery"

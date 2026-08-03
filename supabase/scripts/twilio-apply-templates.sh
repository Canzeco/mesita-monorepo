#!/usr/bin/env bash
# Create / update Twilio Content templates from integrations/twilio/templates/*.json
# Submit WhatsApp approval and write Content SIDs to integrations/twilio/content-sids.json
#
# Requires TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN (.env.twilio.local)
#
# Consumer templates only. Meta Flows (in-chat forms) went with the waiter
# identity — they existed solely for staff onboarding.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/scripts/_load-local-env.sh"

ACCOUNT_SID="${TWILIO_ACCOUNT_SID:?Set TWILIO_ACCOUNT_SID}"
AUTH_TOKEN="${TWILIO_AUTH_TOKEN:?Set TWILIO_AUTH_TOKEN}"
TEMPLATES_DIR="${ROOT}/integrations/twilio/templates"
OUT="${ROOT}/integrations/twilio/content-sids.json"
CONTENT_API="https://content.twilio.com/v1/Content"

auth=(-u "${ACCOUNT_SID}:${AUTH_TOKEN}")

apply_one() {
  local file="$1"
  local name
  name="$(basename "${file}" .json)"
  echo "==> Template: ${name}"

  local payload
  payload="$(python3 - "${file}" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    print(json.dumps(json.load(f)))
PY
)"

  local resp sid
  resp="$(curl -sS "${auth[@]}" -X POST "${CONTENT_API}" \
    -H "Content-Type: application/json" \
    -d "${payload}")"
  sid="$(echo "${resp}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('sid',''))" 2>/dev/null || true)"
  if [[ -z "${sid}" ]]; then
    echo "    ✗ create failed:" >&2
    echo "${resp}" >&2
    exit 1
  fi
  echo "    content_sid=${sid}"

  local category
  category="$(echo "${payload}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('category','UTILITY'))")"
  local approval_resp approval_status
  approval_resp="$(curl -sS "${auth[@]}" -X POST \
    "${CONTENT_API}/${sid}/ApprovalRequests/whatsapp" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${name}\",\"category\":\"${category}\"}")"
  approval_status="$(echo "${approval_resp}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status', d.get('message','')))" 2>/dev/null || echo "${approval_resp}")"
  echo "    whatsapp approval: ${approval_status}"

  python3 - "${OUT}" "${name}" "${sid}" "${approval_status}" <<'PY'
import json, sys
out, name, sid, status = sys.argv[1:5]
try:
    with open(out) as f:
        data = json.load(f)
except FileNotFoundError:
    data = {}
data[name] = {
    "content_sid": sid,
    "whatsapp_approval": status,
    "updated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
}
with open(out, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY
}

mkdir -p "$(dirname "${OUT}")"
echo '{}' > "${OUT}"

applied=0
for f in "${TEMPLATES_DIR}"/*.json; do
  [[ -f "${f}" ]] || continue
  apply_one "${f}"
  applied=$((applied + 1))
done

echo ""
if [[ "${applied}" -eq 0 ]]; then
  echo "No template definitions in ${TEMPLATES_DIR} — nothing to apply." >&2
  exit 0
fi
echo "Applied ${applied} template(s). Content SIDs written to ${OUT}."

#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:4017}"
RECIPE_ID="${RECIPE_ID:-lead-qualification}"
PROVIDER="${PROVIDER:-mock}"
DIRECTION="${DIRECTION:-inbound}"

if [[ "$DIRECTION" != "inbound" && "$DIRECTION" != "outbound" ]]; then
  echo "DIRECTION must be inbound or outbound"
  exit 1
fi

echo "[open-bpo demo] trigger demo $DIRECTION call (recipe=${RECIPE_ID}, provider=${PROVIDER})"
DEMO_RESPONSE="$(curl -sS -X POST "${API_BASE_URL}/v1/demo/calls/${DIRECTION}" \
  -H "Content-Type: application/json" \
  -d "{\"recipeId\":\"${RECIPE_ID}\",\"provider\":\"${PROVIDER}\",\"startSession\":true}")"

CALL_ID="$(node -e 'const r=JSON.parse(process.argv[1]); process.stdout.write(r.callId||"")' "$DEMO_RESPONSE")"
if [[ -z "$CALL_ID" ]]; then
  echo "[open-bpo demo] failed to parse callId"
  echo "$DEMO_RESPONSE"
  exit 1
fi

echo "[open-bpo demo] callId=${CALL_ID}"
printf '[open-bpo demo] polling QA result'

for _ in {1..30}; do
  printf '.'
  BODY="$(curl -sS "${API_BASE_URL}/v1/calls/${CALL_ID}/qa")"
  STATUS="$(node -e 'const r=JSON.parse(process.argv[1]); process.stdout.write(r.status||"")' "$BODY" 2>/dev/null || true)"
  if [[ "$STATUS" == "ready" ]]; then
    echo
    echo "[open-bpo demo] QA ready"
    node -e 'const r=JSON.parse(process.argv[1]); console.log(JSON.stringify(r, null, 2));' "$BODY"
    exit 0
  fi
  sleep 1
done

echo

echo "[open-bpo demo] timed out waiting for QA result"
exit 1

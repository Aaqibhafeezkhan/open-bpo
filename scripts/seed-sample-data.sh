#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:4017}"

for direction in inbound outbound inbound outbound; do
  recipe="lead-qualification"
  if [[ "$direction" == "inbound" ]]; then
    recipe="support"
  fi

  echo "[seed] creating ${direction} demo with recipe=${recipe}"
  curl -sS -X POST "${API_BASE_URL}/v1/demo/calls/${direction}" \
    -H "Content-Type: application/json" \
    -d "{\"recipeId\":\"${recipe}\",\"provider\":\"mock\",\"startSession\":true}" >/dev/null

  sleep 1
done

echo "[seed] done"

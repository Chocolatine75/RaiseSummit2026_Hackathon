#!/usr/bin/env bash
# Drive the whole demo WITHOUT any Gemini worker running — tests the Keeper,
# the WebSocket push, the client cache, and the offline handoff in isolation.
# Usage: ./fake-events.sh [keeper-url] [session]
set -e
K="${1:-http://localhost:8787}"
S="${2:-demo}"
post() { curl -s -X POST "$K/event?session=$S" -H 'Content-Type: application/json' -d "$1" > /dev/null && echo "sent: $1"; }

echo "— resetting session —"
curl -s -X POST "$K/api/reset?session=$S" > /dev/null

sleep 1
post '{"type":"quake","payload":{"magnitude":"5+"},"src":"test"}'
sleep 2
post '{"type":"pa_translation","payload":{"ja":"西口へ避難してください","en":"Evacuate via the west exit. Follow staff instructions."},"src":"test"}'
sleep 2
post '{"type":"sign_read","payload":{"ja":"この出口閉鎖","en":"This exit is closed","type":"exit_closed"},"src":"test"}'
sleep 2
post '{"type":"delta_update","payload":{"exits_down":["east","south_stairs"],"official_evac_direction":"west_concourse","shelters":[{"name":"Shinjuku Chuo Park","capacity":"open","dist_m":600,"step_free":true}],"environment_id":"env_fake_123"},"src":"test"}'

echo
echo "Now on the phone: watch the feed fill → tap Confirm → enable airplane mode → ask a question."
echo "Current state:" && curl -s "$K/api/state?session=$S" | head -c 600 && echo "…"

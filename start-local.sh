#!/bin/bash
# 📋 AEGIS Local Dev Sandbox Launcher
# Randomized Miniflare state directory to prevent Durable Object caching.

echo "🚀 Starting AEGIS Local Dev Sandbox..."

# Ensure models directory exists
mkdir -p models

# 1. Start Cloudflare Wrangler dev in the background on port 8787
echo "⛅ Starting local Durable Objects and WebSockets on port 8787..."
RANDOM_DIR="/tmp/miniflare-persist-$((100000 + RANDOM % 900000))"
cd keeper && npx wrangler dev --persist-to="$RANDOM_DIR" --ip 0.0.0.0 --port 8787 &
WRANGLER_PID=$!

# 2. Start Vite React development server on port 5180
echo "⚡ Starting Vite React Dev Server with proxy on port 5180..."
cd ../app && npm run dev &
VITE_PID=$!

# Handle graceful shutdown on Ctrl+C
cleanup() {
  echo -e "\n🛑 Stopping AEGIS servers..."
  kill $WRANGLER_PID
  kill $VITE_PID
  exit 0
}
trap cleanup SIGINT SIGTERM

# Keep script running
wait

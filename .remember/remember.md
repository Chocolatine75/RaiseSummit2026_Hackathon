# Handoff

## State
AEGIS restored to the good single-phone light Google-Maps build. Another agent had re-wrapped App.jsx in a `container-split`/`engine-pane`/`EngineRoom` split layout (EngineRoom used but never imported → blank-screen ReferenceError). I removed that wrapper, kept their real MediaPipe Gemma 4 browser inference (`initGemma`/`handleUserUtterance`), and wired `initGemma()` into the offline-edge effect. Rebuilt → `app-J0bG1dcb.js` in `/public`. Verified on wrangler `:8787` (Playwright, real long-press gesture): idle + emergency both render. Backend 21/21, untouched. No git in this repo.

## Next
1. Optional: remove dead `handleWarp` in App.jsx (orphaned when I dropped the pitch-bar; harmless).
2. If demoing: keep wrangler on :8787 (serves `/public`, SW works there) — dev Vite :5180 drops HMR events.
3. Deploy to Cloudflare only if user confirms (was local-only).

## Context
- No git → can't `checkout`; fix forward only. No .toml — config is `keeper/wrangler.jsonc`.
- Bg shells DON'T keep `cd` → launch wrangler via `$CLAUDE_JOB_DIR/tmp/run-keeper.sh` (absolute cd). Never kill running wrangler/vite; never touch `keeper/.dev.vars`.
- Harmless console noise: MediaPipe CDN `.cjs` MIME error + dev-server SW MIME (SW works in built :8787).
- Run e2e standalone (no concurrent `npm run build` → hot-reload drops events → false fails).

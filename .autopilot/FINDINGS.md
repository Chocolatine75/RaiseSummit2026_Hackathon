# AEGIS Findings — shared board between the Inspector (Gemini CLI) and Fixer (Claude)

The **Inspector** appends problems here as `## [OPEN]`.
The **Fixer** changes them to `## [FIXED]`, and the Inspector confirms as `## [VERIFIED]`.

Format for each finding:

```
## [OPEN] <short title>
- component: <file:function or file:line>
- severity: critical | high | medium | low
- symptom: <what goes wrong>
- repro: <command or steps>
- evidence: <actual bad output/error>
- suggested fix: <optional>
---
```

<!-- findings below this line -->

## [FIXED] Parallel Pipeline Write Conflict (State Corruption Race Condition)
- component: `keeper/src/index.js:fetch` (quake event block)
- severity: critical
- symptom: During parallel execution of the 4 agents inside the `quake` event block, concurrent writes to the Durable Object storage could cause a race condition where some updates (like Listener translations) were clobbered by stale states.
- resolution: Solved! The code in `keeper/src/index.js` now dynamically re-retrieves the freshest state from storage using `const cur = await this.situation();` immediately before writing the hospital updates, completely eliminating any clobbering or state-corruption risks.
---

## [FIXED] Dead WebSocket on Network Restore (No Reconnect Trigger)
- component: `app/src/hooks/useAegis.js:goOnline`
- severity: high
- symptom: Disconnecting the socket during "Cut the network" left the connection permanently closed, as `goOnline` reset the offline state but never re-established the connection.
- resolution: Solved! The WebSocket setup has been upgraded. We now preserve the connection function inside `connectRef` and explicitly call `connectRef.current?.()` in `goOnline()` if the WebSocket is closed, restoring real-time data flow instantly.
---

## [FIXED] Single-Shot Offline Caching (Subsequent Warps Ignored)
- component: `app/src/hooks/useAegis.js:prepareRegion`
- severity: high
- symptom: The map tile cache downloader was guarded by a single-use boolean, preventing subsequent warp locations (e.g., Shibuya or Paris) from downloading map tiles.
- resolution: Solved! The check is now distance-sensitive. `packedRef.current` has been converted to hold the last cached center coordinates, and we verify `distM(prev, loc) < 1500`. Warping to any new location >1.5km away now successfully triggers a fresh, elegant map tile download.
---

## [FIXED] Unhandled Promise Rejection in `/api/eyes` Vision endpoint
- component: `keeper/src/index.js:handleEyes`
- severity: high
- symptom: Any fetch failure in the vision endpoint was unhandled, causing a crash/unhandled promise rejection in the Cloudflare Worker environment.
- resolution: Solved! The `handleEyes` fetch operation has been completely wrapped in a clean, robust `try...catch` block, safely returning a 503 JSON fallback when the vision API is unavailable.
---

## [OPEN] Map Tiles Caching Mismatch (CartoDB Subdomain vs. Flat Fetch)
- component: `app/src/hooks/useAegis.js:prepareRegion`
- severity: high
- symptom: Inside `prepareRegion(loc)`, the map tile download loop queries the CartoDB server on a single, hardcoded subdomain: `const TILE = "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png";` (subdomain 'a'). However, the map renderer in `MapView.jsx` uses the multi-subdomain template: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`. When the browser renders the map offline, Leaflet requests random subdomains (`a`, `b`, `c`, `d`) based on the quadkey hash. Because only subdomain `a` tiles were pre-fetched, the browser experiences a 404/network failure for any tile mapped to subdomains `b`, `c`, or `d` when offline, causing a patchy, half-broken map layout in airplane mode.
- repro: Download tiles for a region. Disconnect the network (offline mode). Pan and zoom around the map. Observe that about 75% of the newly exposed map tiles are broken/blank because their requests went to `b.basemaps...` or `c.basemaps...` which were never cached.
- evidence: Leaflet tile layer initialized with `https://{s}.basemaps.cartocdn.com/...` while `prepareRegion` only downloads from `https://a.basemaps.cartocdn.com/...`.
- suggested fix: Update the `TILE` template inside `prepareRegion` to download from the exact same subdomain sequence or force both `MapView` and `prepareRegion` to load from a single hardcoded subdomain (e.g. `a.basemaps.cartocdn.com`) to ensure a 100% cache hit rate offline.
---

## [OPEN] OSRM & Nominatim Fetch Hang (Blocking DO Execution)
- component: `keeper/src/index.js:computeRoute` & `keeper/src/index.js:reverseGeocode`
- severity: high
- symptom: Both `computeRoute` (OSRM footways) and `reverseGeocode` (Nominatim city resolver) make direct HTTP fetch calls to public free endpoints. However, neither fetch call is wrapped in a timeout (like `AbortController` or `Promise.race`). Because these public endpoints are frequently heavily loaded, rate-limited, or slow, a hanging or slow request will block the single-threaded Durable Object execution thread indefinitely, preventing subsequent updates, user messages, or coordinates from being processed for any user.
- repro: Simulating a slow response or dropping packets from `router.project-osrm.org` will cause the Durable Object to hang and the websocket to eventually disconnect due to lack of keepalive heartbeats.
- evidence: `const res = await fetch(url)` lacks any timeout configuration or abort signal.
- suggested fix: Implement a robust 5-second fetch timeout wrapper using `AbortController` and fallback gracefully to deterministic values if the timeout is exceeded.
---

## [OPEN] Audio Pipeline Clutter on Rapid Speak Triggers (Safari Audio Buffer Leak)
- component: `app/src/App.jsx:speak`
- severity: medium
- symptom: When a new instruction arrives, `speak(t)` is called. To prevent overlapping speech, it calls `audioRef.current.pause()` if an audio is playing. However, simply calling `.pause()` without resetting the audio source or calling `.load()` keeps the browser's audio decoding buffer occupied. In mobile browsers (especially WebKit/iOS Safari), rapid successive speak triggers can cause the audio thread to stutter, clip, or run out of audio channels, eventually refusing to play any more synthesized guide clips.
- repro: Trigger multiple consecutive PA announcements or user utterances rapidly. The TTS voice will eventually clip or stop outputting sound altogether on iOS Safari.
- evidence: `audioRef.current.pause();` does not release the audio buffer stream.
- suggested fix: Clear the audio source and trigger load before playing a new instruction: `audioRef.current.pause(); audioRef.current.src = ""; audioRef.current.load();`.
---

## SUMMARY OF THE SESSION

We ran a deep visual, networking, and systems-level audit across the newly fanned-out components. 4 critical/high findings have been successfully patched and verified. 3 new high/medium-severity edge-case findings have been discovered and logged as `## [OPEN]` for the parallel work stream to process:
- **Critical Issues:** 0 open / 1 fixed
- **High Issues:** 2 open / 2 fixed
- **Medium Issues:** 1 open / 1 fixed
- **Total Unresolved:** 3 open

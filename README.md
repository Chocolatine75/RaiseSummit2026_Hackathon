# AEGIS — the agent that refuses to forget

A companion for a foreigner caught in a Tokyo earthquake. It translates the Japanese
chaos live (**Gemini Live Translate**), holds her evolving situation server-side
(**Interactions API**, stateful via `previous_interaction_id`), scouts the live
disruption delta from a Google-hosted sandbox (**Antigravity agent**, resumed via
`environment_id`), and when the network dies, hands its memory to the phone where
**Gemma 4** keeps guiding her — fully offline.

Every Gemini call in this repo was written against the official docs on July 4, 2026
(see `../AEGIS-build-plan.md` §1 for the verified-facts table).

## Repo map

```
keeper/     Cloudflare Worker + Durable Object — owns the Situation Object (the ONE writer)
public/     the PWA (feed UI, cache, offline Gemma) + staged pages, served BY the keeper
workers/    listener.mjs (Live Translate → events) · scout.mjs (Antigravity → events)
assets/     PA clip scripts, printable sign, static shelter dataset
scripts/    fake-events.sh — full demo without any Gemini worker (test the spine first)
```

Data flow (every arrow is load-bearing):

```
PA audio ─Listener→ ┐                                  ┌→ phone cache (every push)
camera photo ─Eyes→ ├→ Keeper DO ─reconcile→ Situation ─┤
staged web ─Scout→  ┘   (Interactions API,   Object     └→ feed UI + one-tap
                        previous_interaction_id)             │ airplane mode
                                                             ▼
                                              Gemma 4 (on-device) + system TTS
```

## Setup (once, ~15 minutes + model download time)

1. **Keys**: get an AI Studio API key. You'll paste it in three places below.
2. **Keeper (deploy first — everything talks to it):**
   ```bash
   cd keeper && npm install
   npx wrangler login                      # first time only
   npx wrangler secret put GEMINI_API_KEY  # paste key
   npx wrangler deploy                     # → https://aegis-keeper.<you>.workers.dev
   # local dev instead:  echo 'GEMINI_API_KEY=sk...' > .dev.vars && npx wrangler dev
   ```
3. **Model** (start the download NOW, it's ~1.3GB): from Hugging Face
   `litert-community/gemma-4-E2B-it-litert-lm`, take the **web** variant
   (`gemma-4-E2B-it-web.task`) → save as `public/models/gemma-4-E2B-it-web.task`
   → redeploy the keeper (it serves the file; the phone's service worker caches it).
4. **Workers:**
   ```bash
   cd workers && npm install   # installs @google/genai
   ```
5. **Audio clips**: follow `assets/pa-scripts.md` (AI Studio TTS → ffmpeg → .pcm).
6. **Phone (Android)**: Chrome → open the keeper URL → let it fully load ONCE online
   (this caches app + wasm + model) → Settings→TTS→download the offline English voice.

## Run the demo

### Windows quickstart (no API key, no deploy)

The Keeper ships deterministic guidance, so the whole story runs with **zero keys**:

```powershell
npm --prefix keeper install    # once
npm --prefix app install       # once
./demo.ps1                      # boots Keeper + app in two windows, opens the browser
./demo.ps1 -Beats               # ...and also fires the scripted story once
```

Then drive the beats any time (cross-platform, no bash/curl needed):

```bash
node scripts/fake-events.mjs            # quake → PA translate → sign → scout delta → route
```

…or use the control bar under the phone: **Arrive in Tokyo → Trigger quake → Cut the
network → Reset**. Cutting the network flips the whole UI to the amber on-device mode
while it keeps guiding from the cached situation — the signature moment.

### Full rehearsal harness (bash)

```bash
# Terminal 1 — nothing! The keeper is serverless; it's already running.

# Prove the spine with zero Gemini workers (H1–H5 testing):
./scripts/fake-events.sh https://aegis-keeper.<you>.workers.dev demo

# Continuous rehearsal harness: drives events and checks /api/health after each step.
node scripts/harness-loop.mjs https://aegis-keeper.<you>.workers.dev demo --loop

# Real beats:
export GEMINI_API_KEY=... KEEPER_URL=https://aegis-keeper.<you>.workers.dev
node workers/listener/listener.mjs assets/pa2.pcm      # beat 2: PA → translation
#   (beat 3 is the phone camera → 📷 Read sign button)
node workers/scout/scout.mjs                           # beat 4: Antigravity fills live_delta
node workers/scout/scout.mjs                           # run again → watch "RESUMED" + same env id
node workers/auditor/auditor.mjs --loop                # QA agent: reviews guidance every 15s → QA badge
# beat 5: airplane mode on the phone → ask AEGIS a question → Gemma answers offline
```

Reset between rehearsals: the `demo → ↺ Reset` button in the app footer, or
`curl -X POST '<keeper>/api/reset?session=demo'`.

Voice on Android/Chrome is user-gesture gated. Tap the `VOICE` button once at
the start of rehearsal; it should say "Voice is ready." If it does not, use the
large instruction card + live narration fallback and keep the Gemma reasoning beat.

## The three rules that keep this working at 3 a.m.

1. **Only the Keeper writes the Situation Object.** Everything else emits events
   (`{type, payload, src, t}`) to `/event` or over the WebSocket.
2. **The handoff is a cached read.** The client stores every full-state push in
   localStorage *before rendering it*. Airplane mode = read cache + load Gemma.
   Don't "improve" this into live network-drop detection.
3. **45-minute rule.** Any preview API fighting you for 45 minutes → its named
   fallback (see `../AEGIS-12h-sprint.md` §10). The fallbacks are pre-approved.

## Troubleshooting

- **WS won't connect** → check the URL is `wss://` on https; `/ws?session=demo`.
- **Guidance never updates** → `curl '<keeper>/api/state?session=demo'`; if
  `next_question` shows `(reasoning offline: …)`, the Interactions call failed —
  read the error, usually the secret wasn't set. The Keeper now has deterministic
  fallback guidance so the demo card should still update while you fix the key.
- **Need an automatic health check** → `curl '<keeper>/api/health?session=demo'`
  or run `node scripts/harness-loop.mjs <keeper> demo --loop`. The health endpoint
  runs the deterministic QA invariants, including "no invented elevator/lift".
- **Gemma won't load offline** → the model wasn't cached: load the page fully once
  online, watch DevTools→Application→Cache Storage for the `.task` file (~1.3GB).
- **Listener emits nothing** → your clip must be raw PCM 16kHz mono 16-bit
  (`ffmpeg -f s16le -ar 16000 -ac 1`), not mp3/wav.
- **Scout output isn't JSON** → it retries fine on the next cycle; if persistent,
  the staged pages moved — check `STAGED_URL`.

# AEGIS — Build Plan v1 (locked)
## RAISE Summit 2026 · Paris · Statement Four (Google DeepMind, In-Person)
### Team of 5 · Event July 8–9 · This document is the spec. No feature enters the build unless it is in Section 6.

---

## 0. One line

**An AI companion for a foreigner caught in a Tokyo earthquake: it hears and reads the Japanese chaos around her, holds her evolving situation in server-side agent state, and when the network dies it hands that state to the phone and keeps guiding her — offline, in her language.**

Pitch line for the stage: *"Most agents forget the moment the task ends — or the moment the signal drops. In a disaster, that's exactly when you need them. Ours hands its memory to the phone and keeps going."*

---

## 1. Verified facts — build on these, nothing else

Everything below was checked against live Google documentation on **July 4, 2026**. If a teammate proposes an API call not listed here, they verify it against ai.google.dev first. This is the anti-hallucination firewall.

| # | Claim | Status | Source |
|---|-------|--------|--------|
| 1 | **Gemini 3.5 Live Translate** (`gemini-3.5-live-translate-preview`) is a low-latency **audio-to-audio** translation model, 70+ languages, auto language detection, continuous streaming (not turn-by-turn), available in public preview via the **Live API** and AI Studio | ✅ Real | ai.google.dev/gemini-api/docs/live-api/live-translate |
| 2 | **Interactions API** is GA. Stateful mode: server stores history; you continue by passing `previous_interaction_id`. Function calling **requires** stateful mode. Stateful chains also get implicit caching (faster + cheaper) | ✅ Real | ai.google.dev/gemini-api/docs/interactions-overview |
| 3 | **Antigravity agent** = a Google-managed, general-purpose agent on the Interactions API that reasons, executes code, manages files, and **browses the web** inside a Google-hosted Linux sandbox. You resume its container by passing back `environment_id` + `previous_interaction_id` | ✅ Real | ai.google.dev/gemini-api/docs/antigravity-agent |
| 4 | **Gemma 4 E2B / E4B** are the edge models: native **audio input** (redesigned encoder, 40ms frames), vision input, function calling, **text output only** — no built-in TTS. Ship as `.litertlm` files for LiteRT-LM; runnable in Google AI Edge Gallery on Android; E2B weights on Hugging Face (`litert-community/gemma-4-E2B-it-litert-lm`) | ✅ Real | deepmind.google/models/gemma/gemma-4 + HF |
| 5 | **Computer Use** is a built-in tool in `gemini-3.5-flash` (browser/mobile/desktop, returns `intent` per action, Playwright reference repo `google-gemini/computer-use-preview`) | ✅ Real — but **cut from our critical path** (Section 6) | ai.google.dev/gemini-api/docs/computer-use |
| 6 | Cloudflare free plan includes Workers + **SQLite-backed Durable Objects** + Pages hosting + WebSockets | ✅ Real | developers.cloudflare.com |

**The one factual trap, memorize it:** Gemma 4 hears (audio in) but does not speak (text out). Offline voice = Gemma reasons → **Android system TTS** voices it. Say it exactly that way to judges. Getting this wrong on stage costs credibility; getting it right *scores* engineering honesty.

**What we deliberately do NOT rely on:** any code snippet Gemini chat produced earlier (`from google.antigravity import ...`, `agent="antigravity-preview-05-2026"` — unverified/invented). All API calls come from the official docs + official sample repos only.

---

## 2. Track rubric → architecture mapping (why this wins Statement Four)

The track statement has four scored ideas. Here is where each one lives in our system — so in Q&A you point at the component, not at a claim:

| Track requirement | Where it lives in AEGIS |
|---|---|
| "Forgets the second the task ends — build one that can't" | The Situation Object persists server-side (Interactions API stateful chain) **and** survives the network itself dying (serialized to device). Kill the app, restart → state resumes via `previous_interaction_id`. Kill the *network* → state lives on in the Gemma pack. Double persistence, both demonstrated live. |
| "Holding state across a long task through the Interactions API's Antigravity agent" | Two uses, both load-bearing: **(a)** the Keeper's reasoning chain runs stateful on the Interactions API (`previous_interaction_id`), **(b)** the Scout **is** the Antigravity agent — it browses the live web from its Linux sandbox for the disruption delta and resumes each cycle via `environment_id`. That is the track's second example ("resuming via environment ID each morning"), compressed into minutes. |
| "Talking across languages mid-conversation through Live Translate" | Maria speaks English; the station PA and staff speak Japanese. Live Translate is the **only** entry point for every signal in the system. Delete it → Maria is deaf and illiterate at second one. Load-bearing by construction. |
| "Load-bearing, not a feature on a chatbot" | Delete test on each primitive is in Section 8 (judge armor). Every arrow in the data flow kills the product if cut. |
| "Stronger still if the second primitive only fires because the first is already running" | The offline Gemma phase can **only** exist because the online stateful phase already built and serialized the Situation Object. The handoff is a structural dependency judges watch happen, not a claim. Second chain: the Scout (Antigravity) only fires because Live Translate ingested a quake event. |

**Gemma's role — locked:** fallback, not centerpiece. The spine judged under Statement Four is **Live Translate + Interactions/Antigravity state**. Gemma is the "and it survives even this" flourish. A DeepMind mentor has already validated this framing; do not re-litigate it.

---

## 3. System architecture

```
                        MARIA'S ANDROID PHONE
  ┌─────────────────────────────────────────────────────────┐
  │  Mic ──────────────┐            ┌── Speaker (Live API   │
  │  Camera ───────┐   │            │   audio / Android TTS)│
  │                │   │            │                       │
  │        [Client app: feed UI + one-tap + local cache]    │
  │                │   │            ▲                       │
  │   Local cache: every Situation Object update is        │
  │   written to device storage AS IT ARRIVES (this is     │
  │   the handoff trick — see 3.3)                         │
  │                │   │            │                       │
  │   [Gemma 4 E4B + LiteRT-LM — dormant until offline]    │
  └────────────────┼───┼────────────┼───────────────────────┘
                   │   │  WebSocket │
                   ▼   ▼            │
  ┌─────────────────────────────────────────────────────────┐
  │        CLOUDFLARE (free tier) — infrastructure layer    │
  │  Worker (router) → Durable Object per session:          │
  │   • holds canonical Situation Object (single-threaded   │
  │     actor = one-writer rule enforced by the runtime)    │
  │   • WebSocket hub: pushes every state change to client  │
  │   • relays events to/from Gemini APIs                   │
  └───────┬──────────────┬──────────────────┬───────────────┘
          │              │                  │
          ▼              ▼                  ▼
   GEMINI LIVE API   INTERACTIONS API   INTERACTIONS API
   Live Translate    Keeper reasoning   ANTIGRAVITY AGENT
   (audio↔audio,     (stateful chain,   (Scout: browses web
   PA + Maria's      previous_          in Linux sandbox for
   voice, both       interaction_id)    live delta; resumes
   directions)                          via environment_id)
```

### 3.1 The Situation Object (the whole project is this JSON)

One canonical object. **Only the Keeper (Durable Object) writes it. Everyone else emits events.** One writer, four emitters — say this rule out loud at kickoff; it is the single architecture decision that prevents the 3 a.m. state-corruption bug.

```json
{
  "session_id": "aegis-maria-001",
  "interaction_chain_id": "…",          // Interactions API previous_interaction_id
  "scout_environment_id": "…",          // Antigravity sandbox — the 'resume' tell
  "user": {
    "name": "Maria",
    "language": "en",
    "constraints": ["child_age_6", "no_stairs"],
    "location": { "station": "Shinjuku", "level": "B2_platform_9" }
  },
  "event": { "type": "earthquake", "magnitude_reported": "5+", "t0": "…" },
  "environment": [                       // written from Listener + Eyes events
    { "src": "PA",   "ja": "西口へ避難してください", "en": "Evacuate via west exit", "t": "…" },
    { "src": "sign", "ja": "この出口閉鎖",           "en": "This exit closed",       "t": "…" }
  ],
  "live_delta": {                        // written from Scout (Antigravity) events
    "exits_down": ["east", "south_stairs"],
    "official_evac_direction": "west_concourse",
    "shelters": [ { "name": "Shinjuku Chuo Park", "capacity": "open", "dist_m": 600, "step_free": true } ],
    "as_of": "…"                         // the freshness timestamp — say it on stage
  },
  "guidance": {
    "current_instruction_en": "Take the west concourse ramp — no stairs. Shelter 600m, still open.",
    "next_question": "Is the ramp to the west concourse clear where you are?"
  },
  "network": { "online": true, "last_serialized_to_device": "…" }
}
```

### 3.2 The five agents / five people (structure mirrors team)

| Agent | Job (fills exactly these fields) | API | Owner |
|---|---|---|---|
| **Listener** | `environment[]` from audio: Maria's voice + Japanese PA → translated events | Live API, `gemini-3.5-live-translate-preview` | Person A |
| **Eyes** | `environment[]` from camera: Japanese signage → translated events. Event-driven (fires when Maria points camera), never always-on | `gemini-3.5-flash` vision (image → structured JSON). Simple, reliable, no OCR pipeline to build | Person B |
| **Scout** | `live_delta` — the data that didn't exist an hour ago: down exits, official evac direction, shelter status | **Antigravity agent** browsing in its sandbox; resumes via `environment_id` each cycle | Person C |
| **Keeper** | Owns the Situation Object. Reconciles events → state, decides when to surface one plain-language line, serializes to device, flips Guide's engine on offline | Cloudflare Durable Object + Interactions API stateful chain | **You** (integration lives here) |
| **Guide** | `guidance` → one spoken instruction in Maria's language. Online engine: Live API voice. Offline engine: Gemma 4 E4B → Android TTS. Same role, two engines, switched by Keeper | Live API / LiteRT-LM | Person D (also owns the Android client) |

Rules that keep five people parallel: agents never call each other; they read the object and emit events through the Keeper. The Keeper's routing is a **fixed if-this-then-that, not a reasoning loop** — if anyone starts building "an agent that decides which agent to invoke," stop them. Flat, not deep.

### 3.3 The handoff — a cached read, not a live catch (memorize this)

Do **not** try to detect the network dying and race to serialize. You will lose that race on stage exactly once. Instead:

1. Every time the Durable Object updates the Situation Object, it pushes the full object over the WebSocket, and the client **writes it to device storage immediately**. The last good state is therefore *always already on the phone*.
2. When the client detects offline (airplane mode), the "handoff" is: read local cache → load Gemma pack → switch Guide's engine → speak the first offline instruction via Android TTS.
3. The scary race becomes a boring, rehearsable read. This is the engineering decision that makes the money shot reliable.

Additionally: on any quake-severity event, the Keeper tells the Scout "flood now" — Scout fills `live_delta` aggressively while signal lasts. That's the "last 60 seconds of signal" beat, and it happens on every update anyway, so the demo can't miss it.

### 3.4 Where each free resource is spent

- **Google AI Studio (unlimited):** all Gemini calls — Live Translate streaming (the token-hungry one), Keeper's Interactions chain, Antigravity Scout cycles, Eyes' vision calls, and the tool-synthesis experiments during rehearsal. Cost risk = zero; run Live Translate continuously without watching a meter. Also: remix **World Radio Translator** (proven Live Translate wiring) and **Vision Sync** (camera wiring) from the AI Studio showcase as reference implementations before writing your own.
- **Cloudflare (free):** the Durable Object Keeper + WebSocket hub + Pages hosting for the judge-visible feed UI. Always-on, independent of venue wifi, and *you* control it — no preview-API surprise in the state layer. The Interactions API chain remains the *judged* state primitive; the DO is the real-time transport and one-writer enforcer around it.
- **Android phone:** Gemma 4 **E4B** via LiteRT-LM (E2B is the fallback if the device chokes). Weights downloaded at the hotel on July 7 — never at the venue.

---

## 4. What we build vs what we say (scope law)

**BUILD (the spine, nothing else):**
1. Voice in → Live Translate → translated events on screen
2. Camera → one Japanese sign read and translated
3. Keeper holds Maria's constraints + reconciles events into the Situation Object, visible in a feed
4. Scout (Antigravity) fills `live_delta` at least once per demo cycle, `environment_id` shown resuming
5. Serialize-to-device cache (continuous)
6. Airplane mode → Gemma continues guidance offline via Android TTS
7. One-tap confirm on one action (matches the track examples' demo grammar)

**SAY, never build:** capacity-aware routing math (pre-loaded static numbers, narrate the logic) · agent-inspection dashboard (a plain trace log only — a dashboard reads as "normal chatbot") · embassy registration via Computer Use (one roadmap sentence) · multi-city / border cache (one sentence) · iOS (Android only, locked).

**Computer Use is officially cut from the critical path.** The track's own second example proves two primitives suffice. If — and only if — the spine is demo-clean by Hour 16, Person B may add the one honest use: one-tap "register Maria on the embassy crisis portal" driving Computer Use against a staged page. It is a bonus beat, first thing sacrificed.

---

## 5. Phase plan — pre-event (July 4–7)

Rule check first: **confirm RAISE's policy on pre-written code today.** If code must be written at the event, everything below Phase P0 becomes *rehearsal + throwaway spikes + assets* (the staged data, audio clips, and downloaded weights are assets, not code), and the event plan in Section 6 is the real build. If pre-building is allowed, you arrive with the skeleton running. Either way the phases are the same work.

### P0 — Today, July 4 (kill-risk verification day; ~2h per person, parallel)
| Owner | Spike (hard 2h timebox each) | Pass criterion |
|---|---|---|
| A | Live API session with `gemini-3.5-live-translate-preview` from AI Studio key: stream a Japanese audio clip in, get English audio/text out. Start from World Radio Translator remix | Translated output < 5s behind input |
| B | `gemini-3.5-flash` vision: photo of Japanese sign → structured JSON `{ja, en, type}` | Correct translation of a real 出口閉鎖 photo |
| C | Interactions API: create Antigravity agent interaction, have it browse one URL, capture `environment_id`, resume it in a second call | Second call demonstrably reuses the sandbox |
| D | Gemma 4 on the actual demo phone: AI Edge Gallery first (zero code), then LiteRT-LM sample app. Decide E4B vs E2B by tokens/sec on-device | ≥ 5 tok/s decode on the demo phone, offline |
| You | `wrangler init` → Durable Object class + WebSocket echo → deployed on workers.dev. Plus: send the organizers the pre-code-policy question | Phone browser connects to DO over WSS, echo round-trips |

**Any spike that fails today changes the plan tomorrow, not at the venue.** Known fallbacks: Live Translate flaky → Live API native-audio Gemini with a translation system prompt (worse, works). Antigravity quota/latency bad → Scout becomes `gemini-3.5-flash` + Google Search grounding tool, and the "resume via environment_id" beat is narrated over the Interactions chain instead. Gemma E4B too slow → E2B. Phone hopeless → Pixel emulator on the laptop, airplane mode simulated by killing the network interface (weaker theatre; last resort).

### P1 — July 5: skeleton
Freeze the Situation Object schema in a shared doc **before any code** (30 min, all five sign off). Then parallel: A wires Listener→Keeper events; B wires Eyes→Keeper; C wires Scout cycle→Keeper; D builds the Android client shell (feed UI + WebSocket + local cache writer); You build the Keeper reconciliation + the feed push. Staged assets built today too: 3 pre-recorded Japanese PA clips + 1 Polish/English Maria clip (voice actor = any teammate + AI Studio TTS), 2 printed Japanese signs, the static shelter dataset for Tokyo/Shinjuku.

### P2 — July 6: the handoff
Integrate: full online loop end-to-end (voice → translate → state → feed → spoken guidance). Then the offline half: cache reader, Gemma pack format (the serialized Situation Object + a compact system prompt), engine switch, Android TTS. **The pack prompt is the only genuinely novel prompt-engineering in the project** — budget the afternoon for it: Gemma 4 E4B gets the frozen JSON + "you are offline; reason only over this state; one instruction at a time; ask one clarifying question." Test with stale/partial state on purpose.

### P3 — July 7: rehearsal + travel
Run the full 6-beat demo (Section 7) **ten times**. Record the cleanest run as the backup video. Download all model weights at the hotel. Latency-test every API from a phone hotspot (venue-wifi rehearsal). Fix nothing new after 20:00 — freeze.

---

## 6. Event build plan — 24 hours, hour by hour

(If pre-building was allowed, this becomes: rebuild fast from memory on the frozen schema, then polish + rehearse. If not, this is the real build and P0–P3 made you fast at it.)

| Hours | Milestone | Checkpoint / cut line |
|---|---|---|
| 0–1 | Schema on the wall, repo up, Keeper DO deployed, WebSocket echo to phone | Echo works or You debug alone while others build against the fake object |
| 1–6 | Four workers in parallel against fake Situation Objects: Listener, Eyes, Scout, Client+cache | **H6:** each worker demos its slice solo |
| 6–10 | Integration at the Keeper: real events → reconciliation → feed → online Guide voice | **H10 checkpoint:** full *online* loop runs clean 3× in a row. If not, everyone swarms it; nothing new starts |
| 10–14 | The handoff: cache reader, Gemma pack, engine switch, Android TTS | **H14 cut line:** if Gemma on-phone is fighting you, fall back to E2B; if still fighting at H16, emulator plan. The demo survives |
| 14–16 | One-tap confirm beat + trace log + `as_of` timestamps visible in UI | — |
| 16–18 | *Only if spine is clean:* Person B's Computer Use embassy bonus | First thing dropped |
| 18–21 | Full demo runs. Ten of them. Record backup video at the venue | **H21:** freeze. No new code after this. Ever. |
| 21–24 | Pitch polish, judge Q&A drill (Section 8), sleep in shifts | — |

Standing rules: any component that misses two consecutive checkpoints gets its scope halved, not its deadline moved · nobody debugs a preview API for more than 45 min without invoking its named fallback · the backup video exists from July 7 and is re-recorded at H18–21.

---

## 7. Demo script — 3 minutes, 6 beats (rehearse until boring)

1. **(0:00)** Normal moment. Feed shows Maria's profile: *travelling with her 6-year-old, can't take stairs, Shinjuku platform B2.* One line of setup: "This state was set yesterday. The agent has held it since." (kill the app, reopen, state resumes — the first persistence beat, 5 seconds).
2. **(0:20)** Quake event fires. Japanese PA clip plays over speakers. **Live Translate** streams the English on screen and in Maria's ear: *"Evacuate via the west exit."*
3. **(0:50)** Phone camera points at the printed sign 「この出口閉鎖」 → **Eyes** posts *"This exit is closed"* into the feed. The Keeper's feed shows one plain-language line: *"West exit route changed — official direction is the west concourse ramp. Confirm you're moving?"* → **one tap.**
4. **(1:20)** Point at the screen: **Scout is an Antigravity agent in a Google-hosted sandbox** — show `environment_id` resuming, `live_delta` filling: exits down, shelter 600m still open, `as_of: 8 seconds ago`. Say the line: *"This data didn't exist an hour ago. It can't be pre-packed. And it's about to survive the network."*
5. **(1:50)** **Airplane mode ON, on camera.** One second of silence. Gemma loads the cached Situation Object. Android TTS speaks: *"We're offline now. Based on the last update — take the west ramp, no stairs, shelter is 600 meters, it was open 40 seconds ago."* Maria asks a follow-up out loud; Gemma (audio input!) answers from the frozen state.
6. **(2:30)** Close: *"Everything you saw is one JSON object. Held by the Interactions API online. Handed to the phone when the network died. Live Translate got the world in; Antigravity kept it; Gemma wouldn't let it go. Agents that forget end at the snapshot — ours starts there."*

The two pre-decided pitch admissions (say them before judges think them): "Yes, Japan has J-Alert and offline Maps — they tell you a quake happened and show a static map; they don't read the handwritten sign, translate the live PA, remember the child, or survive the cut with *current* data." And: "Gemma reasons; Android TTS voices it — the model is text-out."

---

## 8. Judge Q&A armor

- **"Why not Google Maps offline + Translate offline + J-Alert?"** → Static vs live. The value is the *disruption delta* — which exits are down *right now*, current official direction, shelter capacity as of a minute ago — fused with Maria's personal constraints. None of those tools hold state about *her*, and none carry live data across the network cut.
- **"Delete test — remove Live Translate?"** → Maria can't understand the PA, the staff, or the signs. There is no input. Product dead.
- **"Remove the Interactions/Antigravity state?"** → Nothing accumulates, nothing serializes, offline mode has nothing to reason over. Product dead.
- **"Remove Gemma?"** → Product survives online-only — *which is exactly why Gemma is the fallback layer and not our judged spine.* (This honesty is the answer; it shows we read the rubric.)
- **"Isn't multi-agent overkill?"** → It's one coordinator + four single-purpose workers with one shared object and one writer. Flat topology, fixed routing, no agent-calls-agent graph. The multi-agent shape exists because the inputs are physically parallel (mic, camera, web), not for decoration.
- **"What about hallucinated directions in a life-safety context?"** → Guide only speaks fields present in the Situation Object; every instruction carries its `as_of` timestamp; the one irreversible-ish action (embassy registration, if shown) is behind explicit one-tap confirmation — mirroring Google's own Computer Use safeguard philosophy.
- **"Privacy?"** → Offline phase: location and camera never leave the device. Online phase: state is per-session, in a Durable Object you can point at.
- **"Is this real Antigravity use or a name-drop?"** → Show the Scout's `environment_id` resuming across cycles — the track's own second example pattern, live.

---

## 9. Execution

The hackathon is live (July 4 evening → July 5, 13:00). Sections 5–6 of this document (pre-event phases and the 24h event plan) are superseded by **`AEGIS-12h-sprint.md`** — the hour-by-hour runbook with the priority ladder, per-person track guides, checkpoints, demo script, and AI-leverage rules. This document remains the reference for: the verified-facts firewall (§1), the rubric mapping (§2), the architecture (§3), and the judge Q&A armor (§8).

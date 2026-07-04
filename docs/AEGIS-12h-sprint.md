# AEGIS — 12-Hour Sprint Runbook (Deep Version)
### 5 people · hackathon is LIVE NOW · submission deadline: **July 5, 13:00**
### Clock anchor: **H0 = tonight. H12 = 12 hours later.** Freeze at H10.5. Submit by 12:30 tomorrow, not 12:59.
### Read order for a teammate joining cold: §1 (what we're building) → §3 (the JSON) → your own track in §6 → §7 (checkpoints). 15 minutes, then build.

---

## 1. What we are building, in plain words

A person named **Maria** is a tourist in Tokyo with her 6-year-old daughter. She speaks English, not Japanese. She cannot use stairs (she's carrying the child). An earthquake hits while she's on a subway platform.

Our app is her companion. It does five things, in this order:

1. **It hears the world for her.** The station loudspeaker (PA) shouts instructions in Japanese. Our app translates them into English in her ear, live, as they're spoken — using Google's **Live Translate** model.
2. **It reads the world for her.** She points her camera at a Japanese sign taped to an exit. The app tells her: "This says: this exit is closed."
3. **It remembers her.** It knew *before* the quake that she has a child and can't take stairs. Every new piece of information (the PA announcement, the sign, live disruption data from the web) gets merged into one growing memory of her situation. This memory lives on a server and survives app restarts — that's the **Interactions API / Antigravity** part, the thing this track is judged on.
4. **It fetches what can't be pre-downloaded.** A background agent (the **Scout**, running as Google's Antigravity agent) browses the live web for things that didn't exist an hour ago: which exits are closed *right now*, which shelter still has room. This is why our app beats offline Google Maps — Maps has static data; we have the live delta.
5. **The magic trick: when the phone loses signal, the app keeps working.** Because every update to Maria's situation was silently saved onto the phone as it arrived, a small AI model that lives ON the phone (**Gemma 4**) picks up that saved memory and keeps answering her questions and guiding her — with no internet at all. On stage, we turn on airplane mode and the app keeps talking. That's the moment that wins.

What the judges see: a phone, a feed of plain-English updates, ONE button to tap, a visible agent ID that proves state is resuming server-side, and then airplane mode + the app still guiding. Three minutes.

---

## 2. Words you will see all night (30-second glossary)

- **Situation Object** — one JSON document that IS Maria's entire situation. The whole project is reading from and writing to this one object. Full spec in §3.
- **Keeper** — the component that owns the Situation Object. Nothing else is ever allowed to write it. It runs as a Cloudflare **Durable Object**.
- **Durable Object (DO)** — a tiny Cloudflare server that exists once per session, processes one message at a time (so two writes can never collide), and keeps its data. Think: "a single-threaded mini-server with memory, addressed by an ID."
- **WebSocket** — a phone↔server connection that stays open, so the server can *push* updates to the phone instantly (instead of the phone asking every second).
- **Interactions API** — Google's API where the *server* remembers your conversation. You send a message, get back an `id`; next time you send `previous_interaction_id: <that id>` and Google continues with full memory. This is the track's judged primitive.
- **Antigravity agent** — a ready-made Google agent on the Interactions API that lives in a Google-hosted Linux box: it can browse the web and run code in there. You resume its box by sending back its `environment_id`. Our Scout IS this agent.
- **Live Translate** — Google's `gemini-3.5-live-translate-preview` model: audio goes in (any of 70+ languages), translated audio/text streams out with only seconds of delay. Used over the **Live API** (a streaming WebSocket connection to Gemini).
- **Gemma 4 E2B / E4B** — small open Google models that run ON the phone with no internet. They accept audio and images IN but only produce text OUT (important: they cannot speak — the phone's own text-to-speech voices them).
- **PWA** — our app is a web page with an installable manifest + a **service worker** (a background script in the browser that caches the app and the model files so the page works offline).
- **IndexedDB / localStorage** — the browser's on-phone storage. This is where every Situation Object update gets saved as it arrives.
- **Emit an event** — a worker (Listener/Eyes/Scout) sends a small JSON message to the Keeper saying "here's one new fact." Workers never touch the Situation Object directly.

---

## 3. The Situation Object — the contract all five of us build against

Frozen at Hour 0. After sign-off, changing a field name requires all five to agree, because everyone's code depends on these exact names.

```json
{
  "session_id": "aegis-maria-001",
  "interaction_chain_id": null,
  "scout_environment_id": null,
  "user": {
    "name": "Maria",
    "language": "en",
    "constraints": ["child_age_6", "no_stairs"],
    "location": { "station": "Shinjuku", "level": "B2_platform_9" }
  },
  "event": { "type": "earthquake", "magnitude_reported": "5+", "t0": null },
  "environment": [],
  "live_delta": {
    "exits_down": [],
    "official_evac_direction": null,
    "shelters": [],
    "as_of": null
  },
  "guidance": {
    "current_instruction_en": null,
    "next_question": null
  },
  "network": { "online": true, "last_serialized_to_device": null }
}
```

Field-by-field — who writes it, from what:

| Field | Written by | From | Example after 2 minutes of demo |
|---|---|---|---|
| `interaction_chain_id` | Keeper | the `id` returned by each Interactions API call | `"itx_8f3..."` — display it in the UI; it's proof of the judged primitive |
| `scout_environment_id` | Keeper | first Antigravity response | `"env_a91..."` — display it too; "resuming via environment ID" is literally in the track text |
| `user.*` | Keeper, once, at session start | the pre-demo setup | (unchanged all demo — that's the point: it *persisted*) |
| `environment[]` | Keeper | Listener + Eyes **events** | `{"src":"PA","ja":"西口へ避難してください","en":"Evacuate via the west exit","t":"..."}` |
| `live_delta.*` | Keeper | Scout **events** | `exits_down: ["east","south_stairs"]`, one shelter `{name, capacity:"open", dist_m:600, step_free:true}`, `as_of:` timestamp |
| `guidance.*` | Keeper | its own Interactions-API reasoning call | `"Take the west concourse ramp — no stairs. Shelter 600m, still open."` |
| `network.*` | Keeper (online) / client (offline flag) | WebSocket state | — |

An **event** (what workers emit) is always this shape — nothing else crosses the wire from workers:

```json
{ "type": "pa_translation" | "sign_read" | "delta_update" | "user_utterance" | "user_tap",
  "payload": { }, "t": "<ISO timestamp>", "src": "listener" | "eyes" | "scout" | "client" }
```

**The one law: only the Keeper writes the Situation Object. Everyone else emits events.** The Durable Object enforces this physically (it processes one message at a time), but the law must also live in your heads: if you catch yourself writing state from a worker, stop.

---

## 4. Nothing is cut — everything is SEQUENCED (the priority ladder)

Every feature is in the plan. Features enter the build in rungs; a rung unlocks only when the rung below is demo-clean. AI-assisted velocity (§9) is what makes upper rungs reachable — the ladder order is what guarantees a demo exists at H10.5 even if velocity disappoints.

**Rung 1 — the spine (hours 0–8, must exist):** voice → Live Translate → Keeper state → feed + one-tap → Scout (Antigravity) `live_delta` → save-to-phone → airplane mode → Gemma continues offline.

**Rung 2 — unlocks at the H5 green (online loop clean):**
- **Computer Use embassy beat:** one-tap "register Maria on the embassy crisis portal" → `gemini-3.5-flash` with the `computer_use` tool drives Playwright against our own staged portal page, non-headless so judges watch it click, with the explicit-confirmation safeguard shown before submit. Owner: Person C after Scout.
- Camera beat polished (repeat captures, nicer overlay).

**Rung 3 — unlocks at the H8 green (handoff clean):**
- **Gemma E4B replaces E2B** if the phone's speed allows (both files already on disk from H0 — it's a file swap).
- Shelter routing uses Scout's live numbers instead of the static dataset.
- Trace log upgraded to a readable timeline (still not a dashboard — a dashboard reads as "normal chatbot" to these judges).

**Rung 4 — only if the H10 full run is green with time to spare:** second-city pack shown in UI · live mic for one rehearsed beat (clips stay the stage default) · native Capacitor wrapper.

**Two implementation choices that are NOT cuts (same demo, safer engineering):**
- **PWA in Chrome on the phone, not a native APK.** Airplane mode still works — the service worker has cached the app and the model. One codebase = the AI agents iterate it fastest. Native wrapper is a Rung-4 option.
- **Scout tries Antigravity FIRST** (it's the judged primitive), with a hard 2-hour timebox. The pre-decided fallback (`gemini-3.5-flash` + Google Search grounding, resume-beat shown on the Keeper's `previous_interaction_id` chain instead — equally in the track text) fires only on failure. A fallback is not a cut.

**The protecting rule:** nobody starts a higher rung while their lower rung is red. AI speed is real for writing code; it is NOT real for preview-API debugging, phone quirks, and integration — which is where hackathon nights actually die.

---

## 5. Hour 0 — the only meeting (30 minutes, everyone, checklist)

- [ ] All five read §1 and §3 of this doc. Schema signed off out loud. The one law ("only the Keeper writes") said out loud.
- [ ] Repo created. Folders: `/keeper` (Cloudflare project), `/client` (PWA), `/workers/listener`, `/workers/eyes`, `/workers/scout`, `/staged` (fake portal + metro pages), `/assets` (audio, signs, datasets), `/docs` (this file + build plan).
- [ ] **Start BOTH Gemma downloads now** — they run while you build:
  - E2B: Hugging Face → `litert-community/gemma-4-E2B-it-litert-lm` (~1.3GB)
  - E4B: search `litert-community` on Hugging Face for the E4B `.litertlm` / MediaPipe `.task` equivalent (~2.5GB)
  - Person D also grabs the **MediaPipe web `.task`** variant for browser inference (check the MediaPipe LLM Inference web docs for the exact supported file — Rule 1 of §9 applies: verify on the doc page, don't guess).
- [ ] Demo phone prep: Chrome installed · Settings → Text-to-speech → **download the offline English voice** · test airplane-mode toggle · phone hotspot tested as wifi backup · charger assigned.
- [ ] AI Studio API keys into a shared `.env`. Every person makes ONE successful API call of any kind to confirm their key works. 2 minutes each, kills a classic 2 a.m. surprise.
- [ ] **One person checks the official submission requirements right now** (portal/Devpost: video? repo link? demo slot? team registration?). Write the answers at the top of this file.
- [ ] Assets kickoff (Person C owns): generate 3 Japanese PA clips with AI Studio TTS (scripts in §6-C), print or draw the 「この出口閉鎖」 sign, write the 5-row Shinjuku shelter dataset.

---

## 6. Track guides — step by step, per person

Every track has the same rhythm: **scrape the official doc into your Claude Code session first (§9 Rule 1) → adapt reference code, don't greenfield → emit events in the §3 shape → prove your slice solo before integrating.**

### 6-YOU · Keeper + integration (the spine role, H0–H12)

**H0–H1 — the skeleton everyone else plugs into:**
1. `npm create cloudflare@latest keeper` → choose Worker + Durable Object template, TypeScript or JS, your call.
2. In the DO class: accept WebSocket upgrades; keep a set of connected sockets; on any incoming message, echo it to all sockets. That's it — an echo hub.
3. `npx wrangler deploy` → you get a `*.workers.dev` URL.
4. On the demo phone's Chrome, open a scratch page that connects to `wss://<your-url>` and sends "hello". See it echo. **The moment the phone echoes, announce it — all four workers now have a live endpoint to emit into.**

**H1–H3 — reconciliation (the Keeper's actual brain):**
1. Hold the Situation Object in the DO's storage (`state.storage.put/get`) so even a DO restart keeps it.
2. On each incoming event, a **fixed if/then** (not an AI call) merges it: `pa_translation`/`sign_read` → append to `environment[]` · `delta_update` → merge into `live_delta`, stamp `as_of` · `user_tap` → mark the pending guidance confirmed · `user_utterance` → forward into the reasoning call below.
3. After each merge, ONE call to the **Interactions API** (doc scraped first): send the current object + the new event, with `previous_interaction_id` from last time, asking for exactly this JSON back: `{ "surface_now": true|false, "plain_line_en": "...", "next_question": "...", "needs_tap": true|false }`. Store the returned `id` as `interaction_chain_id`.
4. Write the model's answer into `guidance.*`, then **push the ENTIRE Situation Object to every connected socket.** Full object every time — that's what makes D's cache trivially correct.
5. Test with fake events via `curl` or a scratch script before any real worker connects.

**H3–H5 — wire real workers in** (A, then B, then C, in whatever order they're ready). **H5–H8 — the handoff with D** (your side: nothing! the client caches; you just keep pushing full objects — verify with D that what's in the phone's IndexedDB matches your canonical object). **H8–H12 — you conduct:** checkpoints, integration bugs, demo drilling. You write no new features after H8.

### 6-A · Listener (Live Translate, H1–H5)

1. Scrape `ai.google.dev/gemini-api/docs/live-api/live-translate` into your session.
2. In AI Studio, open **World Radio Translator** from the showcase → **Remix** → read its source. It already does your hard part: a Live API session with `gemini-3.5-live-translate-preview`, audio streamed in, translation streamed out. Keep the wiring, delete the radio UI.
3. Feed it a Japanese PA clip (from `/assets`) instead of radio. Confirm English comes out < 5 seconds behind.
4. Wrap it: for each translated utterance, emit `{type:"pa_translation", payload:{ja, en}, src:"listener"}` to the Keeper's WebSocket.
5. Second input path: Maria's own voice (English) → same Live API session or a plain transcription call → `{type:"user_utterance"}` events.
6. **Done =** clip plays on a speaker → within 5s an event lands in the Keeper → the feed shows the English line. Prove it solo with the echo hub before H5.
7. If the preview model flakes for >45 min: fallback = Live API with the normal native-audio Gemini model + a "translate everything you hear to English" system prompt. Worse, works, pre-approved.

### 6-B · Eyes (H1–H3) then the UI (H3–H8)

**Eyes (keep it tiny):**
1. One endpoint: photo in → `gemini-3.5-flash` with an image part + prompt: *"Read any Japanese text in this image. Return only JSON: {ja, en, type: 'exit_closed'|'direction'|'other'}"*.
2. Client capture = a button that takes a photo (`<input type="file" capture>` or getUserMedia snapshot). **No continuous video streaming — that's Rung 2 polish.**
3. Emit `{type:"sign_read", payload:{ja,en,type}, src:"eyes"}`. **Done =** photo of the printed 出口閉鎖 sign → correct English in the feed.

**UI (the judges' window — legible from 3 meters):**
- A single screen: **(a)** big current-instruction card (from `guidance.current_instruction_en`) with its `as_of` age ("updated 40s ago"), **(b)** ONE confirm button when `needs_tap` is true → emits `{type:"user_tap"}`, **(c)** scrolling feed of `environment[]` and `live_delta` lines, **(d)** a status strip showing `interaction_chain_id`, `scout_environment_id`, and ONLINE/OFFLINE — the strip is your proof-of-primitive on camera, **(e)** plain-text trace log behind a toggle.
- Use `frontend-design:frontend-design` ONCE at H3 for the layout, then stop iterating on looks forever.

### 6-C · Scout (H1–H3 timebox) → staged pages (H3–H5) → Computer Use, Rung 2 (H5–H8) → pitch (H8–12)

**Assets first (do at H0–H1, everything depends on them):** PA clip scripts for AI Studio TTS — clip 1: 「地震が発生しました。落ち着いて行動してください」(earthquake occurred, stay calm) · clip 2: 「西口へ避難してください」(evacuate via west exit) · clip 3: 「東口は閉鎖されています」(east exit is closed). Plus the printed sign and the 5-row shelter dataset (name, dist_m, step_free, capacity).

**Scout via Antigravity (hard 2-hour timebox):**
1. Scrape `ai.google.dev/gemini-api/docs/antigravity-agent` + `interactions-overview`.
2. Create an interaction with the Antigravity agent. Task prompt: *"Browse <our staged metro-status URL>. Extract: closed exits, official evacuation direction, shelter statuses. Return only JSON matching this schema: {exits_down[], official_evac_direction, shelters[]}"*.
3. From the response, capture **`environment_id`** and the interaction `id`. Run a SECOND cycle passing both back — the doc says this reuses the same sandbox. That resume is the track's own example pattern; hand both IDs to B for the status strip.
4. Wrap as a loop the Keeper can trigger ("flood now" on quake event) → emit `{type:"delta_update"}` events.
5. **H3 hard stop:** filling `live_delta` reliably → keep. Not → 30-minute flip to `gemini-3.5-flash` + Google Search grounding tool reading the same staged pages; the resume-beat then shows on the Keeper's `previous_interaction_id`. Flip is pre-approved; zero discussion, zero mourning.

**Staged pages (H3–H5, static HTML on Cloudflare Pages):** a fake "Tokyo Metro status" page (table of lines/exits with statuses — deterministic, so Scout's extraction can't surprise you) · a fake shelter-status page · a fake **embassy crisis-registration portal** (login page → one form: name, nationality, location, companions → confirmation page with a reference number). Ugly on purpose. The portal is Rung 2's target — build it now while it's cheap.

**Computer Use, Rung 2 (only after the H5 green):**
1. Scrape `ai.google.dev/gemini-api/docs/computer-use`; clone `google-gemini/computer-use-preview`.
2. Point it at the staged portal, task: "register Maria (…details from the Situation Object…) for crisis assistance." Playwright **non-headless** — judges watch it click.
3. Gate the final submit behind the one-tap confirm (matches Google's own safeguard story — say that to judges).
4. Hard stop H8: working → it's beat 4.5 of the demo; not → one roadmap sentence.

**Pitch (H8–H12):** 7 slides max — problem · the gap Google's own tools don't cover · the loop diagram · the two primitives + IDs on screen · the handoff · **the business slide (§8.5 — the VCs are judging too)** · roadmap. Print the demo narration (§8), the technical Q&A sheet (build plan §8), and the VC Q&A sheet (§8.5).

### 6-D · Client + offline Gemma (H1–H8, the second-hardest track)

**H1–H3 — PWA shell:**
1. Vite (or plain) web app on Cloudflare Pages. Connect to the Keeper's WebSocket.
2. **THE line of code the whole demo trusts:** on every message (a full Situation Object), write it to IndexedDB before doing anything else. The latest state is therefore *always already on the phone* — the "handoff" later is just a read.
3. Render B's UI components from the incoming object. Manifest + service worker registered from the start (cache app shell now, model files later).

**H3–H6 — offline brain (verified against docs, July 4):**
1. Scrape the MediaPipe **LLM Inference (web)** guide (`ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/web_js`) and clone the official sample: `google-ai-edge/mediapipe-samples` → `examples/llm_inference/js`. Use the **web-converted model file specifically**: `gemma-4-E2B-it-web.task` from the litert-community Hugging Face page — models WITHOUT `-web` in the name will not run in the browser. Get ANY prompt→response working on the LAPTOP first, then the phone. This is the riskiest single step of the night — start it before the fatigue does.
   - Heads-up for judge Q&A: the MediaPipe LLM web API is in **maintenance mode** (stable, documented — fine for tonight); Google's forward path is LiteRT-LM. If a technical judge asks, the answer is: *"MediaPipe web for the demo, LiteRT-LM native as the production path — same .litertlm weights."* That's a roadmap answer, not a weakness.
2. Service worker caches the model file (it's big — cache on first load over hotel/venue wifi, verify it serves from cache with wifi off).
3. Offline detection: WebSocket `onclose` + `navigator.onLine` false → flip UI to OFFLINE → read last object from IndexedDB → start the offline loop.
4. Offline loop: user speaks (or types) → prompt Gemma with the **pack prompt** below + the frozen object + the question → render answer as the instruction card → speak via `speechSynthesis`.

**The pack prompt (the only novel prompt of the project — tune it H6–H8):**
> You are AEGIS running offline on a phone during an earthquake in Tokyo. The internet is gone. Below is the last known situation, saved before the connection was lost. Rules: (1) Reason ONLY from this data — never invent exits, shelters, or directions not present in it. (2) Give ONE instruction at a time, short enough to follow while walking. (3) Always respect the user's constraints (child, no stairs). (4) Always state how old the data is, from `as_of`. (5) End with one short clarifying question. (6) If asked something the data can't answer, say so plainly and give the safest general guidance.
> SITUATION: `<the frozen JSON>`

Test it deliberately with stale (`as_of` 10 min old) and partial (empty shelters) state — judges may ask "what if the data is wrong."

**H6–H8 — polish the switch:** airplane mode → OFFLINE flip → first Gemma instruction spoken within ~10s. If web inference is too slow on the phone (>20s per answer): E2B stays (it's the default; E4B was the upgrade) → still too slow: **AI Edge Gallery fallback** — the client exports the pack (frozen JSON + prompt) as a file; you open it in Gallery with Gemma loaded, side-by-side on the same phone. Weaker theatre, same proof.

---

## 7. Checkpoints — how to test each one, literally

A checkpoint is green only when the loop ran **3 times in a row, watched, on the actual demo phone** (`superpowers:verification-before-completion` standard). "Worked once on my laptop" is red.

| Hour | Gate | The literal test | If red |
|---|---|---|---|
| **H1** | Echo | Phone Chrome sends "hello" over WSS, sees it come back | You solo-fix; others build against fake objects |
| **H3** | Scout decision | Two Antigravity cycles completed, same `environment_id`, `live_delta` filled | Automatic flip to grounded search (pre-approved) |
| **H5** | **Online loop** | Play PA clip on a speaker → English line in feed → guidance card updates → tap confirm → spoken guidance heard. ×3 | Everyone swarms it; no Rung 2 starts until green |
| **H8** | **Handoff** | Airplane mode ON → OFFLINE flip → ask Gemma a question out loud → correct answer spoken from frozen state. ×3 | E4B→E2B→Gallery ladder; decision in 5 minutes |
| **H10** | Full demo | All 6 beats (§8), timed under 3:30, ×1 clean | Cut the weakest beat (camera) → run 5-beat |
| **H10.5** | **FREEZE** | No code after this. Ever. | — |
| H10.5–11 | Backup video | Record the cleanest full run: phone screen + narration | Non-negotiable insurance |
| H11–12 | Rehearse ×2 | With C's printed script | Sleep rotation starts |

**Endgame (after H12 → 13:00):** sleep in two shifts, integrators first, nobody touches code → rehearse ×5 + Q&A drill + latency-test every API from the venue network/hotspot → re-record backup video if morning runs are cleaner → **submit by 12:30** → 30-minute buffer for the upload that fails. Only exception to the freeze: a bug that breaks beats 2, 4, or 5 in morning rehearsal — one person, 45-minute timebox, others rehearse the fallback.

Standing rules: 45-minute max on any preview-API fight before its named fallback · a component missing two checkpoints has its scope halved, never its deadline moved · only the Keeper writes state, ever.

---

## 8. The demo — word for word (3 minutes, 6 beats + the Rung-2 beat)

1. **(0:00)** Feed shows Maria's profile. Say: *"Maria set this up yesterday — she's travelling with her six-year-old and can't take stairs. Watch."* Kill the app. Reopen. State resumes; point at the `interaction_chain_id` on the status strip. *"The agent held it. Server-side. That's the Interactions API."*
2. **(0:20)** Play PA clip 2 over a speaker. English streams onto the card: *"Evacuate via the west exit."* Say: *"That's Live Translate — she's hearing this in her ear, live."*
3. **(0:50)** Point the camera at the printed sign → *"This exit is closed"* lands in the feed. The guidance card updates: *"West exit route changed — take the west concourse ramp. Confirm you're moving?"* → **tap once.**
4. **(1:20)** Point at the status strip: *"This is an Antigravity agent in a Google-hosted sandbox — same environment ID, resuming every cycle."* Show `live_delta`: exits down, shelter 600m open, **`as_of: 8 seconds ago`**. Say the line: *"This data didn't exist an hour ago. It can't be pre-packed. And it's about to survive the network."*
   - **(Rung 2, if green)** *"And because she's a foreign national — one tap files her with her embassy."* Tap → Playwright window visibly clicks through the portal → confirmation number lands in the feed. *"Gated behind explicit confirmation — Google's own safeguard pattern."*
5. **(1:50)** **Airplane mode ON, on camera.** One breath of silence. The phone speaks: *"We're offline now. Based on the last update — take the west ramp, no stairs, shelter is 600 meters, it was open 40 seconds ago."* Ask it out loud: *"Is the shelter suitable for my daughter?"* — Gemma answers from the frozen state. *"No internet. The model is on the phone, reasoning over the state the agent built while it was alive."*
6. **(2:30)** Close: *"Everything you saw is one JSON object. Live Translate got the world in. The Interactions API held it. Gemma wouldn't let it go. Most agents forget the second the task ends — ours hands its memory to the phone and keeps going."*

Pre-decided admissions, said before judges think them: *"Yes — Japan has J-Alert and offline Maps. They tell you a quake happened and show a static map. They don't read the handwritten sign, translate the live PA, remember the child, or carry live data across the network cut."* And: *"Gemma reasons; Android's TTS voices it — the model is text-out."*

---

## 8.5 The VC minute — because the panel isn't only technical

The RAISE judging room includes VCs (the summit's own materials name Sequoia and 20VC-type panels, and their pitching guidance says: clarity, business potential, narrative, market impact). A perfect demo with no business story loses to a decent demo with one. So the demo's last 45 seconds — after beat 6 — is the business close. Word for word:

> *"Who pays for this? Not Maria — her employer and her insurer do. Duty-of-care for travelers and field workers is a multi-billion-dollar industry today — companies like International SOS charge enterprises per employee per year to keep traveling staff safe, with call centers and human coordinators. We just showed the coordinator as software: one that hears every language, never sleeps, and keeps working when the network doesn't. The consumer crisis app you saw is the demo skin. The product is the loop — field signal in any language → held state → action — and it re-skins to construction sites, logistics fleets, and remote operations without changing a line of the architecture. It only became buildable this quarter: live speech translation, stateful server-side agents, and phone-sized multimodal models all shipped within months of each other. We're the first team to chain them into one system that refuses to forget."*

**VC Q&A sheet (drill these alongside the technical sheet):**
- **"Who's the customer?"** → B2B: travel insurers, enterprises with duty-of-care obligations, NGOs with field staff. Per-seat subscription. The consumer app is the wedge and the demo, not the business.
- **"Market size?"** → Travel risk management / duty-of-care services is a multi-billion-dollar market growing with corporate travel recovery; 1.4B+ international trips a year is the top of the funnel. (Don't invent a precise TAM number on stage — "multi-billion, we'll size the wedge with our first insurer partner" is more credible than a fake $47B.)
- **"Why now?"** → All three primitives (Live Translate, stateful Interactions/Antigravity agents, phone-class multimodal Gemma) shipped in the last few months. This system was not buildable in January.
- **"What's the moat? Google could build this."** → Honest answer scores: "The primitives are Google's; the system is ours. The moat is the state-handoff architecture, the vertical integrations (insurer case systems, site portals), and the incident data that accumulates per deployment. Google ships primitives, not duty-of-care products — we're a customer of theirs, not a competitor."
- **"How does this make money in 12 months?"** → Pilot with one travel insurer or one enterprise travel program; charge per protected seat; the crisis loop is the headline, the everyday value (translation + state across a whole trip) drives daily engagement.
- **"Why you?"** → Five builders who shipped a three-primitive stateful system in 12 hours, on preview APIs, that survives a network cut on stage. Execution is the pitch.

---

## 9. AI Leverage Playbook — how to actually use the agents tonight

**Rule 1 — never let the AI guess a Google API** (the #1 way to lose 2 hours tonight). Before writing any Gemini code, scrape the official doc into the session: `/firecrawl-scrape` on the live-translate doc (A) · interactions-overview + antigravity-agent docs (You, C) · computer-use doc (C, Rung 2) · MediaPipe LLM web docs (D). Pull the World Radio Translator / Vision Sync remix source in the same way. **The build plan's §1 verified-facts table is the firewall: any API call not traceable to a scraped doc gets rejected.** (The hallucinated `from google.antigravity import ...` snippets from earlier chats are the cautionary tale.)

**Rule 2 — parallel tracks = parallel git worktrees** (`superpowers:using-git-worktrees`). Five people, one repo, one frozen schema, everyone codes against a fake Situation Object, integration happens only at the Keeper.

**Rule 3 — skill map per track:** You → `engineering-skills:senior-backend` for the DO design, `superpowers:executing-plans` with this file as the plan · A → remix-first, never greenfield · B → `frontend-design:frontend-design` once at H3 · C → reference repos first, Claude Code adapts · D → `engineering-skills:senior-frontend` for the PWA/service-worker/IndexedDB plumbing. Anyone stuck → `superpowers:systematic-debugging`, 45-minute timebox, then the named fallback.

**Rule 4 — protect context across the night:** before each checkpoint (H5, H8, H10), everyone runs `/remember` so a compacted session resumes with full task state. This file lives in the repo; every fresh session reads it first.

**Rule 5 — verification is a skill, not a feeling:** checkpoint greens use the 3×-on-the-phone standard (§7). Before the H10.5 freeze, You run `/code-review` on the Keeper's reconciliation logic only — the single component where a silent bug corrupts everything downstream.

**Rule 6 — humans own what AI can't do tonight:** pointing hardware at the real world (phone testing, camera, speakers, airplane mode) and making checkpoint decisions. Everything else — boilerplate, wiring, staged pages, prompts, pitch draft — is delegated to the agents while humans test on hardware.

---

## 10. Risk table

| Risk | Odds | Owner | Pre-decided answer |
|---|---|---|---|
| Live Translate preview flakes | Med | A | Live API native-audio model + translate system prompt |
| Antigravity slow/quota-limited | Med | C | H3 flip to Search grounding; resume-beat via Keeper's chain |
| Web Gemma too slow on the phone | Med | D | E4B→E2B→AI Edge Gallery side-by-side |
| Offline TTS silent | Low | D | Large-type on-screen instruction + live narration |
| Venue wifi/latency | Med | You | Hotspot as primary; all APIs latency-tested in the morning; backup video exists from H10.5 |
| Computer Use eats Person C's night | Med | C | It's Rung 2 with an H8 hard stop — it cannot touch the spine by construction |
| Scope creep ("add feature X back to Rung 1") | **High** | All | The ladder (§4). Read it aloud to whoever proposes it |
| Context loss in long AI sessions | Med | All | Rule 4: `/remember` at every checkpoint |

---

## 11. Minute one

You: `npm create cloudflare@latest` → DO → WebSocket echo. D: start both Gemma downloads, then the PWA shell. C: PA clips through AI Studio TTS first (every later hour needs them), then Antigravity. A: scrape the Live Translate doc, open the World Radio Translator remix. B: the vision endpoint. One person confirms the submission format. Go.

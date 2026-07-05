# AEGIS — Android App Implementation Plan

## One-line goal
A survival AI companion for a foreigner caught in a crisis abroad: talks to them live via Gemini, pre-loads everything into an encrypted on-device vault while there's signal, and keeps guiding them offline via Gemma 4 when the network dies.

---

## 1. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Language | **Kotlin** | Modern Android, coroutines, first-class Jetpack support |
| UI | **Jetpack Compose** | Declarative, fast to build, no XML |
| Audio I/O | **AudioRecord + AudioTrack** | Raw PCM access needed for Gemini Live API |
| Online speech | **Gemini Live API** (WebSocket) | Bidirectional audio + Live Translate |
| Offline model | **LiteRT-LM + Gemma 4 E2B** | On-device, ~5GB, native audio input |
| Offline TTS | **Android TextToSpeech** | No network required |
| Backend sync | **OkHttp WebSocket** → Keeper at `aegis-keeper.devstar7014.workers.dev` |
| Offline map | **MapLibre Android SDK + PMTiles** | OSM-based, cacheable, rights-safe |
| Vault encryption | **Android Keystore + EncryptedSharedPreferences + Room** | Keys never leave device |
| Background agents | **WorkManager** | Scout cycle every 12h |
| Networking | **OkHttp + Gson** | Simple, reliable |
| DI | **Hilt** | Standard Android DI |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                  AEGIS Android App                  │
│                                                     │
│  ┌──────────┐   ┌──────────┐   ┌─────────────────┐ │
│  │  Voice   │   │   Map    │   │  Vault / Agents  │ │
│  │  Screen  │   │  Screen  │   │    Inspector     │ │
│  └────┬─────┘   └────┬─────┘   └────────┬────────┘ │
│       │              │                  │           │
│  ┌────▼──────────────▼──────────────────▼────────┐  │
│  │              ViewModel layer (StateFlow)       │  │
│  └────┬─────────────────────────────────┬────────┘  │
│       │                                 │           │
│  ┌────▼──────────┐           ┌──────────▼─────────┐ │
│  │  AudioManager │           │   SituationStore   │ │
│  │  (Live/Gemma) │           │   (Room, encrypted)│ │
│  └────┬──────────┘           └──────────┬─────────┘ │
│       │                                 │           │
└───────┼─────────────────────────────────┼───────────┘
        │ Online                          │ Always
        ▼                                 ▼
  Gemini Live API              Keeper WebSocket
  (audio streaming)          aegis-keeper.devstar7014
                                  .workers.dev
        │ Offline
        ▼
  Gemma 4 E2B
  (LiteRT-LM, on-device)
```

**One law:** `SituationStore` is the single source of truth. Every Keeper WebSocket push overwrites it entirely (same law as the web PWA). Gemma reads from it; it never writes to it.

---

## 3. Screens

### 3.1 Onboarding (first launch only)
- **Language selection**: user's native language (default: auto-detect from system)
- **Home country + city**: pre-fills embassy lookup
- **Identity vault (optional)**: passport number, emergency contact, blood type — stored encrypted, never transmitted without confirmation
- **Model download**: trigger Gemma 4 E2B download (~5 GB). Show progress bar. Explain why: "This model stays on your phone — it works when there's no internet."
- **Map region pre-load**: based on current location, download PMTiles for 50km radius

### 3.2 Home / Voice Screen (main screen)
```
┌─────────────────────────────────────────┐
│  ONLINE  •  itx: v1_ChdH…  env: 007a…  │  ← status strip
├─────────────────────────────────────────┤
│                                         │
│   "Find an escalator or elevator        │
│    towards the surface. Do not          │
│    use stairs."                         │  ← big guidance card
│                                         │
│   live data as of 3min ago              │
│                                         │
│   [  ✓ Confirm  ]                       │  ← appears when needs_tap
│                                         │
├─────────────────────────────────────────┤
│  PA: 「新宿駅は…」→ "Shinjuku station…" │  ← live translate feed
│  Scout: 8 shelters found                │
│  Alert: No major warnings (JMA)         │
├─────────────────────────────────────────┤
│  [🎤 Hold to speak]    [📷 Read sign]   │  ← action bar
└─────────────────────────────────────────┘
```

- **Hold to speak**: hold button → AudioRecord → stream to Gemini Live API → response streamed back as audio + text
- **Read sign**: camera capture → send to Keeper `/api/eyes` → Gemini Vision reads Japanese → `sign_read` event → displayed in feed
- Tapping the status strip opens **Agent Inspector** (Feature 5)

### 3.3 Map Screen
- MapLibre map, dark theme, centered on user's GPS location
- **Green pins**: step-free shelters from vault
- **Blue pins**: hospitals
- **Gold pin**: embassy
- Tap pin → card with name, address, estimated capacity, distance
- Offline: serves pre-downloaded PMTiles region, pins from vault (no network needed)
- Route button: online → Google Maps intent; offline → straight-line direction + distance only

### 3.4 Vault Screen
Two tabs:

**Survival Vault**
- Map region: downloaded / size / last updated
- Shelters: count, last updated
- Country context: laws, protocols, emergency numbers
- Key phrases: list (tap to hear pronunciation)
- Refresh button (triggers Scout cycle immediately)

**Identity Vault**
- Passport, emergency contacts, blood type
- All fields masked by default, tap to reveal
- "Register with embassy" button → Computer Use flow (see Feature 12)
- Red banner: "This data never leaves your device unless you tap Send"

### 3.5 Agent Inspector
Accessed via tap on status strip. Shows per-agent action trace:

```
┌─────────────────────────────────────────┐
│  CountryAgent  ✅  42s ago              │
│  ─────────────────────────────────────  │
│  Task: "Find French embassy emergency   │
│  line and Tokyo evacuation protocols"   │
│                                         │
│  > Searched: "French embassy Tokyo      │
│    emergency contact 2026"              │
│  > Found: ambafrance-jp.org             │
│  > Extracted: +81 80 9539 3970          │
│  > Verified: cross-referenced with      │
│    official embassy site                │
│                                         │
│  ShelterAgent  ✅  42s ago              │
│  ...                                    │
└─────────────────────────────────────────┘
```

This is the trust layer — shows verifiable justification, not just the result.

---

## 4. Data Model

### SituationObject (mirrors Keeper state exactly)
```kotlin
data class SituationObject(
    val session_id: String,
    val interaction_chain_id: String?,
    val scout_environment_id: String?,
    val user: UserProfile,
    val event: CrisisEvent,
    val environment: List<EnvironmentEntry>,
    val live_delta: LiveDelta,
    val country_context: CountryContext?,
    val active_alerts: List<Alert>,
    val guidance: Guidance,
    val network: NetworkState
)
```

### Vault (Room database, encrypted with Android Keystore)
```kotlin
@Entity data class VaultEntry(
    val key: String,           // "shelters", "country_context", "map_region", etc.
    val value: String,         // JSON blob
    val cached_at: Long,
    val expires_at: Long?
)

@Entity data class IdentityEntry(
    val field: String,         // "passport", "emergency_contact", "blood_type"
    val encrypted_value: String  // AES-256-GCM, key in Android Keystore
)
```

---

## 5. Audio Pipeline

### Online (Gemini Live API)
```
Mic → AudioRecord (16kHz, 16-bit PCM mono)
    → WebSocket chunks (100ms / 3200 bytes)
    → Gemini Live API (model: gemini-2.5-flash-live or live-translate)
    → Response audio stream → AudioTrack playback
    → outputTranscription → display in feed
    → inputTranscription (Japanese) → display as PA translation
```

### Offline (Gemma 4 E2B via LiteRT-LM)
```
Mic → AudioRecord
    → Gemma 4 audio encoder (native, 40ms frames)
    → Pack prompt: SituationObject JSON + user question
    → Gemma text output
    → Android TextToSpeech → speaker
```

**Switching logic**: when `network.online` flips to false, `AudioManager` transparently switches from Gemini Live to Gemma. No UI change — same voice interface, different backend.

---

## 6. Keeper Integration

Connect to the deployed backend:
- **WebSocket**: `wss://aegis-keeper.devstar7014.workers.dev/ws?session=<id>`
- **Events**: POST to `/event?session=<id>` with `{type, payload, src}`
- **State**: GET `/api/state?session=<id>`
- **Eyes**: POST `/api/eyes?session=<id>` with `{image_b64, mime_type}`
- **Reset**: POST `/api/reset?session=<id>`

Session ID = UUID generated at first launch, stored in encrypted prefs. This is Maria's persistent session.

On every WebSocket message:
1. Parse full SituationObject
2. Write to Room vault (`SituationStore`)
3. Update UI via StateFlow
4. Write to EncryptedSharedPreferences as backup (survives app kill)

---

## 7. Scout (Background WorkManager)

Triggers:
- App launch (if vault older than 12h)
- GPS detects country border crossing
- User manually taps "Refresh" in Vault screen

Implementation: `PeriodicWorkRequest` (12h interval) → calls the Keeper `/event` endpoint with a `scout_trigger` event, or runs the scout logic directly via the Gemini SDK.

---

## 8. Offline Map (MapLibre + PMTiles)

- **Online**: MapLibre with standard OSM tiles (dark style)
- **Offline**: PMTiles file downloaded for 50km radius on onboarding + refreshed on city change
- PMTiles stored in app's private storage (not cloud)
- Download size: ~80–200 MB for a city region at zoom 10–17
- MapLibre loads tiles from local file: `asset://aegis_region.pmtiles`
- Shelter/hospital/embassy pins always served from Room vault (JSON, not tiles)

---

## 9. Vault Encryption

```
Android Keystore
    └── AES-256-GCM key "aegis_vault_key"
         ├── EncryptedSharedPreferences (identity fields)
         └── Room database (SQLCipher passphrase derived from keystore key)
```

Rule: identity vault data is never included in any network request unless `UserConfirmationDialog` returns true. The survival vault (shelters, map, protocols) can be read freely — it contains no PII.

---

## 10. Computer Use — Embassy Registration (Feature 12)

Triggered by: "Register with embassy" button in Identity Vault.

Flow:
1. CountryAgent already has the embassy portal URL from its action trace
2. `ComputerUseAgent` opens a headless browser session via Gemini Computer Use API
3. Shows the user what it's about to fill in: name, passport number, contact
4. User taps **Confirm** → agent submits the form
5. Confirmation receipt saved to vault

This is the ONLY Computer Use in the app. Do not use it for web search (that's grounding) or for reading alerts (that's Antigravity browsing).

---

## 11. Key Implementation Notes

### Model name references (verified 2026-07-04)
- Gemini Live: `gemini-2.5-flash` (live-enabled)
- Gemma offline: `gemma-4-E2B-it-litert-lm` (HuggingFace: `litert-community/gemma-4-E2B-it-litert-lm`)
- Interactions API: `gemini-2.5-flash`
- Antigravity: `antigravity-preview-05-2026`

### Offline hand-off — the demo moment
This is the spine. Script it precisely:
1. App is online, Scout has filled vault, guidance is showing
2. Enable airplane mode
3. WebSocket closes → status strip flips to "OFFLINE — on-device"
4. Guidance card stays (from vault)
5. Hold-to-speak → Gemma answers using vault data
6. Map shows (from PMTiles)
7. Pins show (from Room)

Nothing re-fetches. Nothing breaks. That's the point.

### Constraint: no stairs, child age 6
`user.constraints = ["child_age_6", "no_stairs"]` is passed in every prompt to Gemma and to the Keeper. Shelter pins on the map must be filtered to `step_free: true` only when these constraints are active.

### Graceful degradation
- Gemma not downloaded → offline mode shows cached text card only, no voice
- PMTiles not downloaded → offline map shows blank with pins only
- Capacity data unavailable → show "capacity unknown" on pin, never invent data
- Embassy portal structure changed → Computer Use fails gracefully, shows manual embassy phone number from vault

---

## 12. File Structure

```
app/
├── src/main/
│   ├── java/com/aegis/
│   │   ├── ui/
│   │   │   ├── voice/VoiceScreen.kt
│   │   │   ├── map/MapScreen.kt
│   │   │   ├── vault/VaultScreen.kt
│   │   │   └── inspector/AgentInspectorScreen.kt
│   │   ├── audio/
│   │   │   ├── AudioManager.kt        ← switches Live ↔ Gemma
│   │   │   ├── GeminiLiveSession.kt
│   │   │   └── GemmaSession.kt
│   │   ├── data/
│   │   │   ├── SituationStore.kt      ← single source of truth
│   │   │   ├── VaultDatabase.kt       ← Room + SQLCipher
│   │   │   └── IdentityVault.kt       ← Android Keystore
│   │   ├── network/
│   │   │   ├── KeeperWebSocket.kt
│   │   │   └── KeeperApi.kt
│   │   ├── scout/
│   │   │   └── ScoutWorker.kt         ← WorkManager 12h
│   │   └── map/
│   │       └── OfflineMapManager.kt   ← PMTiles download + serve
│   └── res/
│       └── ...
```

---

## 13. Build Order (give to AI tool one step at a time)

Feed these steps sequentially. Do not give the full spec at once — complete each step and verify it compiles before moving to the next.

### Step 1 — Project scaffold
Create a new Android project (min SDK 26, target SDK 35, Kotlin, Jetpack Compose). Add all dependencies from Section 14. Verify empty app compiles and runs.

### Step 2 — Data layer: SituationStore + Vault
Implement `SituationObject` data class (exact field names from Section 4 — must match Keeper JSON). Implement Room database with SQLCipher. Implement `IdentityVault` with Android Keystore. No UI yet — write unit tests that write/read from both stores.

### Step 3 — Keeper connection
Implement `KeeperWebSocket.kt`: connect to `wss://aegis-keeper.devstar7014.workers.dev/ws?session=demo`, parse incoming JSON into `SituationObject`, write to `SituationStore`, expose as `StateFlow<SituationObject?>`. Implement HTTP fallback for `/event` POST. Test with a real connection — you should see state updates when you trigger a quake via curl.

### Step 4 — Voice screen (online, text only first)
Build `VoiceScreen.kt` with Compose: status strip (online/offline pill + itx/env IDs), guidance card (big text), freshness label, confirm button, hold-to-speak button (no audio yet — just shows "listening…"), ask input field. Wire to `SituationStore` StateFlow. Verify guidance updates when Keeper pushes new state.

### Step 5 — Gemini Live audio (online voice)
Implement `GeminiLiveSession.kt`: AudioRecord → PCM chunks → WebSocket to Gemini Live API → audio response → AudioTrack playback. Wire hold-to-speak button to this session. Test: hold button, speak, hear response.

### Step 6 — Map screen
Implement `MapScreen.kt` with MapLibre Android SDK. Load dark OSM tiles online. Plot shelter pins from `SituationStore.live_delta.shelters` (green = step_free). Add tap → popup with name/address/capacity. No offline tiles yet.

### Step 7 — Offline map (PMTiles)
Implement `OfflineMapManager.kt`: download PMTiles for current GPS bounding box on first launch, store in private app storage. Configure MapLibre to use local PMTiles when offline. Verify: enable airplane mode → map still shows.

### Step 8 — Gemma 4 offline takeover
Implement `GemmaSession.kt` using LiteRT-LM. Load model from local storage. Pack prompt = SituationObject JSON + user question (same prompt as `packPrompt` in web PWA). Wire `AudioManager.kt` to switch from `GeminiLiveSession` to `GemmaSession` when network drops. Add Android TTS for voice output. Test the hand-off: go online → trigger quake → enable airplane mode → hold to speak → Gemma answers using vault data.

### Step 9 — Vault screen
Implement `VaultScreen.kt`: two tabs (Survival / Identity). Survival tab shows cached data counts + last updated. Identity tab shows masked fields with reveal-on-tap. Add "Refresh" button that triggers Scout cycle via Keeper `/event`. Add "Register with embassy" button (stub for now).

### Step 10 — Agent Inspector
Implement `AgentInspectorScreen.kt`: list of agents (Country, Shelter, Alert, Orchestrator), each showing task + action trace from `SituationStore.country_context` / `active_alerts`. Accessed by tapping the status strip. Keep it as a slide-up sheet, not a main tab.

### Step 11 — Scout WorkManager
Implement `ScoutWorker.kt` with `PeriodicWorkRequest` (12h). On trigger: POST `{type: "scout_trigger"}` to Keeper, or call Scout agents directly via Gemini SDK. Register in `Application.onCreate()`.

### Step 12 — Computer Use: embassy registration
Implement the Computer Use flow in `IdentityVault` screen: show confirmation dialog with prefilled fields, on confirm → call Gemini Computer Use API with embassy portal URL from `country_context.embassy`. Save receipt to vault.

### Step 13 — Polish + demo script
- Onboarding flow (language, location, model download, map pre-load)
- Offline banner animation when network drops
- Speech synthesis for guidance card (speak on every new instruction)
- City/border crossing detection → trigger Scout refresh
- End-to-end demo rehearsal: online → quake → Scout fills vault → airplane mode → Gemma answers

---

## 14. Dependencies (build.gradle.kts)

```kotlin
// build.gradle.kts (app module)

android {
    compileSdk = 35
    defaultConfig {
        minSdk = 26
        targetSdk = 35
    }
}

dependencies {
    // Jetpack Compose
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.navigation:navigation-compose:2.8.4")

    // Lifecycle / ViewModel
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")

    // Hilt (DI)
    implementation("com.google.dagger:hilt-android:2.52")
    kapt("com.google.dagger:hilt-compiler:2.52")
    implementation("androidx.hilt:hilt-navigation-compose:1.2.0")

    // Room + SQLCipher (encrypted database)
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    kapt("androidx.room:room-compiler:2.6.1")
    implementation("net.zetetic:android-database-sqlcipher:4.5.4")
    implementation("androidx.sqlite:sqlite-ktx:2.4.0")

    // EncryptedSharedPreferences (identity vault)
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // OkHttp (WebSocket + HTTP)
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // Gson (JSON parsing)
    implementation("com.google.code.gson:gson:2.10.1")

    // Google AI SDK (Gemini Live + Interactions API)
    implementation("com.google.ai.client.generativeai:generativeai:0.9.0")

    // LiteRT-LM (Gemma 4 on-device)
    implementation("com.google.ai.edge.litert:litert-lm:1.0.0-beta1")

    // MapLibre Android (offline map)
    implementation("org.maplibre.gl:android-sdk:11.5.1")

    // WorkManager (Scout background cycle)
    implementation("androidx.work:work-runtime-ktx:2.9.1")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    // DataStore (lightweight prefs)
    implementation("androidx.datastore:datastore-preferences:1.1.1")

    // Testing
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
}
```

```kotlin
// settings.gradle.kts — add MapLibre repo
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://api.mapbox.com/downloads/v2/releases/maven") } // MapLibre
    }
}
```

### AndroidManifest.xml permissions required
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
```

---

## 15. What NOT to build

- No chat history UI — one guidance card, not a thread
- No server-side storage of identity data — vault is local only
- No Google Maps tile caching — use MapLibre + PMTiles only
- No Gemma for online reasoning — Gemma is offline-only fallback
- No decorative agent animations — inspector is a layer, not the main UI

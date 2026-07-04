# AEGIS Android — Mega-prompt pour Claude

> Colle tout ce qui suit directement dans Claude comme premier message.
> Ne joins pas de fichiers — tout est dans ce prompt.

---

---

## BEGIN PROMPT

Tu vas construire une application Android native complète appelée **AEGIS** pour un hackathon (demo dans 3 jours). Lis tout avant d'écrire une seule ligne de code.

---

## CE QU'EST AEGIS

Un assistant de survie pour un étranger seul dans une crise à l'étranger, dans un pays dont il ne parle pas la langue. Il parle à l'IA. Un essaim d'agents collecte tout ce dont il a besoin pendant qu'il y a encore du signal. Quand le réseau tombe, l'IA continue à le guider offline sur le téléphone.

**Le moment "wow" de la démo :**
1. L'app est connectée — le vault se remplit (abris, ambassade, alertes)
2. Un tremblement de terre se déclenche — une instruction apparaît sur l'écran
3. On active le mode avion → bannière OFFLINE
4. L'utilisateur parle au micro → Gemma répond depuis les données en cache
5. La carte montre toujours les abris

C'est ça la démonstration. L'archi "le second primitif démarre parce que le premier tournait déjà".

---

## PERSONA DE DÉMO

**Maria** — touriste française à Tokyo, avec un enfant de 6 ans, pas d'escaliers.
- `session_id`: `aegis-maria-001`
- `language`: `fr` (Maria parle français)
- `constraints`: `["child_age_6", "no_stairs"]`

---

## BACKEND DÉPLOYÉ

**URL de base :** `https://aegis-keeper.devstar7014.workers.dev`

### Endpoints HTTP

```
GET  /api/state?session={id}
     → Retourne le SituationObject complet en JSON

POST /event?session={id}
     Body: {"type": "user_message", "payload": {"text": "..."}, "src": "android"}
     → Envoie un message à l'IA Keeper (Gemini)

POST /api/eyes?session={id}
     Body: {"image_b64": "...", "mime_type": "image/jpeg"}
     → Envoie une photo pour analyse

POST /api/reset?session={id}
     Body: {}
     → Reset la session
```

### WebSocket

```
wss://aegis-keeper.devstar7014.workers.dev/ws?session={id}
```
- Le serveur pousse le SituationObject complet à chaque mise à jour
- Chaque message reçu = JSON du SituationObject entier à parser et sauvegarder
- Auto-reconnect avec backoff exponentiel (5s, 10s, 20s, max 60s)

---

## SCHÉMA JSON EXACT DU KEEPER

**CRITIQUE : tous les champs sont en snake_case. Utilise Moshi avec @Json pour chaque champ.**

```json
{
  "session_id": "aegis-maria-001",
  "interaction_chain_id": "v1_abc123",
  "scout_environment_id": "007a...",
  "user": {
    "name": "Maria",
    "language": "fr",
    "constraints": ["child_age_6", "no_stairs"],
    "location": {"station": "Shinjuku", "level": "B2_platform_9"}
  },
  "event": {
    "type": "earthquake",
    "magnitude_reported": 6.2,
    "t0": "2026-07-08T14:32:00Z"
  },
  "environment": [
    {"src": "PA", "ja": "新宿駅は...", "en": "Shinjuku station elevator...", "t": "14:32:05"}
  ],
  "live_delta": {
    "exits_down": ["south_exit"],
    "official_evac_direction": "surface_via_elevator",
    "shelters": [
      {
        "name": "Shinjuku Chuo Park",
        "type": "park",
        "address": "2-11 Nishishinjuku, Tokyo",
        "dist_m": 320,
        "step_free": true,
        "capacity": "open",
        "coordinates": {"lat": 35.6938, "lng": 139.6917},
        "source": "tokyo_bousai"
      }
    ],
    "as_of": "2026-07-08T14:32:10Z"
  },
  "country_context": {
    "country": "Japan",
    "city": "Tokyo",
    "emergency_numbers": {"police": "110", "ambulance": "119", "fire": "119"},
    "embassy": {
      "nationality": "French",
      "address": "4-11-44 Minami-Azabu, Minato-ku, Tokyo",
      "phone": "+81-3-5798-6000",
      "emergency_line": "+81-80-9539-3970"
    },
    "key_phrases": [
      {"local": "助けてください", "en": "Please help me", "romanized": "Tasukete kudasai"},
      {"local": "エレベーターはどこですか", "en": "Where is the elevator?", "romanized": "Erebeetaa wa doko desu ka"}
    ],
    "protocols": ["Move to high ground if near coast", "Do not use elevators unless marked safe"]
  },
  "active_alerts": [
    {"source": "JMA", "severity": "Major", "message": "Magnitude 6.2 earthquake detected near Tokyo", "t": "14:32:00"}
  ],
  "guidance": {
    "current_instruction_en": "Find an escalator or elevator towards the surface. Do not use stairs.",
    "next_question": null,
    "needs_tap": false,
    "confirmed": false
  },
  "network": {
    "online": true,
    "last_serialized_to_device": "2026-07-08T14:32:10Z"
  }
}
```

---

## MODELS.KT — COPIE EXACTE À UTILISER

```kotlin
package com.aegis.data

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class UserLocation(
    val station: String = "",
    val level: String = ""
)

@JsonClass(generateAdapter = true)
data class UserProfile(
    val name: String = "",
    val language: String = "",
    val constraints: List<String> = emptyList(),
    val location: UserLocation? = null
)

@JsonClass(generateAdapter = true)
data class CrisisEvent(
    val type: String? = null,
    @Json(name = "magnitude_reported") val magnitudeReported: Double? = null,
    val t0: String? = null
)

@JsonClass(generateAdapter = true)
data class EnvironmentEntry(
    val src: String = "",
    val ja: String = "",
    val en: String = "",
    val t: String = ""
)

@JsonClass(generateAdapter = true)
data class Coordinates(
    val lat: Double = 0.0,
    val lng: Double = 0.0
)

@JsonClass(generateAdapter = true)
data class Shelter(
    val name: String = "",
    val type: String = "",
    val address: String = "",
    @Json(name = "dist_m") val distM: Int = 0,
    @Json(name = "step_free") val stepFree: Boolean = false,
    val capacity: String = "",
    val coordinates: Coordinates? = null,
    val source: String = ""
)

@JsonClass(generateAdapter = true)
data class LiveDelta(
    @Json(name = "exits_down") val exitsDown: List<String> = emptyList(),
    @Json(name = "official_evac_direction") val officialEvacDirection: String? = null,
    val shelters: List<Shelter> = emptyList(),
    @Json(name = "as_of") val asOf: String? = null
)

@JsonClass(generateAdapter = true)
data class KeyPhrase(
    val local: String = "",
    val en: String = "",
    val romanized: String = ""
)

@JsonClass(generateAdapter = true)
data class EmbassyInfo(
    val nationality: String = "",
    val address: String = "",
    val phone: String = "",
    @Json(name = "emergency_line") val emergencyLine: String = ""
)

@JsonClass(generateAdapter = true)
data class CountryContext(
    val country: String = "",
    val city: String = "",
    @Json(name = "emergency_numbers") val emergencyNumbers: Map<String, String> = emptyMap(),
    val embassy: EmbassyInfo? = null,
    @Json(name = "key_phrases") val keyPhrases: List<KeyPhrase> = emptyList(),
    val protocols: List<String> = emptyList()
)

@JsonClass(generateAdapter = true)
data class Alert(
    val source: String = "",
    val severity: String = "",
    val message: String = "",
    val t: String = ""
)

@JsonClass(generateAdapter = true)
data class Guidance(
    @Json(name = "current_instruction_en") val text: String? = null,
    @Json(name = "next_question") val nextQuestion: String? = null,
    @Json(name = "needs_tap") val needsTap: Boolean = false,
    val confirmed: Boolean = false
)

@JsonClass(generateAdapter = true)
data class NetworkState(
    val online: Boolean = true,
    @Json(name = "last_serialized_to_device") val lastSerializedToDevice: String? = null
)

@JsonClass(generateAdapter = true)
data class SituationObject(
    @Json(name = "session_id") val sessionId: String = "",
    @Json(name = "interaction_chain_id") val interactionChainId: String? = null,
    @Json(name = "scout_environment_id") val scoutEnvironmentId: String? = null,
    val user: UserProfile = UserProfile(),
    val event: CrisisEvent = CrisisEvent(),
    val environment: List<EnvironmentEntry> = emptyList(),
    @Json(name = "live_delta") val liveDelta: LiveDelta = LiveDelta(),
    @Json(name = "country_context") val countryContext: CountryContext? = null,
    @Json(name = "active_alerts") val activeAlerts: List<Alert> = emptyList(),
    val guidance: Guidance = Guidance(),
    val network: NetworkState = NetworkState()
)
```

---

## STACK TECHNIQUE

```kotlin
// app/build.gradle.kts

dependencies {
    // UI
    implementation(platform("androidx.compose:compose-bom:2024.09.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.navigation:navigation-compose:2.7.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.3")

    // Network
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.moshi:moshi:1.15.1")
    implementation("com.squareup.moshi:moshi-kotlin:1.15.1")
    kapt("com.squareup.moshi:moshi-kotlin-codegen:1.15.1")

    // Local DB
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    kapt("androidx.room:room-compiler:2.6.1")

    // Maps offline
    implementation("org.maplibre.gl:android-sdk:11.5.1")

    // Gemma on-device
    implementation("com.google.mediapipe:tasks-genai:0.10.14")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}
```

```kotlin
// gradle/libs.versions.toml — versions principales
compileSdk = 35
minSdk = 26
targetSdk = 35
kotlin = "1.9.24"
agp = "8.5.0"
```

---

## ARCHITECTURE

```
com.aegis/
├── data/
│   ├── Models.kt          (voir ci-dessus — copie exacte)
│   ├── Database.kt        (Room: SituationEntity, VaultEntity)
│   └── Repository.kt      (source unique de vérité, Flow<SituationObject?>)
├── network/
│   ├── KeeperApi.kt       (OkHttp HTTP calls)
│   └── KeeperWebSocket.kt (OkHttp WebSocket + auto-reconnect)
├── audio/
│   ├── SpeechRecognizer.kt (Android SpeechRecognizer API — on-device STT)
│   └── TtsEngine.kt        (Android TextToSpeech — on-device TTS)
├── ai/
│   └── GemmaEngine.kt     (MediaPipe LiteRT — Gemma 4 on-device)
├── ui/
│   ├── AegisViewModel.kt  (StateFlow, tout l'état de l'app)
│   ├── VoiceScreen.kt     (écran principal)
│   ├── MapScreen.kt       (carte offline MapLibre)
│   └── VaultScreen.kt     (données cachées)
└── MainActivity.kt
```

---

## ÉCRAN 1 — VOICE SCREEN (écran principal)

### Layout général
Fond noir (`#0A0A0A`). Trois zones verticales :

**Zone haute — Status strip**
- Ligne 1 : `SESSION: aegis-maria-001` | `ENV: {scoutEnvironmentId court}`
- Ligne 2 : badge online/offline coloré + timestamp dernière sync
- Police monospace, taille 10sp, couleur `#64748B`

**Zone milieu — Instruction principale**
Grand encadré arrondi. Contenu = `guidance.text`.
- Si `guidance.text` est null → affiche `"En attente d'instructions..."` en gris
- Si `guidance.needsTap == true` → bouton "Confirmer" visible en bas de la carte
- Couleur fond : `#0F172A`, bordure `#334155`
- Texte blanc, taille 16sp

**Zone info — Panneau situation** (3 lignes sous l'instruction)
```
🔴 SÉISME M6.2 — Tokyo, 14:32      ← event.type + magnitudeReported si non-null
⚠️  JMA: Magnitude 6.2 detected    ← premier active_alert (source + message)
🏠 3 abris accessibles • 320m      ← count step_free shelters + distM du plus proche
```
Si les données sont vides/null, ne pas afficher ces lignes (pas de placeholders).

**Zone basse — Bouton micro**
Gros bouton rond central (`96dp`), icône micro.
- Repos : fond `#1E293B`, icône blanche
- Écoute active : fond `#DC2626` pulsant (animation), icône micro blanche
- Processing : spinner
- Appui = démarre l'écoute STT
- Relâche = arrête, envoie au moteur AI

Sous le bouton : texte de transcription en cours (gris, taille 13sp)

**Bannière OFFLINE** (visible uniquement si network.online == false)
Barre rouge pleine en haut : `"● HORS LIGNE — VAULT LOCAL ACTIF"`

---

## ÉCRAN 2 — MAP SCREEN

Carte MapLibre plein écran avec tiles CartoDB Dark Matter :
```
https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png
```

Pins sur la carte pour chaque shelter de `live_delta.shelters` :
- Vert (`#00FF66`) si `stepFree == true`
- Jaune (`#84CC16`) si `stepFree == false`
- Centrer sur Tokyo si pas de coordonnées GPS utilisateur

Tap sur un pin → bottom sheet avec :
- Nom, adresse, distance (`distM`m), capacité
- Badge "♿ Accessible" si step_free

Bouton flottant bas-droite : localisation utilisateur (si permission accordée).

---

## ÉCRAN 3 — VAULT SCREEN

Liste des données collectées par les agents, en sections :

**Abris** (`live_delta.shelters`)
Cards avec : nom, distance, step_free badge, capacité

**Ambassade** (`country_context.embassy`)
Card avec : nationality, adresse, téléphone, ligne urgence

**Numéros d'urgence** (`country_context.emergency_numbers`)
Grid : Police / Ambulance / Pompiers

**Phrases clés** (`country_context.key_phrases`)
Cards : texte local + romanisé + traduction

**Alertes actives** (`active_alerts`)
Cards : source, sévérité, message, heure

**Protocoles** (`country_context.protocols`)
Liste simple

Si une section est vide → n'affiche pas la section (pas de "Aucune donnée").

---

## NAVIGATION

Bottom nav bar avec 3 onglets :
- Micro (VoiceScreen) — actif par défaut
- Carte (MapScreen)
- Vault (VaultScreen)

Pas d'onboarding, pas d'écran de login. L'app démarre directement sur VoiceScreen avec `session_id = "aegis-maria-001"` codé en dur (c'est une app de démo hackathon).

---

## MOTEUR IA — GEMMA ON-DEVICE

### Download du modèle
Le modèle **n'est pas bundlé dans l'APK** (trop lourd). Il doit être téléchargé depuis HuggingFace et placé manuellement sur le téléphone avant la démo :

```
/sdcard/Download/gemma-4-e2b-it-litert-lm.task
```

### GemmaEngine.kt

```kotlin
class GemmaEngine(context: Context) {
    private val modelPath = "/sdcard/Download/gemma-4-e2b-it-litert-lm.task"
    
    // Vérifie si le modèle est présent
    fun isModelAvailable(): Boolean = File(modelPath).exists()
    
    // Génère une réponse depuis le vault
    suspend fun respond(
        userQuestion: String,
        situation: SituationObject
    ): String {
        // Construit le contexte depuis le vault
        val vaultContext = buildVaultContext(situation)
        
        val prompt = """
            Tu es AEGIS, un assistant de crise. Tu guides ${situation.user.name} 
            qui est à ${situation.countryContext?.city ?: "Tokyo"} en cas de crise.
            Langue de réponse : ${situation.user.language}.
            Contraintes : ${situation.user.constraints.joinToString()}.
            
            DONNÉES DISPONIBLES (vault local) :
            $vaultContext
            
            Instruction actuelle : ${situation.guidance.text ?: "En attente"}
            
            Question : $userQuestion
            
            Réponds en ${situation.user.language} de façon concise et utile.
            Ne mentionne pas que tu es offline ou que tu utilises des données en cache.
        """.trimIndent()
        
        // MediaPipe LiteRT inference
        return runInference(prompt)
    }
    
    private fun buildVaultContext(situation: SituationObject): String {
        val sb = StringBuilder()
        
        situation.liveDelta.shelters.take(3).forEach { s ->
            sb.appendLine("Abri: ${s.name}, ${s.distM}m, ${if (s.stepFree) "accessible PMR" else ""}, ${s.capacity}")
        }
        
        situation.countryContext?.embassy?.let { e ->
            sb.appendLine("Ambassade ${e.nationality}: ${e.address}, urgences: ${e.emergencyLine}")
        }
        
        situation.countryContext?.emergencyNumbers?.forEach { (k, v) ->
            sb.appendLine("$k: $v")
        }
        
        situation.active_alerts.take(2).forEach { a ->
            sb.appendLine("Alerte ${a.source}: ${a.message}")
        }
        
        situation.countryContext?.keyPhrases?.take(5)?.forEach { p ->
            sb.appendLine("Phrase: '${p.local}' = '${p.en}' (${p.romanized})")
        }
        
        return sb.toString()
    }
    
    private suspend fun runInference(prompt: String): String {
        return withContext(Dispatchers.IO) {
            try {
                val options = LlmInference.LlmInferenceOptions.builder()
                    .setModelPath(modelPath)
                    .setMaxTokens(512)
                    .setTemperature(0.7f)
                    .build()
                
                LlmInference.createFromOptions(context, options).use { llm ->
                    llm.generateResponse(prompt)
                }
            } catch (e: Exception) {
                // Fallback si modèle absent
                buildFallbackResponse(prompt)
            }
        }
    }
    
    private fun buildFallbackResponse(prompt: String): String {
        // Ne devrait pas arriver si isModelAvailable() est vérifié avant
        return "Données locales disponibles. Consultez l'onglet Vault pour les informations d'urgence."
    }
}
```

### Fallback si modèle absent
Si `isModelAvailable() == false`, le bouton micro reste actif mais répond avec les données structurées du vault directement (sans LLM). Affiche un badge discret "Mode Vault" au lieu de "Gemma".

---

## MOTEUR VOCAL (STT + TTS)

### SpeechRecognizer.kt
Utilise `android.speech.SpeechRecognizer` (on-device, pas de cloud).

```kotlin
class AegisSpeechRecognizer(private val context: Context) {
    fun startListening(onResult: (String) -> Unit, onError: () -> Unit) {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "fr-FR") // langue de Maria
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        }
        // Démarre la reconnaissance, callback sur onResult avec le texte
    }
}
```

### TtsEngine.kt
Utilise `android.speech.tts.TextToSpeech` avec locale `fr_FR`.

```kotlin
class AegisTtsEngine(context: Context) {
    fun speak(text: String) // TextToSpeech.QUEUE_FLUSH
    fun stop()
    fun shutdown()
}
```

---

## VIEWMODEL — FLUX DE DONNÉES

```kotlin
class AegisViewModel(app: Application) : AndroidViewModel(app) {
    
    // État observé par les écrans
    val situation: StateFlow<SituationObject?>   // source unique de vérité
    val isConnected: StateFlow<Boolean>           // WebSocket connecté
    val isListening: StateFlow<Boolean>           // micro actif
    val isProcessing: StateFlow<Boolean>          // Gemma en cours
    val transcript: StateFlow<String>             // texte reconnu en cours
    val lastAiResponse: StateFlow<String>         // dernière réponse Gemma/Keeper
    
    // session ID fixe pour la démo
    val sessionId = "aegis-maria-001"
    
    // isOffline = !situation.network.online
    val isOffline: StateFlow<Boolean>
    
    fun onMicPress()    // démarre STT
    fun onMicRelease()  // arrête STT, envoie au moteur IA
    fun onConfirmTap()  // confirme l'instruction courante
    
    // Logique IA :
    // - Si online → POST /event avec le texte
    //   puis GET /api/state pour récupérer la réponse dans guidance.text
    // - Si offline → GemmaEngine.respond(text, situation)
    //   puis mettre à jour guidance.text localement
}
```

---

## ROOM DATABASE

Deux tables simples :

```kotlin
@Entity(tableName = "situation")
data class SituationEntity(
    @PrimaryKey val id: Int = 1, // une seule ligne, toujours remplacée
    val jsonString: String,
    val savedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "vault")
data class VaultEntity(
    @PrimaryKey val key: String,
    val value: String,
    val savedAt: Long = System.currentTimeMillis()
)
```

Le Repository expose un `Flow<SituationObject?>` depuis Room. Chaque message WebSocket ou réponse HTTP sauvegarde dans Room. Gemma lit depuis ce Flow. Pas de state en mémoire séparé — Room est la source de vérité, même offline.

---

## ANDROIDMANIFEST.XML — PERMISSIONS REQUISES

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
    android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

Demande les permissions RECORD_AUDIO et ACCESS_FINE_LOCATION au runtime au premier lancement.

---

## DESIGN SYSTEM

```kotlin
object AegisTheme {
    val Background = Color(0xFF0A0A0A)
    val Surface    = Color(0xFF0F172A)
    val Border     = Color(0xFF1E293B)
    val TextPrimary   = Color(0xFFFFFFFF)
    val TextSecondary = Color(0xFF94A3B8)
    val TextMuted     = Color(0xFF475569)
    val Online  = Color(0xFF10B981)  // vert
    val Offline = Color(0xFFEF4444)  // rouge
    val Warning = Color(0xFFF59E0B)  // ambre
    val StepFree = Color(0xFF00FF66) // vert vif pour les abris accessibles
    val Font = FontFamily.Monospace  // pour les IDs et données techniques
}
```

Utilise Material3 avec ces couleurs overridées. Fond noir sur tout. Pas de blanc brillant sur les surfaces.

---

## COMPORTEMENT ONLINE ↔ OFFLINE

La bascule est automatique basée sur `situation.network.online`.

**Quand online :**
- WebSocket connecté, vault se met à jour en temps réel
- Micro → STT → texte → POST `/event` → GET `/api/state` → affiche `guidance.text`
- Pas de Gemma

**Quand offline** (network.online == false OU WebSocket fail) :
- Bannière rouge "HORS LIGNE — VAULT LOCAL ACTIF"
- Micro → STT → texte → GemmaEngine (si modèle présent) → réponse locale
- Vault continue d'afficher les dernières données Room
- Carte continue d'afficher les pins (depuis Room)

**La bascule se fait dans le ViewModel** — les écrans ne savent pas s'ils sont online ou offline, ils observent juste les StateFlows.

---

## CE QU'IL NE FAUT PAS FAIRE

- **Pas de Hilt** — DI manuelle avec `remember { }` ou `viewModel()`, c'est suffisant pour une démo
- **Pas de Retrofit** — OkHttp directement, on évite une dépendance de plus
- **Pas de Gemini Live API** — trop complexe pour 3 jours, Gemma on-device suffit
- **Pas de mock data hardcodé dans les écrans** — tout vient du ViewModel qui lit Room
- **Pas de navigation complexe** — bottom nav simple avec 3 onglets
- **Pas d'onboarding** — session hardcodée `aegis-maria-001` pour la démo
- **Pas de tests** — hackathon, pas besoin
- **Pas de commentaires évidents** — commente seulement le "pourquoi", pas le "quoi"

---

## ORDRE DE BUILD RECOMMANDÉ

1. `Models.kt` (copie exacte ci-dessus)
2. `Database.kt` + `Repository.kt` (Room + Flow)
3. `KeeperApi.kt` + `KeeperWebSocket.kt` (connexion backend)
4. `AegisViewModel.kt` (colle tout ensemble)
5. `VoiceScreen.kt` (le plus important visuellement)
6. `VaultScreen.kt` (lecture simple des données)
7. `MapScreen.kt` (MapLibre + pins depuis vault)
8. `AegisSpeechRecognizer.kt` + `TtsEngine.kt`
9. `GemmaEngine.kt` (en dernier — peut être mocké d'abord)
10. `MainActivity.kt` + navigation

---

## VÉRIFICATION FINALE AVANT DE LIVRER LE CODE

Avant de me donner le code, vérifie ces points :

- [ ] `Models.kt` est identique à celui fourni ci-dessus (même package, mêmes annotations @Json)
- [ ] `KeeperWebSocket` se connecte à `wss://aegis-keeper.devstar7014.workers.dev/ws?session=aegis-maria-001`
- [ ] `KeeperApi.getState()` appelle `GET /api/state?session=aegis-maria-001`
- [ ] Aucun champ `homeCountry`, `homeCity`, `passport`, `emergencyContact`, `bloodType` dans UserProfile
- [ ] Aucun champ `title`, `description`, `location`, `severity` dans CrisisEvent
- [ ] `Shelter.stepFree` vient de `@Json(name="step_free")`
- [ ] `Shelter.distM` vient de `@Json(name="dist_m")`
- [ ] `Guidance.text` vient de `@Json(name="current_instruction_en")`
- [ ] La carte utilise MapLibre (pas Google Maps — droits offline)
- [ ] GemmaEngine lit depuis `/sdcard/Download/gemma-4-e2b-it-litert-lm.task`
- [ ] Le ViewModel expose `isOffline` basé sur `situation.network.online`
- [ ] La bannière OFFLINE est visible uniquement quand `isOffline == true`

---

## END PROMPT

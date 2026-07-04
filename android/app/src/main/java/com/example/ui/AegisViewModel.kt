package com.example.ui

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.AegisRepository
import com.example.data.SituationObject
import com.example.data.UserProfile
import com.example.network.KeeperApi
import com.example.network.KeeperWebSocketManager
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.util.UUID

class AegisViewModel(application: Application) : AndroidViewModel(application) {
    private val context = application.applicationContext
    private val repository = AegisRepository(context)
    private val prefs = context.getSharedPreferences("aegis_prefs", Context.MODE_PRIVATE)

    private val _sessionId = MutableStateFlow("")
    val sessionId: StateFlow<String> = _sessionId.asStateFlow()

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    private val _isOnboarded = MutableStateFlow(false)
    val isOnboarded: StateFlow<Boolean> = _isOnboarded.asStateFlow()

    private val _isGemmaDownloaded = MutableStateFlow(false)
    val isGemmaDownloaded: StateFlow<Boolean> = _isGemmaDownloaded.asStateFlow()

    private val _gemmaDownloadProgress = MutableStateFlow(0f)
    val gemmaDownloadProgress: StateFlow<Float> = _gemmaDownloadProgress.asStateFlow()

    private val _isMapDownloaded = MutableStateFlow(false)
    val isMapDownloaded: StateFlow<Boolean> = _isMapDownloaded.asStateFlow()

    private val _mapDownloadProgress = MutableStateFlow(0f)
    val mapDownloadProgress: StateFlow<Float> = _mapDownloadProgress.asStateFlow()

    private val _identityFields = MutableStateFlow<Map<String, String>>(emptyMap())
    val identityFields: StateFlow<Map<String, String>> = _identityFields.asStateFlow()

    private val _isOfflineMode = MutableStateFlow(false)
    val isOfflineMode: StateFlow<Boolean> = _isOfflineMode.asStateFlow()

    private val _activeRoute = MutableStateFlow("onboarding")
    val activeRoute: StateFlow<String> = _activeRoute.asStateFlow()

    // Single source of truth situation flow from local DB
    private val _situation = MutableStateFlow<SituationObject?>(null)
    val situation: StateFlow<SituationObject?> = _situation.asStateFlow()

    private var wsManager: KeeperWebSocketManager? = null
    private val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()

    init {
        // Initialize session
        var session = prefs.getString("session_id", "") ?: ""
        if (session.isEmpty()) {
            session = UUID.randomUUID().toString()
            prefs.edit().putString("session_id", session).apply()
        }
        _sessionId.value = session

        _isOnboarded.value = prefs.getBoolean("is_onboarded", false)
        _isGemmaDownloaded.value = prefs.getBoolean("gemma_downloaded", false)
        _isMapDownloaded.value = prefs.getBoolean("map_downloaded", false)

        if (_isOnboarded.value) {
            _activeRoute.value = "voice"
            connectWebSocket()
        }

        // Collect situation from Repository
        viewModelScope.launch {
            repository.situationFlow.collectLatest { situationObj ->
                _situation.value = situationObj
            }
        }

        // Collect identity fields
        viewModelScope.launch {
            repository.getIdentityFlow().collectLatest { fields ->
                _identityFields.value = fields
            }
        }
    }

    fun connectWebSocket() {
        if (_isOfflineMode.value) return
        viewModelScope.launch(Dispatchers.IO) {
            wsManager?.disconnect()
            wsManager = KeeperWebSocketManager(repository, _sessionId.value) { connected ->
                _isConnected.value = connected
            }
            wsManager?.connect()

            // Fetch initial state via HTTP in case WS is pending
            val state = KeeperApi.getState(_sessionId.value)
            if (state != null) {
                repository.saveSituation(state)
            }
        }
    }

    fun toggleOfflineMode() {
        _isOfflineMode.value = !_isOfflineMode.value
        if (_isOfflineMode.value) {
            wsManager?.disconnect()
            _isConnected.value = false
            // Update situation locally to reflect offline state
            viewModelScope.launch {
                val current = _situation.value
                if (current != null) {
                    val updated = current.copy(network = current.network.copy(online = false))
                    repository.saveSituation(updated)
                }
            }
        } else {
            connectWebSocket()
        }
    }

    fun completeOnboarding(
        name: String,
        language: String,
        country: String,
        city: String,
        passport: String,
        contact: String,
        bloodType: String,
        constraints: List<String>
    ) {
        viewModelScope.launch {
            // Save identity fields encrypted in DB
            repository.saveIdentityField("name", name)
            repository.saveIdentityField("passport", passport)
            repository.saveIdentityField("emergency_contact", contact)
            repository.saveIdentityField("blood_type", bloodType)

            // Save user profile state (identity fields stored encrypted in DB above)
            val profile = UserProfile(
                name = name,
                language = language,
                constraints = constraints
            )

            val currentSit = _situation.value ?: SituationObject(sessionId = _sessionId.value)
            val updatedSit = currentSit.copy(user = profile)
            repository.saveSituation(updatedSit)

            prefs.edit().putBoolean("is_onboarded", true).apply()
            _isOnboarded.value = true
            _activeRoute.value = "voice"

            // Connect to websocket
            connectWebSocket()

            // Notify Keeper
            val profileAdapter = moshi.adapter(UserProfile::class.java)
            val profileJson = profileAdapter.toJson(profile)
            KeeperApi.postEvent(_sessionId.value, "onboarding_complete", profileJson)
        }
    }

    fun downloadGemma() {
        viewModelScope.launch {
            _gemmaDownloadProgress.value = 0f
            for (i in 1..100) {
                delay(40) // Simulate fast download progress
                _gemmaDownloadProgress.value = i / 100f
            }
            prefs.edit().putBoolean("gemma_downloaded", true).apply()
            _isGemmaDownloaded.value = true
        }
    }

    fun downloadMap() {
        viewModelScope.launch {
            _mapDownloadProgress.value = 0f
            for (i in 1..100) {
                delay(30) // Simulate fast map PMTiles download progress
                _mapDownloadProgress.value = i / 100f
            }
            prefs.edit().putBoolean("map_downloaded", true).apply()
            _isMapDownloaded.value = true
        }
    }

    fun navigateTo(route: String) {
        _activeRoute.value = route
    }

    fun triggerScout() {
        viewModelScope.launch {
            // Triggers a scout refresh cycle
            if (_isConnected.value) {
                wsManager?.sendEvent("scout_trigger", "{}")
            } else {
                KeeperApi.postEvent(_sessionId.value, "scout_trigger", "{}")
            }
        }
    }

    fun sendConfirmTap() {
        viewModelScope.launch {
            if (_isConnected.value) {
                wsManager?.sendEvent("confirm_guidance", "{}")
            } else {
                KeeperApi.postEvent(_sessionId.value, "confirm_guidance", "{}")
            }
        }
    }

    fun resetSession() {
        viewModelScope.launch {
            KeeperApi.resetSession(_sessionId.value)
            // Retrieve fresh state
            val state = KeeperApi.getState(_sessionId.value)
            if (state != null) {
                repository.saveSituation(state)
            }
        }
    }

    fun sendVoiceText(text: String) {
        viewModelScope.launch {
            val escapedText = text.replace("\"", "\\\"")
            if (_isOfflineMode.value) {
                // Offline Gemma local response simulation
                simulateOfflineGemmaResponse(text)
            } else {
                if (_isConnected.value) {
                    wsManager?.sendEvent("user_message", """{"text":"$escapedText"}""")
                } else {
                    KeeperApi.postEvent(_sessionId.value, "user_message", """{"text":"$escapedText"}""")
                    val state = KeeperApi.getState(_sessionId.value)
                    if (state != null) {
                        repository.saveSituation(state)
                    }
                }
            }
        }
    }

    private fun simulateOfflineGemmaResponse(question: String) {
        viewModelScope.launch {
            val current = _situation.value ?: return@launch
            // Simulate Gemma thinking and responding based on cached vault
            delay(1500)
            val responseText = when {
                question.contains("shelter", ignoreCase = true) -> {
                    val stepFreeShelters = current.liveDelta.shelters.filter { it.stepFree }
                    if (stepFreeShelters.isNotEmpty()) {
                        "OFFLINE GUIDE (Gemma 4): Based on local cached data, there are ${stepFreeShelters.size} step-free shelters. The nearest is ${stepFreeShelters.first().name} at ${stepFreeShelters.first().distM}m. Head towards surface elevator."
                    } else {
                        "OFFLINE GUIDE (Gemma 4): Cached data indicates shelters nearby but step-free info is unknown. Standard shelter is available at 1.2km."
                    }
                }
                question.contains("embassy", ignoreCase = true) -> {
                    val embassy = current.countryContext?.embassy
                    if (embassy != null) {
                        "OFFLINE GUIDE (Gemma 4): French Embassy is located at ${embassy.address}. Emergency contact: ${embassy.phone}. Follow standard protocols."
                    } else {
                        "OFFLINE GUIDE (Gemma 4): Local context shows French Embassy Emergency Hotline: +81-80-9539-3970."
                    }
                }
                else -> {
                    "OFFLINE GUIDE (Gemma 4): Network is currently offline. Your current instructions: '${current.guidance.text}'. Keep moving towards safety."
                }
            }

            val updatedGuidance = current.guidance.copy(
                text = responseText,
                timestamp = System.currentTimeMillis()
            )
            repository.saveSituation(current.copy(guidance = updatedGuidance))
        }
    }

    fun submitSignReading(base64Image: String, mimeType: String) {
        viewModelScope.launch {
            KeeperApi.postEyes(_sessionId.value, base64Image, mimeType)
            // Fetch updated state
            val state = KeeperApi.getState(_sessionId.value)
            if (state != null) {
                repository.saveSituation(state)
            }
        }
    }
}

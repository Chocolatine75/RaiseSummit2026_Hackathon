package com.example.data

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
    val confirmed: Boolean = false,
    val timestamp: Long = System.currentTimeMillis()
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

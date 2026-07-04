package com.example.network

import android.util.Log
import com.example.data.SituationObject
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

object KeeperApi {
    private const val BASE_URL = "https://aegis-keeper.devstar7014.workers.dev"
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
    private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

    suspend fun postEvent(sessionId: String, type: String, payloadJson: String): Boolean {
        return try {
            val json = """{"type": "$type", "payload": $payloadJson, "src": "android"}"""
            val body = json.toRequestBody(JSON_MEDIA_TYPE)
            val request = Request.Builder()
                .url("$BASE_URL/event?session=$sessionId")
                .post(body)
                .build()

            client.newCall(request).execute().use { response ->
                response.isSuccessful
            }
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun getState(sessionId: String): SituationObject? {
        return try {
            val request = Request.Builder()
                .url("$BASE_URL/api/state?session=$sessionId")
                .get()
                .build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val bodyString = response.body?.string() ?: return null
                    moshi.adapter(SituationObject::class.java).fromJson(bodyString)
                } else {
                    null
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun postEyes(sessionId: String, imageBase64: String, mimeType: String): Boolean {
        return try {
            val json = """{"image_b64": "$imageBase64", "mime_type": "$mimeType"}"""
            val body = json.toRequestBody(JSON_MEDIA_TYPE)
            val request = Request.Builder()
                .url("$BASE_URL/api/eyes?session=$sessionId")
                .post(body)
                .build()

            client.newCall(request).execute().use { response ->
                response.isSuccessful
            }
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun resetSession(sessionId: String): Boolean {
        return try {
            val body = "{}".toRequestBody(JSON_MEDIA_TYPE)
            val request = Request.Builder()
                .url("$BASE_URL/api/reset?session=$sessionId")
                .post(body)
                .build()

            client.newCall(request).execute().use { response ->
                response.isSuccessful
            }
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
}

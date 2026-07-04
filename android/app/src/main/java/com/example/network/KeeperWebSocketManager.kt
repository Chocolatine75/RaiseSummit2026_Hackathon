package com.example.network

import android.util.Log
import com.example.data.AegisRepository
import com.example.data.SituationObject
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.*
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class KeeperWebSocketManager(
    private val repository: AegisRepository,
    private val sessionId: String,
    private val onConnectionStatusChanged: (Boolean) -> Unit
) {
    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
    private val situationAdapter = moshi.adapter(SituationObject::class.java)
    private val scope = CoroutineScope(Dispatchers.IO)

    fun connect() {
        disconnect()
        val request = Request.Builder()
            .url("wss://aegis-keeper.devstar7014.workers.dev/ws?session=$sessionId")
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d("KeeperWS", "WebSocket Connected")
                onConnectionStatusChanged(true)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.d("KeeperWS", "Received text: $text")
                scope.launch {
                    try {
                        val situation = situationAdapter.fromJson(text)
                        if (situation != null) {
                            repository.saveSituation(situation)
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(1000, null)
                Log.d("KeeperWS", "WebSocket Closing: $code / $reason")
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.d("KeeperWS", "WebSocket Closed: $code / $reason")
                onConnectionStatusChanged(false)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e("KeeperWS", "WebSocket Failure: ${t.message}", t)
                onConnectionStatusChanged(false)
                scope.launch {
                    kotlinx.coroutines.delay(5000)
                    connect()
                }
            }
        })
    }

    fun disconnect() {
        try {
            webSocket?.close(1000, "App closed")
        } catch (e: Exception) {
            e.printStackTrace()
        }
        webSocket = null
    }

    fun sendEvent(eventType: String, payloadJson: String) {
        val jsonPayload = """{"type":"$eventType","payload":$payloadJson,"src":"android"}"""
        webSocket?.send(jsonPayload)
    }
}

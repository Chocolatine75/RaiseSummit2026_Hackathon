package com.example.audio

import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.speech.tts.TextToSpeech
import android.util.Log
import java.util.Locale

class AudioManager(private val context: Context) : TextToSpeech.OnInitListener {

    private var tts: TextToSpeech? = null
    private var isTtsInitialized = false

    // Real AudioRecord parameters (referenced in tech stack Section 5)
    private val sampleRate = 16000
    private val channelConfig = AudioFormat.CHANNEL_IN_MONO
    private val audioFormat = AudioFormat.ENCODING_PCM_16BIT
    private val bufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)

    private var audioRecord: AudioRecord? = null
    private var isRecording = false

    init {
        try {
            tts = TextToSpeech(context, this)
        } catch (e: Exception) {
            Log.e("AegisAudio", "Failed to initialize TTS", e)
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            tts?.let {
                val result = it.setLanguage(Locale.US)
                if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                    Log.e("AegisAudio", "Language not supported for TTS")
                } else {
                    isTtsInitialized = true
                }
            }
        } else {
            Log.e("AegisAudio", "TTS Initialization failed")
        }
    }

    fun speak(text: String) {
        if (isTtsInitialized) {
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "aegis_guidance")
        } else {
            Log.d("AegisAudio", "TTS not ready. Simulation output: $text")
        }
    }

    // Standard AudioRecord initialization (Section 5)
    fun startCapture(onChunkCaptured: (ByteArray) -> Unit) {
        try {
            // Check for RECORD_AUDIO permission before initializing
            if (context.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                audioRecord = AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    sampleRate,
                    channelConfig,
                    audioFormat,
                    bufferSize
                )

                audioRecord?.startRecording()
                isRecording = true

                Thread {
                    val buffer = ByteArray(bufferSize)
                    while (isRecording) {
                        val read = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                        if (read > 0) {
                            val captured = buffer.copyOf(read)
                            onChunkCaptured(captured)
                        }
                    }
                }.start()
                Log.d("AegisAudio", "Audio capture started successfully")
            } else {
                Log.w("AegisAudio", "Missing RECORD_AUDIO permission")
            }
        } catch (e: SecurityException) {
            Log.e("AegisAudio", "SecurityException starting AudioRecord", e)
        } catch (e: Exception) {
            Log.e("AegisAudio", "Exception starting AudioRecord", e)
        }
    }

    fun stopCapture() {
        isRecording = false
        try {
            audioRecord?.stop()
            audioRecord?.release()
        } catch (e: Exception) {
            e.printStackTrace()
        }
        audioRecord = null
    }

    // Playback PCM chunks
    fun playAudioStream(pcmData: ByteArray) {
        try {
            val minBuf = AudioTrack.getMinBufferSize(
                sampleRate,
                AudioFormat.CHANNEL_OUT_MONO,
                audioFormat
            )
            val track = AudioTrack.Builder()
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setEncoding(audioFormat)
                        .setSampleRate(sampleRate)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build()
                )
                .setBufferSizeInBytes(minBuf.coerceAtLeast(pcmData.size))
                .build()

            track.play()
            track.write(pcmData, 0, pcmData.size)
            track.stop()
            track.release()
        } catch (e: Exception) {
            Log.e("AegisAudio", "Failed to play raw PCM chunk", e)
        }
    }

    fun shutdown() {
        try {
            tts?.stop()
            tts?.shutdown()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}

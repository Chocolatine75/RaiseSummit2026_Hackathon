/**
 * AEGIS Listener — streams a Japanese PA clip through Gemini Live Translate
 * and emits pa_translation events to the Keeper.
 *
 * Verified against ai.google.dev/gemini-api/docs/live-api/live-translate:
 *   model gemini-3.5-live-translate-preview · input raw 16-bit PCM 16kHz mono
 *   little-endian, sent in ~100ms chunks · transcripts arrive as
 *   inputTranscription (ja) and outputTranscription (en).
 *
 * Prepare a clip (from any mp3/wav that AI Studio TTS produced):
 *   ffmpeg -i pa2.mp3 -f s16le -acodec pcm_s16le -ar 16000 -ac 1 pa2.pcm
 *
 * Run:
 *   GEMINI_API_KEY=... KEEPER_URL=https://aegis-keeper.<you>.workers.dev \
 *   node listener.mjs ../../assets/pa2.pcm
 */
import { readFileSync } from "node:fs";
import { GoogleGenAI, Modality } from "@google/genai";

const KEEPER = process.env.KEEPER_URL || "http://localhost:8787";
const SESSION = process.env.SESSION || "demo";
const pcmPath = process.argv[2];
if (!pcmPath) { console.error("usage: node listener.mjs <clip.pcm>"); process.exit(1); }

const CHUNK = 3200; // 100ms of 16kHz 16-bit mono = 16000 * 2 bytes / 10
const pcm = readFileSync(pcmPath);

let jaBuf = "", enBuf = "";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const session = await ai.live.connect({
  model: "gemini-3.5-live-translate-preview",
  config: {
    responseModalities: [Modality.AUDIO],
    inputAudioTranscription: {},   // gives us the Japanese source text
    outputAudioTranscription: {},  // gives us the English translation text
    translationConfig: { targetLanguageCode: "en", echoTargetLanguage: false },
  },
  callbacks: {
    onmessage: (message) => {
      const c = message.serverContent;
      if (c?.inputTranscription?.text) jaBuf += c.inputTranscription.text;
      if (c?.outputTranscription?.text) enBuf += c.outputTranscription.text;
      // A turn boundary = one complete PA utterance → emit it as one event.
      if (c?.turnComplete && enBuf.trim()) {
        emit({ ja: jaBuf.trim(), en: enBuf.trim() });
        jaBuf = ""; enBuf = "";
      }
    },
    onerror: (e) => console.error("live session error:", e),
    onclose: () => console.log("live session closed"),
  },
});

console.log(`streaming ${pcmPath} (${pcm.length} bytes) → Live Translate…`);
for (let i = 0; i < pcm.length; i += CHUNK) {
  session.sendRealtimeInput({
    audio: {
      data: pcm.subarray(i, i + CHUNK).toString("base64"),
      mimeType: "audio/pcm;rate=16000",
    },
  });
  await new Promise((r) => setTimeout(r, 100)); // real-time pacing
}
// Give the model a moment to finish the final turn, then flush whatever we have.
await new Promise((r) => setTimeout(r, 4000));
if (enBuf.trim()) emit({ ja: jaBuf.trim(), en: enBuf.trim() });
session.close();

async function emit(payload) {
  console.log("→ pa_translation:", payload.en);
  await fetch(`${KEEPER}/event?session=${SESSION}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "pa_translation", payload, src: "listener" }),
  }).catch((e) => console.error("emit failed:", e.message));
}

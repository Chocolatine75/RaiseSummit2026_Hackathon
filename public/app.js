/**
 * AEGIS client — the judges' window and the offline brain.
 *
 * Online:  WebSocket to the Keeper → every push is the FULL Situation Object →
 *          render it AND write it to localStorage first (THE line the demo trusts).
 * Offline: WS closes / airplane mode → read the cached object → load Gemma
 *          (MediaPipe LLM Inference, cached by the service worker) → keep
 *          answering Maria via speechSynthesis. No internet anywhere in that path.
 */

const SESSION = new URLSearchParams(location.search).get("session") || "demo";
const CACHE_KEY = `aegis_state_${SESSION}`;
const MODEL_PATH = "/models/gemma-4-E2B-it-web.task"; // put the downloaded file here

let ws = null;
let state = null;
let offline = false;
let llm = null; // MediaPipe LlmInference instance, created lazily on first offline need
let spokenInstruction = ""; // avoid re-speaking the same line on every render

// ---------- boot ----------
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
state = readCache();
if (state) render(); // instant paint from cache — also the restart-persistence beat
connect();

// ---------- online: WebSocket to the Keeper ----------
function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws?session=${SESSION}`);
  ws.onmessage = (msg) => {
    state = JSON.parse(msg.data);
    writeCache(state); // <— the handoff IS this line
    setOffline(false);
    render();
  };
  ws.onclose = () => { setOffline(true); setTimeout(connect, 3000); };
  ws.onerror = () => ws.close();
}

window.addEventListener("offline", () => setOffline(true));
window.addEventListener("online", () => { if (!ws || ws.readyState > 1) connect(); });

function setOffline(v) {
  if (offline === v) return;
  offline = v;
  document.body.classList.toggle("offline", v);
  const pill = document.getElementById("net");
  pill.textContent = v ? "OFFLINE — on-device" : "ONLINE";
  pill.className = `pill ${v ? "offline" : "online"}`;
  if (v && state) {
    speak("We're offline now. I still have your situation. Ask me anything.");
    ensureLlm(); // start loading Gemma immediately, not at first question
  }
}

// ---------- cache (localStorage: small object, synchronous read at boot) ----------
function writeCache(s) {
  s.network = { ...s.network, last_serialized_to_device: new Date().toISOString() };
  localStorage.setItem(CACHE_KEY, JSON.stringify(s));
}
function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
}

// ---------- render the Situation Object ----------
function render() {
  if (!state) return;
  document.getElementById("chainId").textContent = shorten(state.interaction_chain_id);
  document.getElementById("envId").textContent = shorten(state.scout_environment_id);

  const g = state.guidance || {};
  if (g.current_instruction_en) {
    document.getElementById("instruction").textContent = g.current_instruction_en;
    if (!offline && g.current_instruction_en !== spokenInstruction) {
      spokenInstruction = g.current_instruction_en;
      speak(g.current_instruction_en);
    }
  }
  document.getElementById("question").textContent = g.next_question || "";
  document.getElementById("freshness").textContent = state.live_delta?.as_of
    ? `live data as of ${age(state.live_delta.as_of)} ago` : "";
  document.getElementById("confirmBtn").hidden = !g.needs_tap;

  const feed = document.getElementById("feed");
  feed.innerHTML = "";
  for (const e of [...(state.environment || [])].reverse().slice(0, 12)) {
    const div = document.createElement("div");
    div.className = "evt";
    div.innerHTML = `<span class="src">${e.src}</span> ${esc(e.en || "")}` +
      (e.ja ? `<div class="ja">${esc(e.ja)}</div>` : "");
    feed.appendChild(div);
  }
}

// ---------- emit events to the Keeper (never write state directly — the ONE law) ----------
function emit(type, payload = {}) {
  const event = { type, payload, src: "client", t: new Date().toISOString() };
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(event));
  else fetch(`/event?session=${SESSION}`, { method: "POST", body: JSON.stringify(event) }).catch(() => {});
}

document.getElementById("confirmBtn").onclick = () => emit("user_tap");

// Eyes: photo → Keeper /api/eyes → Gemini vision → sign_read event comes back via WS
document.getElementById("camInput").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const image_b64 = await fileToB64(file);
  await fetch(`/api/eyes?session=${SESSION}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_b64, mime_type: file.type || "image/jpeg" }),
  });
  e.target.value = "";
};

// Ask: online → user_utterance event (Keeper reasons); offline → Gemma on-device
document.getElementById("askBtn").onclick = ask;
document.getElementById("askInput").onkeydown = (e) => { if (e.key === "Enter") ask(); };
async function ask() {
  const input = document.getElementById("askInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  if (!offline) return emit("user_utterance", { text });
  await askGemma(text);
}

// Demo controls (hidden behind the "demo" disclosure)
document.querySelectorAll("#demoControls button").forEach((b) => {
  b.onclick = () => {
    const a = b.dataset.demo;
    if (a === "quake") emit("quake", { magnitude: "5+" });
    if (a === "reset") fetch(`/api/reset?session=${SESSION}`, { method: "POST" });
    if (a === "offline") { try { ws.close(); } catch {} setOffline(true); } // stage backup if airplane mode misbehaves
  };
});

// ---------- offline brain: Gemma via MediaPipe LLM Inference ----------
// Verified: developers.google.com/edge/mediapipe/solutions/genai/llm_inference/web_js
// The CDN genai_bundle.cjs exposes FilesetResolver + LlmInference globally.
async function ensureLlm() {
  if (llm) return llm;
  setInstruction("Loading on-device model…");
  const genai = await FilesetResolver.forGenAiTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm" // served from SW cache when offline
  );
  llm = await LlmInference.createFromOptions(genai, {
    baseOptions: { modelAssetPath: MODEL_PATH },
    maxTokens: 512,
    temperature: 0.4, // guidance, not creativity
    topK: 40,
  });
  setInstruction("On-device model ready. Ask me anything.");
  return llm;
}

// The pack prompt — the only novel prompt of the project (runbook §6-D).
function packPrompt(question) {
  return `You are AEGIS running offline on a phone during an earthquake in Tokyo. The internet is gone. Below is the last known situation, saved before the connection was lost.
Rules: (1) Reason ONLY from this data — never invent exits, shelters, or directions not present in it. (2) Give ONE instruction at a time, short enough to follow while walking. (3) Always respect the user's constraints (child, no stairs). (4) State how old the data is, using as_of and last_serialized_to_device. (5) End with one short clarifying question. (6) If the data cannot answer, say so plainly and give the safest general guidance.

SITUATION:
${JSON.stringify(state)}

USER ASKS: ${question}

YOUR SPOKEN REPLY:`;
}

async function askGemma(question) {
  const model = await ensureLlm();
  setInstruction("…");
  let full = "";
  await new Promise((resolve) =>
    model.generateResponse(packPrompt(question), (part, done) => {
      full += part;
      setInstruction(full);
      if (done) resolve();
    })
  );
  speak(full);
}

// ---------- small helpers ----------
function speak(text) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US"; // offline voice must be pre-downloaded on the phone (H0 checklist)
    speechSynthesis.speak(u);
  } catch { /* silent phones still show the big card */ }
}
function setInstruction(t) { document.getElementById("instruction").textContent = t; }
function shorten(id) { return id ? `${String(id).slice(0, 14)}…` : "—"; }
function age(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
  return s < 90 ? `${Math.round(s)}s` : `${Math.round(s / 60)}min`;
}
function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
function fileToB64(file) {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1]); // strip data: prefix
    r.readAsDataURL(file);
  });
}

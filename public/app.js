/**
 * AEGIS client — mobile app: map + live camera + one instruction.
 *
 * Model tiering (the answer to "which brain when"):
 *   ONLINE  → Keeper reasons with Gemini 3.5 Flash via the Interactions API (cloud).
 *   OFFLINE → Gemma 4 E2B on this phone via MediaPipe, over the cached state.
 * The engine strip always shows which one is driving.
 *
 * Map: Leaflet + OSM tiles. When the Scout's first live_delta arrives, the
 * client downloads a MAP PACK (a tile grid around the station) into the
 * service-worker cache — so the map still pans and shows shelters offline.
 */

const SESSION = new URLSearchParams(location.search).get("session") || "demo";
const CACHE_KEY = `aegis_state_${SESSION}`;
const MODEL_PATH = "/models/gemma-4-E2B-it-web.task";
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const FALLBACK_LL = { lat: 35.6896, lng: 139.7006 }; // pre-state map center only

// Maria's location comes from the Situation Object — never a constant.
function station() {
  const loc = state?.user?.location;
  return {
    lat: loc?.lat ?? FALLBACK_LL.lat,
    lng: loc?.lng ?? FALLBACK_LL.lng,
    name: loc?.station ?? "—",
  };
}

let ws = null, state = null, offline = false, llm = null;
let map = null, shelterLayer = null, routeLine = null, userMarker = null;
let camStreamHandle = null;
let spokenInstruction = "";
let packDone = false;
const localLog = []; // client-side system lines (map pack, scans) shown in the drawer
const speech = window.speechSynthesis || null;

// ---------- boot ----------
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
state = readCache();
initMap();
render();
connect();

// ---------- online: WebSocket to the Keeper ----------
function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws?session=${SESSION}`);
  ws.onmessage = (msg) => {
    const wasEmptyDelta = !state?.live_delta?.as_of;
    state = JSON.parse(msg.data);
    writeCache(state); // the handoff IS this line
    setOffline(false);
    // "New data enters → the map pack downloads" — fires once, on first delta.
    if (wasEmptyDelta && state.live_delta?.as_of && !packDone) downloadMapPack();
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
  const mode = document.getElementById("mode");
  mode.className = `mode ${v ? "offline" : "online"}`;
  document.getElementById("modeLabel").textContent = v ? "OFFLINE" : "ONLINE";
  document.getElementById("engine").textContent = v
    ? "Gemma 4 E2B · on-device" : "Gemini 3.5 Flash · cloud";
  if (v && state) {
    speak("We're offline now. I still have your situation. Ask me anything.");
    ensureLlm();
  }
}

// ---------- cache ----------
function writeCache(s) {
  s.network = { ...s.network, last_serialized_to_device: new Date().toISOString() };
  localStorage.setItem(CACHE_KEY, JSON.stringify(s));
}
function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
}

// ---------- map ----------
function initMap() {
  const st = station();
  map = L.map("map", { zoomControl: false, attributionControl: false })
    .setView([st.lat, st.lng], 16);
  L.tileLayer(TILE_URL, { maxZoom: 18 }).addTo(map);
  userMarker = L.marker([st.lat, st.lng], {
    icon: L.divIcon({ className: "user-pin", html: "📍", iconSize: [24, 24] }),
  }).addTo(map).bindPopup(`Maria — ${st.name}`);
  shelterLayer = L.layerGroup().addTo(map);
}

function renderMap() {
  if (!state?.live_delta) return;
  const st = station();
  userMarker.setLatLng([st.lat, st.lng]);
  shelterLayer.clearLayers();
  let best = null, bestLL = null;
  (state.live_delta.shelters || []).forEach((sh) => {
    if (sh.lat == null || sh.lng == null) return; // no coords in data → not on map
    const ll = [sh.lat, sh.lng];
    const open = sh.capacity === "open";
    L.marker(ll, {
      icon: L.divIcon({
        className: `shelter-pin ${open ? "" : "full"}`,
        html: open ? "🟢" : "⛔", iconSize: [22, 22],
      }),
    }).addTo(shelterLayer)
      .bindPopup(`<b>${sh.name}</b><br>${sh.dist_m}m · ${sh.step_free ? "step-free ✓" : "stairs"} · ${sh.capacity.toUpperCase()}`);
    // Best = open + step-free (Maria can't take stairs) + nearest.
    if (open && sh.step_free && (!best || sh.dist_m < best.dist_m)) { best = sh; bestLL = ll; }
  });
  if (routeLine) routeLine.remove();
  if (bestLL) {
    routeLine = L.polyline([[st.lat, st.lng], bestLL], {
      color: "#00b36b", weight: 5, dashArray: "10 8", opacity: 0.9,
    }).addTo(map).bindPopup(`Direction line → ${best.name}`);
  }
}

// Map pack: pre-cache the tile grid around the station so the map survives
// airplane mode. Fired automatically when the Scout's first live data lands.
async function downloadMapPack() {
  packDone = true;
  const st = station();
  const badge = document.getElementById("mapBadge");
  badge.hidden = false;
  const cache = await caches.open("aegis-tiles");
  const jobs = [];
  for (const z of [14, 15, 16]) {
    const c = latLngToTile(st.lat, st.lng, z);
    const r = z === 16 ? 3 : 2; // wider ring at street zoom
    for (let x = c.x - r; x <= c.x + r; x++)
      for (let y = c.y - r; y <= c.y + r; y++)
        jobs.push(TILE_URL.replace("{z}", z).replace("{x}", x).replace("{y}", y));
  }
  let done = 0;
  await Promise.allSettled(jobs.map(async (u) => {
    const res = await fetch(u, { mode: "cors" });
    if (res.ok) await cache.put(u, res);
    document.getElementById("tileCount").textContent = `${++done}/${jobs.length}`;
  }));
  badge.hidden = true;
  sysLog(`Map pack cached — ${done} tiles around ${st.name}. Map works offline now.`);
}
function latLngToTile(lat, lng, z) {
  const n = 2 ** z;
  return {
    x: Math.floor(((lng + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n),
  };
}

// ---------- camera (live stream; SCAN grabs a frame for the Eyes) ----------
async function startCam() {
  if (camStreamHandle) return;
  try {
    camStreamHandle = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }, audio: false,
    });
    document.getElementById("camStream").srcObject = camStreamHandle;
  } catch { document.getElementById("camHint").textContent = "Camera permission needed"; }
}
function stopCam() {
  camStreamHandle?.getTracks().forEach((t) => t.stop());
  camStreamHandle = null;
}
document.getElementById("scanBtn").onclick = async () => {
  const video = document.getElementById("camStream");
  if (!video.videoWidth) return;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  const image_b64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
  document.getElementById("camHint").textContent = "Reading…";
  const res = await fetch(`/api/eyes?session=${SESSION}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_b64, mime_type: "image/jpeg" }),
  }).catch(() => null);
  document.getElementById("camHint").textContent =
    res?.ok ? "Sign read ✓ — see instruction below" : "Couldn't read that — try closer";
};

// ---------- view switching ----------
function switchView(name) {
  document.getElementById("mapView").classList.toggle("active", name === "map");
  document.getElementById("camView").classList.toggle("active", name === "cam");
  document.getElementById("tabMap").classList.toggle("active", name === "map");
  document.getElementById("tabCam").classList.toggle("active", name === "cam");
  if (name === "cam") startCam(); else stopCam();
  if (name === "map") setTimeout(() => map.invalidateSize(), 60);
}
document.getElementById("tabMap").onclick = () => switchView("map");
document.getElementById("tabCam").onclick = () => switchView("cam");

// ---------- render ----------
function render() {
  if (!state) return;
  document.getElementById("chainId").textContent = shorten(state.interaction_chain_id);
  document.getElementById("envId").textContent = shorten(state.scout_environment_id);
  // Live latency readout: how long the cloud brain took on the last event.
  if (!offline && state.timing?.last_reason_ms) {
    document.getElementById("engine").textContent =
      `Gemini 3.5 Flash · cloud · ${(state.timing.last_reason_ms / 1000).toFixed(1)}s`;
  }

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
    ? `live data · ${age(state.live_delta.as_of)} old` : "";
  document.getElementById("confirmBtn").hidden = !g.needs_tap;

  // QA badge: the harness checking itself (Keeper invariants + Auditor agent)
  const qa = document.getElementById("qa");
  const a = state.audit;
  if (a && a.status !== "idle") {
    qa.className = `qa ${a.status}`;
    qa.textContent = `QA ${a.status === "pass" ? "✓" : "⚠"} ${a.source === "auditor-agent" ? "agent" : "auto"}`;
    for (const c of (a.checks || []).filter((c) => !c.ok)) {
      if (!localLog.includes(`QA: ${c.note}`)) localLog.push(`QA: ${c.note}`);
    }
  }

  const feed = document.getElementById("feed");
  feed.innerHTML = "";
  for (const line of [...localLog].reverse().slice(0, 3)) {
    const d = document.createElement("div");
    d.className = "evt sys"; d.textContent = line;
    feed.appendChild(d);
  }
  for (const e of [...(state.environment || [])].reverse().slice(0, 15)) {
    const d = document.createElement("div");
    d.className = "evt";
    d.innerHTML = `<span class="src">${e.src}</span>${esc(e.en || "")}` +
      (e.ja ? `<div class="ja">${esc(e.ja)}</div>` : "");
    feed.appendChild(d);
  }
  renderMap();
}
function sysLog(line) { localLog.push(line); render(); }

// ---------- emit events (the ONE law: only the Keeper writes state) ----------
function emit(type, payload = {}) {
  const event = { type, payload, src: "client", t: new Date().toISOString() };
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(event));
  else fetch(`/event?session=${SESSION}`, { method: "POST", body: JSON.stringify(event) }).catch(() => {});
}
document.getElementById("confirmBtn").onclick = () => emit("user_tap");
document.getElementById("askBtn").onclick = ask;
document.getElementById("askInput").onkeydown = (e) => { if (e.key === "Enter") ask(); };
document.getElementById("voiceBtn").onclick = () => unlockVoice(true);
async function ask() {
  const input = document.getElementById("askInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  if (!offline) return emit("user_utterance", { text });
  await askGemma(text); // offline: the on-device brain answers
}
document.querySelectorAll("#demoControls button").forEach((b) => {
  b.onclick = () => {
    const a = b.dataset.demo;
    if (a === "quake") emit("quake", { magnitude: "5+" });
    if (a === "pack") { packDone = false; downloadMapPack(); }
    if (a === "reset") { localLog.length = 0; fetch(`/api/reset?session=${SESSION}`, { method: "POST" }); }
    if (a === "offline") { try { ws.close(); } catch {} setOffline(true); }
  };
});

// ---------- offline brain: Gemma 4 E2B via MediaPipe ----------
async function ensureLlm() {
  if (llm) return llm;
  setInstruction("Loading on-device model…");
  const genai = await FilesetResolver.forGenAiTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm"
  );
  llm = await LlmInference.createFromOptions(genai, {
    baseOptions: { modelAssetPath: MODEL_PATH },
    maxTokens: 512, temperature: 0.4, topK: 40,
  });
  setInstruction("On-device model ready. Ask me anything.");
  return llm;
}
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

// ---------- voice ----------
// Mobile browsers BLOCK speech until the first user gesture — that's why
// "the voice doesn't work". First tap anywhere unlocks it, then everything
// queued speaks. We also pick the best available en voice instead of default.
let voiceUnlocked = false;
let pendingSpeech = null;
let chosenVoice = null;
function pickVoice() {
  if (!speech) return;
  const vs = speech.getVoices();
  chosenVoice =
    vs.find((v) => /Google US English/i.test(v.name)) ||
    vs.find((v) => v.lang === "en-US" && !v.localService) ||
    vs.find((v) => v.lang?.startsWith("en")) || null;
}
speech?.addEventListener?.("voiceschanged", pickVoice);
pickVoice();
document.addEventListener("pointerdown", function unlock() {
  unlockVoice(false);
}, { once: true });

function unlockVoice(test) {
  const btn = document.getElementById("voiceBtn");
  if (!speech) {
    btn.className = "warn";
    btn.textContent = "NO TTS";
    sysLog("Voice unavailable in this browser; use large text + narration fallback.");
    return;
  }
  voiceUnlocked = true;
  try { speech.resume(); } catch {}
  btn.className = "ready";
  btn.textContent = chosenVoice ? "VOICE OK" : "VOICE ON";
  if (pendingSpeech) { const t = pendingSpeech; pendingSpeech = null; speak(t); }
  else if (test) speak("Voice is ready. AEGIS will speak guidance out loud.");
}

function speak(text) {
  if (!text) return;
  if (!voiceUnlocked) { pendingSpeech = text; return; } // will speak on first tap
  if (!speech) return;
  try {
    speech.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    if (chosenVoice) u.voice = chosenVoice;
    u.rate = 1.02; u.pitch = 1.0; u.volume = 1.0;
    speech.speak(u);
  } catch {}
}

// ---------- helpers ----------
function setInstruction(t) { document.getElementById("instruction").textContent = t; }
function shorten(id) { return id ? `${String(id).slice(0, 10)}…` : "—"; }
function age(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
  return s < 90 ? `${Math.round(s)}s` : `${Math.round(s / 60)}min`;
}
function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

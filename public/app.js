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
startGeolocation(); // use the phone's REAL position, not a constant

// ---------- real GPS: the app follows where the user actually is ----------
let lastSentLL = null, heading = null;
function startGeolocation() {
  if (!navigator.geolocation) { sysLog("No GPS on this device — using station default."); return; }
  navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      if (pos.coords.heading != null && !Number.isNaN(pos.coords.heading)) heading = pos.coords.heading;
      // Debounce: only tell the Keeper when we've meaningfully moved (>15m).
      if (lastSentLL && distM(lastSentLL, { lat, lng }) < 15) { updateUserMarker(lat, lng); return; }
      lastSentLL = { lat, lng };
      emit("set_location", { lat, lng, accuracy_m: Math.round(accuracy) });
      updateUserMarker(lat, lng);
    },
    (err) => sysLog(`GPS: ${err.message} — using station default.`),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
}
function updateUserMarker(lat, lng) {
  if (userMarker) userMarker.setLatLng([lat, lng]);
}
function distM(a, b) {
  const R = 6371000, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function bearing(a, b) {
  const y = Math.sin(((b.lng - a.lng) * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180);
  const x = Math.cos((a.lat * Math.PI) / 180) * Math.sin((b.lat * Math.PI) / 180) -
    Math.sin((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.cos(((b.lng - a.lng) * Math.PI) / 180);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

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
  const pill = document.getElementById("statusPill");
  pill.className = `pill ${v ? "offline" : "online"}`;
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
  // Real "blue dot" GPS marker, like a native maps app.
  userMarker = L.marker([st.lat, st.lng], {
    icon: L.divIcon({ className: "user-pin", html: '<div class="core"></div>', iconSize: [18, 18] }),
  }).addTo(map);
  shelterLayer = L.layerGroup().addTo(map);
}

function renderMap() {
  if (!state?.live_delta) return;
  const st = station();
  userMarker.setLatLng([st.lat, st.lng]);
  shelterLayer.clearLayers();
  (state.live_delta.shelters || []).forEach((sh) => {
    if (sh.lat == null || sh.lng == null) return;
    const open = sh.capacity === "open";
    L.marker([sh.lat, sh.lng], {
      icon: L.divIcon({
        className: `shelter-pin ${open ? "" : "full"}`,
        html: open ? "🟢" : "⛔", iconSize: [22, 22],
      }),
    }).addTo(shelterLayer)
      .bindPopup(`<b>${sh.name}</b><br>${sh.dist_m}m · ${sh.step_free ? "step-free ✓" : "stairs"} · ${sh.capacity.toUpperCase()}`);
  });

  // Real walking route (OSRM street polyline from the Keeper) — not a straight line.
  if (routeLine) routeLine.remove();
  const r = state.route;
  if (r?.coords?.length) {
    routeLine = L.polyline(r.coords, {
      color: "#12d18e", weight: 7, opacity: 0.95, lineJoin: "round", lineCap: "round",
    }).addTo(map).bindPopup(`Route → ${r.target}`);
    // Casing under the route (nav-app look): a dark stroke behind the green.
    L.polyline(r.coords, { color: "#052b1e", weight: 11, opacity: 0.6, lineJoin: "round" })
      .addTo(shelterLayer).bringToBack();
    try { map.fitBounds(routeLine.getBounds().pad(0.28)); } catch {}
  }
}

// Map pack: pre-cache the tile grid around the station so the map survives
// airplane mode. Fired automatically when the Scout's first live data lands.
async function downloadMapPack() {
  packDone = true;
  const st = station();
  const toast = document.getElementById("toast");
  toast.hidden = false;
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
    toast.textContent = `⬇ Saving map for offline · ${++done}/${jobs.length}`;
  }));
  toast.textContent = "✓ Map saved — works without signal";
  setTimeout(() => { toast.hidden = true; }, 2500);
  sysLog(`Map pack cached — ${done} tiles around ${st.name}.`);
}
function latLngToTile(lat, lng, z) {
  const n = 2 ** z;
  return {
    x: Math.floor(((lng + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n),
  };
}

// ---------- camera (live stream; SCAN reads signs; AR arrow points to shelter) ----------
let compassDeg = null;
async function startCam() {
  if (camStreamHandle) return;
  try {
    camStreamHandle = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }, audio: false,
    });
    document.getElementById("camStream").srcObject = camStreamHandle;
  } catch { document.getElementById("camHint").textContent = "Camera permission needed"; }
  startCompass();
}

// Real compass: iOS needs a permission request; Android fires deviceorientation.
async function startCompass() {
  const handler = (e) => {
    const deg = e.webkitCompassHeading ?? (e.alpha != null ? 360 - e.alpha : null);
    if (deg != null) { compassDeg = deg; updateAR(); }
  };
  if (typeof DeviceOrientationEvent?.requestPermission === "function") {
    try { if ((await DeviceOrientationEvent.requestPermission()) === "granted")
      window.addEventListener("deviceorientationabsolute", handler, true) ||
      window.addEventListener("deviceorientation", handler, true); } catch {}
  } else {
    window.addEventListener("deviceorientationabsolute", handler, true);
    window.addEventListener("deviceorientation", handler, true);
  }
}

// Rotate the AR arrow so it points at the shelter relative to where the phone faces.
function updateAR() {
  const overlay = document.getElementById("arOverlay");
  const r = state?.route, st = station();
  if (!r?.coords?.length || compassDeg == null) { overlay.hidden = true; return; }
  const targetLL = r.coords[r.coords.length - 1];
  const brg = bearing({ lat: st.lat, lng: st.lng }, { lat: targetLL[0], lng: targetLL[1] });
  const rel = ((brg - compassDeg) % 360 + 360) % 360; // 0 = straight ahead
  overlay.hidden = false;
  document.getElementById("arArrow").style.transform = `rotate(${rel}deg)`;
  const dist = Math.round(distM({ lat: st.lat, lng: st.lng }, { lat: targetLL[0], lng: targetLL[1] }));
  const dir = rel < 30 || rel > 330 ? "straight ahead" : rel < 180 ? "to your right" : "to your left";
  document.getElementById("arLabel").textContent = `${r.target} · ${dist}m · ${dir}`;
}
function stopCam() {
  camStreamHandle?.getTracks().forEach((t) => t.stop());
  camStreamHandle = null;
}
document.getElementById("scanBtn").onclick = async () => {
  const video = document.getElementById("camStream");
  const label = document.querySelector("#scanBtn span");
  if (!video.videoWidth) return;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  const image_b64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
  label.textContent = "Reading…";
  const res = await fetch(`/api/eyes?session=${SESSION}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_b64, mime_type: "image/jpeg" }),
  }).catch(() => null);
  label.textContent = res?.ok ? "Sign read ✓" : "Try closer";
  setTimeout(() => { label.textContent = "Scan a sign"; }, 2000);
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
function setText(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt; }

function render() {
  if (!state) return;

  // Status pill: one calm word for a scared user.
  const g = state.guidance || {};
  const evt = state.event?.type === "earthquake";
  setText("statusText", offline ? "Offline · on-device" : evt ? "Guiding you" : "Monitoring");

  // The one instruction.
  if (g.current_instruction_en) {
    setText("instruction", g.current_instruction_en);
    if (!offline && g.current_instruction_en !== spokenInstruction) {
      spokenInstruction = g.current_instruction_en;
      speak(g.current_instruction_en);
    }
  }
  setText("question", g.next_question || "");
  setText("freshness", state.live_delta?.as_of ? `Live · updated ${age(state.live_delta.as_of)} ago` : "");
  document.getElementById("confirmBtn").hidden = !g.needs_tap;

  // Route banner: real ETA, like a navigation app.
  const banner = document.getElementById("routeBanner");
  const r = state.route;
  if (r?.coords?.length) {
    banner.hidden = false;
    setText("rbTime", `${Math.max(1, Math.round(r.duration_s / 60))} min`);
    setText("rbDist", `· ${r.distance_m} m`);
    setText("rbTarget", r.target);
    setText("rbStep", r.first_step ? `via ${r.first_step}` : "");
  } else {
    banner.hidden = true;
  }

  // Proof panel (tucked away): the harness truth for judges.
  setText("pxEngine", offline ? "Gemma 4 E2B (device)" : "Gemini 3.5 Flash");
  setText("pxLatency", state.timing?.last_reason_ms ? `${(state.timing.last_reason_ms / 1000).toFixed(1)}s` : "—");
  setProof("pxChain", state.interaction_chain_id ? shorten(state.interaction_chain_id) : "—", !!state.interaction_chain_id);
  setProof("pxEnv", state.scout_environment_id ? shorten(state.scout_environment_id) : "—", !!state.scout_environment_id);
  const a = state.audit;
  if (a && a.status !== "idle") {
    setProof("pxQA", `${a.status.toUpperCase()} · ${a.source === "auditor-agent" ? "agent" : "auto"}`, a.status === "pass");
    for (const c of (a.checks || []).filter((c) => !c.ok))
      if (!localLog.includes(`QA: ${c.note}`)) localLog.push(`QA: ${c.note}`);
  }
  const loc = state.user?.location;
  setProof("pxGps", loc?.source === "device_gps" ? `GPS ±${loc.accuracy_m ?? "?"}m` : "default", loc?.source === "device_gps");

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
    d.innerHTML = `<span class="src">${esc(e.src)}</span>${esc(e.en || "")}` +
      (e.ja ? `<div class="ja">${esc(e.ja)}</div>` : "");
    feed.appendChild(d);
  }
  renderMap();
}
function setProof(id, txt, ok) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = txt;
  el.className = ok ? "ok" : (txt === "—" || txt === "default" ? "" : "warn");
}
function sysLog(line) { localLog.push(line); render(); }

// ---------- emit events (the ONE law: only the Keeper writes state) ----------
function emit(type, payload = {}) {
  const event = { type, payload, src: "client", t: new Date().toISOString() };
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(event));
  else fetch(`/event?session=${SESSION}`, { method: "POST", body: JSON.stringify(event) }).catch(() => {});
}
document.getElementById("confirmBtn").onclick = () => emit("user_tap");
document.getElementById("askInput").onkeydown = (e) => { if (e.key === "Enter") ask(); };
// Mic button: unlock voice + start speech recognition (real spoken questions).
document.getElementById("micBtn").onclick = () => { unlockVoice(true); startDictation(); };
// Info button opens the proof panel.
document.getElementById("proofBtn").onclick = () => {
  const p = document.getElementById("proofPanel"); p.open = !p.open;
  if (p.open) p.scrollIntoView({ behavior: "smooth" });
};
async function ask() {
  const input = document.getElementById("askInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  if (!offline) return emit("user_utterance", { text });
  await askGemma(text); // offline: the on-device brain answers
}
// Real voice input via Web Speech API.
function startDictation() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  const rec = new SR();
  rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
  const btn = document.getElementById("micBtn");
  btn.classList.add("live");
  rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    document.getElementById("askInput").value = text;
    ask();
  };
  rec.onend = () => btn.classList.remove("live");
  rec.onerror = () => btn.classList.remove("live");
  try { rec.start(); } catch {}
}
document.querySelectorAll("#demoRow button").forEach((b) => {
  b.onclick = () => {
    const a = b.dataset.demo;
    if (a === "quake") emit("quake", { magnitude: "5+" });
    if (a === "reset") { localLog.length = 0; spokenInstruction = ""; fetch(`/api/reset?session=${SESSION}`, { method: "POST" }); }
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
  const btn = document.getElementById("micBtn");
  if (!speech) {
    sysLog("Voice unavailable in this browser; large text + narration fallback in use.");
    return;
  }
  if (!voiceUnlocked) {
    voiceUnlocked = true;
    try { speech.resume(); } catch {}
    btn?.classList.add("ready");
    if (pendingSpeech) { const t = pendingSpeech; pendingSpeech = null; speak(t); }
    else if (test) speak("Voice is ready. I'll speak your guidance out loud.");
  }
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

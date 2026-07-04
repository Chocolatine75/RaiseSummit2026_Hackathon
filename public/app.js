/**
 * AEGIS client.
 *
 * Online:  WebSocket → full Situation Object pushed on every change →
 *          written to localStorage (the handoff line).
 * Offline: WS closes → cached state stays visible; Ask falls back to HTTP
 *          (queued in SW if truly unreachable). On-device reasoning lives
 *          in the mobile app (Gemma 4 + LiteRT-LM).
 */

const SESSION = new URLSearchParams(location.search).get("session") || "demo";
const CACHE_KEY = `aegis_state_${SESSION}`;

let ws = null;
let state = null;
let offline = false;
let spokenInstruction = "";
let map = null;
let shelterLayer = null;

// ---------- boot ----------
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
initMap();
state = readCache();
if (state) render(); // instant paint from cache — the restart-persistence beat
connect();

// ---------- WebSocket ----------
function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws?session=${SESSION}`);
  ws.onmessage = (msg) => {
    state = JSON.parse(msg.data);
    writeCache(state);
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
  pill.textContent = v ? "OFFLINE — cached state" : "ONLINE";
  pill.className = `pill ${v ? "offline" : "online"}`;
  if (v && state) speak("We're offline. Last known situation is displayed.");
}

// ---------- cache ----------
function writeCache(s) {
  s.network = { ...s.network, last_serialized_to_device: new Date().toISOString() };
  localStorage.setItem(CACHE_KEY, JSON.stringify(s));
}
function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
}

// ---------- render ----------
function render() {
  if (!state) return;
  document.getElementById("chainId").textContent = shorten(state.interaction_chain_id);
  document.getElementById("envId").textContent = shorten(state.scout_environment_id);

  const g = state.guidance || {};
  if (g.current_instruction_en) {
    setInstruction(g.current_instruction_en);
    if (g.current_instruction_en !== spokenInstruction) {
      spokenInstruction = g.current_instruction_en;
      speak(g.current_instruction_en);
    }
  }
  document.getElementById("question").textContent = g.next_question || "";
  document.getElementById("freshness").textContent = state.live_delta?.as_of
    ? `live data as of ${age(state.live_delta.as_of)} ago` : "";
  document.getElementById("confirmBtn").hidden = !g.needs_tap;
  updateMap(state.live_delta?.shelters);

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

// ---------- emit ----------
function emit(type, payload = {}) {
  const event = { type, payload, src: "client", t: new Date().toISOString() };
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(event));
  } else {
    // HTTP fallback — works online even when WS is reconnecting
    fetch(`/event?session=${SESSION}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }).catch(() => {});
  }
}

document.getElementById("confirmBtn").onclick = () => emit("user_tap");

// Eyes: photo → /api/eyes → Gemini vision → sign_read event back via WS
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

// Ask: always emits user_utterance — Keeper reasons online, mobile app handles offline
document.getElementById("askBtn").onclick = ask;
document.getElementById("askInput").onkeydown = (e) => { if (e.key === "Enter") ask(); };
function ask() {
  const input = document.getElementById("askInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  emit("user_utterance", { text });
}

// Demo controls
document.querySelectorAll("#demoControls button").forEach((b) => {
  b.onclick = () => {
    const a = b.dataset.demo;
    if (a === "quake") emit("quake", { magnitude: "5+" });
    if (a === "reset") fetch(`/api/reset?session=${SESSION}`, { method: "POST" });
    if (a === "offline") { try { ws.close(); } catch {} setOffline(true); }
  };
});

// ---------- Leaflet shelter map ----------
function initMap() {
  if (map || !window.L) return;
  map = L.map("map", { zoomControl: true, attributionControl: false })
    .setView([35.6896, 139.7006], 15);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd",
    maxZoom: 19,
    crossOrigin: true,
  }).addTo(map);
  shelterLayer = L.layerGroup().addTo(map);
}

function updateMap(shelters) {
  if (!map) return;
  shelterLayer.clearLayers();
  const valid = (shelters || []).filter(s => s.coordinates?.lat);
  for (const s of valid) {
    L.circleMarker([s.coordinates.lat, s.coordinates.lng], {
      radius: 9,
      fillColor: s.step_free ? "#6ef0a0" : "#8fb4ff",
      color: "#0b1220",
      weight: 2,
      fillOpacity: 0.9,
    })
      .bindPopup(`<div class="shelter-popup"><b>${esc(s.name)}</b><br>${esc(s.address)}${s.step_free ? "<br>✓ step-free" : ""}</div>`)
      .addTo(shelterLayer);
  }
  if (valid.length) {
    map.fitBounds(
      L.latLngBounds(valid.map(s => [s.coordinates.lat, s.coordinates.lng])),
      { padding: [24, 24], maxZoom: 15 }
    );
  }
}

// ---------- helpers ----------
function speak(text) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
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
    r.onload = () => res(String(r.result).split(",")[1]);
    r.readAsDataURL(file);
  });
}

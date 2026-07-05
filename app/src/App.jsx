import { useEffect, useRef, useState } from "react";
import { useAegis } from "./hooks/useAegis";
import MapView from "./components/MapView";
import OfflineHandoff from "./components/OfflineHandoff";
import EngineRoom from "./components/EngineRoom";
import QuakeAlert from "./components/QuakeAlert";
import GuidanceCards from "./components/GuidanceCards";
import Icon from "./components/Icon";

export default function App() {
  const { state, offline, emit, regionPrep, session, forceOffline, goOnline } = useAegis();
  const [tab, setTab] = useState("map");
  const [ask, setAsk] = useState("");
  const [time, setTime] = useState("");
  const [warpCity, setWarpCity] = useState("");
  const [warpStatus, setWarpCityStatus] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [gemmaStatus, setGemmaStatus] = useState("dormant"); // dormant, loading, ready, error
  const [gemmaProgress, setGemmaProgress] = useState(0);
  const [gemmaError, setGemmaError] = useState("");
  const [handoff, setHandoff] = useState(false); // the offline transition moment
  const [showAlert, setShowAlert] = useState(false); // JA government push
  const spokenRef = useRef("");
  const wasQuakeRef = useRef(false);
  const recognitionRef = useRef(null);
  const gemmaInferenceRef = useRef(null);
  const wasOfflineRef = useRef(false);

  // Fire the cinematic handoff exactly once, on the false→true offline edge.
  useEffect(() => {
    if (offline && !wasOfflineRef.current) setHandoff(true);
    wasOfflineRef.current = offline;
  }, [offline]);

  // The JA government push fires once, on the moment the quake begins.
  const quakeNow = state?.event?.type === "earthquake";
  useEffect(() => {
    if (quakeNow && !wasQuakeRef.current && !offline) setShowAlert(true);
    wasQuakeRef.current = quakeNow;
  }, [quakeNow, offline]);

  const g = state?.guidance || {};
  const r = state?.route;
  const quake = state?.event?.type === "earthquake";
  const active = quake || !!g.current_instruction_en; // there is a live instruction to show

  // The chosen shelter behind the route, for the destination row.
  const chosen = (state?.live_delta?.shelters || []).find((s) => s.name === r?.target)
    || state?.live_delta?.shelters?.[0];
  const destSub = chosen
    ? `${chosen.capacity === "full" ? "Capacity unknown" : "Open"} · ${chosen.step_free ? "step-free" : "has stairs"} · nearest shelter`
    : "nearest open shelter";

  const presetLocations = [
    { label: "Tokyo Tower", value: "Tokyo Tower" },
    { label: "Shibuya Crossing", value: "Shibuya" },
    { label: "Akihabara", value: "Akihabara" },
    { label: "Shinjuku Station", value: "Shinjuku" },
    { label: "RAISE Summit · Paris", value: "Paris" },
  ];

  // Speech recognition initialization
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => setIsListening(true);
      rec.onend = () => setIsListening(false);
      rec.onerror = () => setIsListening(false);
      rec.onresult = (e) => {
        const text = e.results[0]?.[0]?.transcript;
        if (text) {
          setAsk(text);
          emit("user_utterance", { text });
        }
      };
      recognitionRef.current = rec;
    }
  }, [emit]);

  const toggleListen = () => {
    if (!recognitionRef.current) return;
    if (isListening) recognitionRef.current.stop();
    else { setAsk(""); recognitionRef.current.start(); }
  };

  const handleWarp = async (cityName) => {
    const city = (cityName || warpCity).trim();
    if (!city) return;
    setWarpCityStatus("Locating…");
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(city)}`, {
        headers: { "User-Agent": "AEGIS-emergency-nav/1.0" },
      });
      if (!res.ok) throw new Error("Network error geocoding");
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        const displayName = data[0].display_name.split(",")[0] + ", " + (data[0].display_name.split(",")[2] || "");
        emit("set_location", { lat, lng, accuracy_m: 10, place: displayName, source: "device_gps" });
        setWarpCityStatus(`Now at ${displayName}`);
        setWarpCity("");
        setTimeout(() => setWarpCityStatus(""), 4000);
      } else {
        const presets = {
          shibuya: { lat: 35.658, lng: 139.7016, name: "Shibuya, Tokyo" },
          "tokyo tower": { lat: 35.6586, lng: 139.7454, name: "Minato, Tokyo" },
          shinjuku: { lat: 35.6896, lng: 139.7006, name: "Shinjuku, Tokyo" },
          akihabara: { lat: 35.6983, lng: 139.7745, name: "Chiyoda, Tokyo" },
          paris: { lat: 48.8566, lng: 2.3522, name: "Paris, France" },
        };
        const key = city.toLowerCase();
        if (presets[key]) {
          emit("set_location", { lat: presets[key].lat, lng: presets[key].lng, accuracy_m: 10, place: presets[key].name, source: "device_gps" });
          setWarpCityStatus(`Now at ${presets[key].name}`);
          setWarpCity("");
          setTimeout(() => setWarpCityStatus(""), 4000);
        } else {
          setWarpCityStatus("Location not found.");
        }
      }
    } catch (e) {
      setWarpCityStatus("Couldn't resolve that location.");
    }
  };

  // Clock for the simulated phone status bar
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  // Speak new guidance aloud (once unlocked by a tap).
  const voiceRef = useRef({ unlocked: false, pending: null });
  const audioRef = useRef(null);

  useEffect(() => {
    const unlock = () => {
      voiceRef.current.unlocked = true;
      try { speechSynthesis.resume(); } catch {}
      if (voiceRef.current.pending) { speak(voiceRef.current.pending); voiceRef.current.pending = null; }
    };
    document.addEventListener("pointerdown", unlock, { once: true });
    return () => document.removeEventListener("pointerdown", unlock);
  }, []);
  useEffect(() => {
    if (g.current_instruction_en && g.current_instruction_en !== spokenRef.current && !offline) {
      spokenRef.current = g.current_instruction_en;
      speak(g.current_instruction_en);
    }
  }, [g.current_instruction_en, offline]);

  function speak(t) {
    if (!voiceRef.current.unlocked) { voiceRef.current.pending = t; return; }
    if (!offline) {
      try {
        if (audioRef.current) audioRef.current.pause();
        const audio = new Audio(`/api/speak?text=${encodeURIComponent(t)}&session=${session}`);
        audioRef.current = audio;
        audio.play().catch(() => fallbackSpeak(t));
      } catch { fallbackSpeak(t); }
    } else {
      fallbackSpeak(t);
    }
  }
  function fallbackSpeak(t) {
    if (!("speechSynthesis" in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      u.lang = "en-US"; u.rate = 1.02;
      speechSynthesis.speak(u);
    } catch {}
  }

  // Initialize and compile Gemma 4 in the browser (on-device brain)
  const initGemma = async () => {
    if (gemmaStatus === "ready" || gemmaStatus === "loading") return;
    setGemmaStatus("loading");
    setGemmaProgress(20);
    try {
      const genai = window.tasksGenAI;
      if (!genai) throw new Error("MediaPipe TasksGenAI not loaded.");
      setGemmaProgress(40);
      const filesetResolver = await genai.FilesetResolver.forGenAiTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai/wasm");
      setGemmaProgress(70);
      const modelUrl = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? "/models/gemma-4-E2B-it-web.task"
        : "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.task";
      const inference = await genai.LlmInference.createFromOptions(filesetResolver, {
        baseOptions: { modelAssetPath: modelUrl },
        maxTokens: 128, temperature: 0.6,
      });
      gemmaInferenceRef.current = inference;
      setGemmaStatus("ready");
      setGemmaProgress(100);
    } catch (err) {
      console.error("Gemma 4 web-inference error:", err);
      setGemmaStatus("error");
      setGemmaError(err.message);
    }
  };

  const submitAsk = async () => {
    const t = ask.trim();
    if (!t) return;
    setAsk("");

    if (offline) {
      if (gemmaStatus !== "ready") {
        alert("On-device Gemma isn't warmed up yet. Open Live Ops and tap Warm up on-device AI first.");
        return;
      }
      const nowIso = new Date().toISOString();
      if (state) {
        state.environment = state.environment || [];
        state.environment.push({ src: "user", en: t, t: nowIso });
      }
      const prompt = `You are AEGIS, an offline on-device emergency assistant. Guide the user safely based on current situation data.\n` +
        `Situation: ${JSON.stringify(state)}\n\nUser query: "${t}"\n\n` +
        `Reply with ONE concise, actionable emergency step. Keep it under 25 words. Do not invent exits.`;
      try {
        const response = await gemmaInferenceRef.current.generateResponse(prompt);
        if (state) {
          const updated = { ...state };
          updated.guidance = { current_instruction_en: response, next_question: "Are you safe and following the offline guide?", needs_tap: false, confirmed: false };
          updated.timing = { last_reason_ms: 65 };
          localStorage.setItem(`aegis_state_${session}`, JSON.stringify(updated));
          emit("user_utterance", { text: t, dummy: true });
        }
      } catch (err) {
        console.error("Local generation failed:", err);
      }
    } else {
      emit("user_utterance", { text: t });
    }
  };

  const statusText = offline ? "guiding offline" : active ? "active" : "on watch";
  const netLabel = offline ? "OFFLINE" : "5G";

  return (
    <div className="stage">
      {/* ══ USER SIDE: the phone ══ */}
      <div className="phone-pane">
        <div className="phone-bezel">
          <div className="phone-island" />
          <div className="phone-screen-bar">
            <div className="phone-time">{time}</div>
            <div className="phone-icons">
              <svg width="17" height="11" viewBox="0 0 17 11" aria-hidden="true"><rect x="0" y="7" width="2.6" height="4" rx="1" fill="currentColor"/><rect x="4" y="5" width="2.6" height="6" rx="1" fill="currentColor"/><rect x="8" y="2.5" width="2.6" height="8.5" rx="1" fill="currentColor"/><rect x="12" y="0" width="2.6" height="11" rx="1" fill="currentColor"/></svg>
              <span className="sb-5g">{netLabel}</span>
              <svg width="24" height="12" viewBox="0 0 24 12" aria-hidden="true"><rect x="0.5" y="0.5" width="20" height="11" rx="3" fill="none" stroke="currentColor" strokeOpacity="0.5"/><rect x="2.2" y="2.2" width="15" height="7.6" rx="1.6" fill="currentColor"/><rect x="21.5" y="3.5" width="2" height="5" rx="1" fill="currentColor" fillOpacity="0.5"/></svg>
            </div>
          </div>

          <div className={`app ${offline ? "offline" : ""}`}>
            {handoff && <OfflineHandoff state={state} onDone={() => setHandoff(false)} />}
            {showAlert && <QuakeAlert state={state} onOpen={() => setShowAlert(false)} />}
            <MapView state={state} active={tab === "map"} />

            {tab === "chat" ? (
              <div className="chatView active">
                <div className="chatHeader">
                  <div className="chatTitle">Live dialogue</div>
                  <div className="chatSubtitle">{offline ? "On-device Gemma 4" : "Stateful Gemini reasoning chain"}</div>
                </div>
                <div className="chatMessages">
                  {(!state?.environment || state.environment.length === 0) && (
                    <div className="chatEmpty">
                      <p>Ask AEGIS about the earthquake, your route's safety, or what a sign in front of you means. It answers in your language.</p>
                    </div>
                  )}
                  {[...(state?.environment || [])].map((msg, idx) => {
                    const isUser = msg.src === "user";
                    return (
                      <div key={idx} className={`chatMessageRow ${isUser ? "user" : "aegis"}`}>
                        {!isUser && <div className="chatAvatar"><Icon name="shield" size={15} /></div>}
                        <div className="chatBubble">
                          {msg.en}
                          {msg.ja && <div className="chatJaText">{msg.ja}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="askRow chatAskRow">
                  <input value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitAsk()} placeholder={isListening ? "Listening…" : "Ask AEGIS anything…"} />
                  <button className={`micBtn ${isListening ? "live" : ""}`} onClick={toggleListen} aria-label="Voice"><Icon name="mic" size={18} /></button>
                </div>
              </div>
            ) : (
              <>
                {/* status pill — brand + live state, top-left */}
                <div className={`statusPill ${offline ? "offline" : "online"}`}>
                  <span className="dot" />
                  <span className="brand">AEGIS</span>
                  <span>· {statusText}</span>
                </div>

                {/* ETA pill — top-right, only while a route exists */}
                {r?.coords?.length > 0 && (
                  <div className="etaPill">
                    <Icon name="arrow" size={14} />
                    <b>{Math.max(1, Math.round(r.duration_s / 60))} min</b>
                    <span>· {r.distance_m} m</span>
                  </div>
                )}

                {/* region-prep toast */}
                {regionPrep && (
                  <div className="toast">
                    {!regionPrep.done && <div className="tspin" />}
                    {regionPrep.done && <div className="tdone"><Icon name="check" size={13} /></div>}
                    <div className="tbody"><b>{regionPrep.title}</b><span>{regionPrep.sub}</span></div>
                  </div>
                )}

                {/* bottom sheet — the instruction is the hero */}
                <div className={`sheet ${quake ? "alert" : ""}`}>
                  <div className="grip" />

                  {/* eyebrow: what the app is doing right now */}
                  <div className="eyebrow">
                    <span className={`chip ${quake ? "danger" : "calm"}`}>
                      {offline && <Icon name="wifiOff" size={12} />}
                      {quake && !offline && <Icon name="warning" size={12} />}
                      {offline ? "On-device" : quake ? "Active emergency" : "All clear"}
                    </span>
                    {state?.live_delta?.as_of && <span className="ago">updated {age(state.live_delta.as_of)} ago</span>}
                  </div>

                  {/* destination row — the chosen shelter */}
                  {r?.coords?.length > 0 && (
                    <div className="destRow">
                      <span className="dc-ic"><Icon name="shelter" size={19} /></span>
                      <div className="dc-body">
                        <div className="dc-name">{r.target}</div>
                        <div className="dc-sub">{destSub}</div>
                      </div>
                      <Icon name="chevron" size={15} className="dc-chev" />
                    </div>
                  )}

                  {!active ? (
                    // Purposeful idle state — not dead space.
                    <div className="idle">
                      <p className="idle-line">No alerts near {state?.user?.location?.station || "you"}.</p>
                      <p className="idle-sub">AEGIS is listening for earthquake warnings, station announcements, and evacuation notices — in your language.</p>
                    </div>
                  ) : (
                    // Panic-mode: one thing per swipe card, never a paragraph.
                    <GuidanceCards state={state} offline={offline} onConfirm={() => emit("user_tap")} />
                  )}

                  <div className="askRow">
                    <input value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitAsk()} placeholder={isListening ? "Listening…" : "Ask AEGIS anything…"} />
                    <button className={`micBtn ${isListening ? "live" : ""}`} onClick={toggleListen} aria-label="Voice"><Icon name="mic" size={18} /></button>
                  </div>
                </div>
              </>
            )}

            {/* tab bar */}
            <nav className="tabbar">
              <button className={`tab ${tab === "map" ? "active" : ""}`} onClick={() => setTab("map")}><Icon name="map" size={22} /><span>Map</span></button>
              <button className={`tab ${tab === "chat" ? "active" : ""}`} onClick={() => setTab("chat")}><Icon name="chat" size={22} /><span>Chat</span></button>
            </nav>
          </div>

          <div className="phone-home-indicator" />
        </div>
      </div>

      {/* ══ BACKEND SIDE: the engine room ══ */}
      <div className="engine-pane">
        <EngineRoom state={state} offline={offline} />

        {/* narrator control bar — drives the pitch beats */}
        <div className="pitch-bar">
          <div className="pb-group">
            <button className="pb-btn" onClick={() => handleWarp("Shinjuku")}><Icon name="pin" size={14} /> Arrive in Tokyo</button>
            <button className="pb-btn primary" onClick={() => emit("quake", { magnitude: "5+" })}><Icon name="warning" size={14} /> Trigger quake</button>
            {!offline
              ? <button className="pb-btn" onClick={forceOffline}><Icon name="wifiOff" size={14} /> Cut the network</button>
              : <button className="pb-btn" onClick={goOnline}><Icon name="bolt" size={14} /> Restore network</button>}
            <button className="pb-btn ghost" onClick={() => fetch(`/api/reset?session=${session}`, { method: "POST" })}><Icon name="reset" size={14} /> Reset</button>
          </div>
          <div className="pb-model">
            <span className={`pb-model-dot ${gemmaStatus}`} />
            Gemma&nbsp;4 · {gemmaStatus === "ready" ? "loaded" : gemmaStatus === "loading" ? `${gemmaProgress}%` : gemmaStatus}
            {gemmaStatus === "dormant" && <button className="pb-warm" onClick={initGemma}>warm up</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
function age(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
  return s < 90 ? `${Math.round(s)}s` : `${Math.round(s / 60)}min`;
}

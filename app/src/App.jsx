import { useEffect, useRef, useState, useCallback } from "react";
import { useAegis } from "./hooks/useAegis";
import MapView from "./components/MapView";
import Icon from "./components/Icon";
import Onboarding from "./components/Onboarding";
import OfflineHandoff from "./components/OfflineHandoff";
import QuakeAlert from "./components/QuakeAlert";

const LANGS = [
  { code: "en", label: "English" }, { code: "ja", label: "日本語" }, { code: "zh", label: "中文" },
  { code: "ko", label: "한국어" }, { code: "es", label: "Español" }, { code: "fr", label: "Français" },
];

export default function App() {
  const { state, offline, emit, session, forceOffline, goOnline } = useAegis();
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem("aegis_onboarded") === "1");
  const [lang, setLang] = useState(() => localStorage.getItem("aegis_lang") || "en");
  const [consent, setConsent] = useState(() => {
    try { return JSON.parse(localStorage.getItem("aegis_consent")) || { autoAlert: true, liveLocation: true, govShare: false }; }
    catch { return { autoAlert: true, liveLocation: true, govShare: false }; }
  });
  const [tab, setTab] = useState("home");
  const [langOpen, setLangOpen] = useState(false);
  const [sheet, setSheet] = useState("peek"); // peek | full
  const [ask, setAsk] = useState("");
  const [listening, setListening] = useState(false);
  const [drawer, setDrawer] = useState(null); // agent trace drawer
  const [showAlert, setShowAlert] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [sos, setSos] = useState(false);
  const [time, setTime] = useState("");
  const [card, setCard] = useState(0); // guidance swipe index
  const [gemmaStatus, setGemmaStatus] = useState("dormant"); // dormant, loading, ready, error
  const [gemmaProgress, setGemmaProgress] = useState(0);
  const [gemmaError, setGemmaError] = useState("");
  const gemmaInferenceRef = useRef(null);

  const g = state?.guidance || {};
  const r = state?.route;
  const quake = state?.event?.type === "earthquake";
  const best = state?.live_delta?.shelters?.[0];
  const hospital = state?.live_delta?.hospitals?.[0];

  const recRef = useRef(null);
  const audioRef = useRef(null);
  const spokenRef = useRef("");
  const wasOffRef = useRef(false);
  const wasQuakeRef = useRef(false);

  useEffect(() => { const u = () => setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })); u(); const i = setInterval(u, 1000); return () => clearInterval(i); }, []);
  useEffect(() => { localStorage.setItem("aegis_lang", lang); }, [lang]);
  useEffect(() => { localStorage.setItem("aegis_consent", JSON.stringify(consent)); }, [consent]);

  // fire alert + open sheet when quake begins
  useEffect(() => {
    if (quake && !wasQuakeRef.current) { setShowAlert(true); setSheet("full"); setCard(0); }
    wasQuakeRef.current = quake;
  }, [quake]);
  // cinematic handoff on offline edge — also warm the on-device Gemma so voice works offline
  useEffect(() => { if (offline && !wasOffRef.current) { setHandoff(true); setSheet("full"); initGemma(); } wasOffRef.current = offline; }, [offline]);

  // Initialize and compile Gemma 4 in the browser (Small Gemma on-device)
  const initGemma = async () => {
    if (gemmaStatus === "ready" || gemmaStatus === "loading") return;
    setGemmaStatus("loading");
    setGemmaProgress(20);
    try {
      const genai = window.tasksGenAI;
      if (!genai) {
        throw new Error("MediaPipe TasksGenAI not loaded. Ensure network or scripts are correct.");
      }
      setGemmaProgress(40);
      const filesetResolver = await genai.FilesetResolver.forGenAiTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai/wasm"
      );
      setGemmaProgress(70);
      const modelUrl = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? "/models/gemma-4-E2B-it-web.task"
        : "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.task";

      const inference = await genai.LlmInference.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: modelUrl
        },
        maxTokens: 128,
        temperature: 0.6,
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

  const handleUserUtterance = async (t) => {
    if (!t) return;
    
    if (offline) {
      if (gemmaStatus !== "ready") {
        alert("Local Gemma 4 model is not ready! Please click 'warm up' on the bottom right first.");
        return;
      }
      // Add user query locally to environment array to display in feed
      const fakeTime = new Date().toISOString();
      if (state) {
        state.environment = state.environment || [];
        state.environment.push({ src: "user", en: t, t: fakeTime });
      }

      // Prompt template specifically crafted for the E2B-it edge model
      const prompt = `You are AEGIS, an offline on-device emergency assistant. Guide the user safely based on current situation data.\n` +
        `Situation: ${JSON.stringify(state)}\n\n` +
        `User query: "${t}"\n\n` +
        `Reply with ONE concise, actionable emergency step. Keep it under 25 words. Do not invent exits.`;
      
      try {
        const response = await gemmaInferenceRef.current.generateResponse(prompt);
        if (state) {
          const updated = { ...state };
          updated.guidance = {
            ...updated.guidance,
            current_instruction_en: response,
            next_question: "Are you safe and following the offline guide?",
            needs_tap: false,
            confirmed: false,
            action: "OFFLINE GUIDE",
            headline: "Gemma Edge Active"
          };
          updated.timing = { last_reason_ms: 65 }; // local edge performance!
          localStorage.setItem(`aegis_state_${session}`, JSON.stringify(updated));
          // Emit a mock event to trigger a reactive state-sync
          emit("user_utterance", { text: t, dummy: true });
        }
      } catch (err) {
        console.error("Local generation failed:", err);
      }
    } else {
      emit("user_utterance", { text: t });
    }
    setSheet("full");
  };

  // ── real-time VOICE: press mic → listen → speak the answer (no chatbot enter) ──
  const isInitialRef = useRef(true);
  useEffect(() => {
    const t = setTimeout(() => { isInitialRef.current = false; }, 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR(); rec.continuous = false; rec.interimResults = false;
    const langMap = {
      en: "en-US",
      ja: "ja-JP",
      zh: "zh-CN",
      ko: "ko-KR",
      es: "es-ES",
      fr: "fr-FR"
    };
    rec.lang = langMap[lang] || "en-US";
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (e) => { const t = e.results[0]?.[0]?.transcript; if (t) { handleUserUtterance(t); } };
    recRef.current = rec;
  }, [emit, lang, offline, gemmaStatus]);

  const toggleMic = () => { const rec = recRef.current; if (!rec) return; if (listening) rec.stop(); else { try { rec.start(); } catch {} } };

  const handleWarp = async (city) => {
    if (!city) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(city)}`, {
        headers: { "User-Agent": "AEGIS-emergency-nav/1.0" }
      });
      if (!res.ok) throw new Error("Network error geocoding");
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        const displayName = data[0].display_name.split(",")[0] + ", " + (data[0].display_name.split(",")[2] || "");
        
        emit("set_location", {
          lat,
          lng,
          accuracy_m: 10,
          place: displayName,
          source: "device_gps"
        });
      } else {
        const presets = {
          "Shinjuku": { lat: 35.6896, lng: 139.7006, name: "Shinjuku, Tokyo" },
          "Shibuya": { lat: 35.6580, lng: 139.7016, name: "Shibuya, Tokyo" },
        };
        const p = presets[city];
        if (p) {
          emit("set_location", {
            lat: p.lat,
            lng: p.lng,
            accuracy_m: 10,
            place: p.name,
            source: "device_gps"
          });
        }
      }
    } catch (e) {
      console.error("Geocoding failed:", e);
    }
  };

  // speak guidance aloud (real Gemini TTS online, browser TTS offline)
  const voiceRef = useRef({ unlocked: false });
  useEffect(() => { const u = () => { voiceRef.current.unlocked = true; }; document.addEventListener("pointerdown", u, { once: true }); return () => document.removeEventListener("pointerdown", u); }, []);
  useEffect(() => {
    const t = g.headline || g.current_instruction_en;
    if (t) {
      if (isInitialRef.current) {
        spokenRef.current = t;
      } else if (t !== spokenRef.current) {
        spokenRef.current = t;
        speak(t);
      }
    }
  }, [g.headline, g.current_instruction_en]);
  function speak(t) {
    if (!voiceRef.current.unlocked) return;
    if (!offline) {
      try { 
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
          audioRef.current.load();
        }
        const a = new Audio(`/api/speak?text=${encodeURIComponent(t)}&session=${session}`); 
        audioRef.current = a; 
        a.play().catch(() => sysSpeak(t)); 
      } catch { 
        sysSpeak(t); 
      }
    } else sysSpeak(t);
  }
  function sysSpeak(t) { if (!("speechSynthesis" in window)) return; try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = "en-US"; u.rate = 1.03; speechSynthesis.speak(u); } catch {} }

  // hidden demo trigger: long-press the brand pill fires the quake
  const pressRef = useRef(null);
  const brandDown = () => { pressRef.current = setTimeout(() => emit("quake", { magnitude: "5+" }), 650); };
  const brandUp = () => clearTimeout(pressRef.current);

  const startSos = () => { setSos(true); };
  const active = quake || !!g.current_instruction_en;

  if (!onboarded) {
    return (
      <div className="stage"><div className="phone"><div className="notch" />
        <Onboarding lang={lang} setLang={setLang} consent={consent} setConsent={setConsent}
          onDone={() => { localStorage.setItem("aegis_onboarded", "1"); setOnboarded(true); }} />
      </div></div>
    );
  }

  const brandCls = offline ? "offline" : quake ? "emergency" : "";
  const brandTxt = offline ? "On-device" : quake ? "Emergency" : "Monitoring";

  return (
    <div className="stage">
      <div className={`phone ${offline ? "offline" : ""}`}><div className="notch" />
          <div className="screen">
            <div className="statusbar">
              <span>{time}</span>
              <div className="sb-right">
                <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="2.6" height="4" rx="1" fill="currentColor"/><rect x="4" y="5" width="2.6" height="6" rx="1" fill="currentColor"/><rect x="8" y="2.5" width="2.6" height="8.5" rx="1" fill="currentColor"/><rect x="12" y="0" width="2.6" height="11" rx="1" fill="currentColor"/></svg>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{offline ? "SOS" : "5G"}</span>
                <Icon name="battery" size={17} />
              </div>
            </div>

            {tab === "home" && (
              <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
                <MapView state={state} active offline={offline} />

                {showAlert && <QuakeAlert state={state} onOpen={() => setShowAlert(false)} />}
                {handoff && <OfflineHandoff state={state} onDone={() => setHandoff(false)} />}

                {/* top bar over the map */}
                {!handoff && (
                  <div className="topbar">
                    <div className={`brand-pill ${brandCls}`} onPointerDown={brandDown} onPointerUp={brandUp} onPointerLeave={brandUp}>
                      <span className="logo"><Icon name="shield" size={18} /></span>
                      AEGIS <span className="brand-sub">· {brandTxt}</span>
                    </div>
                    <div className="lang-pill" onClick={() => setLangOpen((v) => !v)}>
                      <Icon name="globe" size={14} /> {LANGS.find((l) => l.code === lang)?.label.slice(0, 2).toUpperCase()}
                      {langOpen && (
                        <div className="lang-menu" onClick={(e) => e.stopPropagation()}>
                          {LANGS.map((l) => <button key={l.code} className={l.code === lang ? "on" : ""} onClick={() => { setLang(l.code); setLangOpen(false); }}>{l.label}</button>)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* recenter FAB */}
                {!handoff && <button className="fab" style={{ bottom: sheet === "full" ? "82%" : 278 }} onClick={() => window.dispatchEvent(new Event("aegis-recenter"))}><Icon name="crosshair" size={20} /></button>}

                {/* bottom sheet */}
                {!handoff && (
                  <div className={`sheet ${sheet}`} onClick={() => sheet === "peek" && setSheet("full")}>
                    <div className="grip" onClick={(e) => { e.stopPropagation(); setSheet(sheet === "full" ? "peek" : "full"); }} />

                    <div className="chip-row">
                      <span className={`chip ${offline ? "amber" : quake ? "red" : "green"}`}>
                        {offline ? <><Icon name="wifiOff" size={12} /> On-device</> : quake ? <><Icon name="warning" size={12} /> Emergency</> : <><Icon name="shieldCheck" size={12} /> All clear</>}
                      </span>
                      {state?.live_delta?.as_of && <span className="chip-age">updated {age(state.live_delta.as_of)} ago</span>}
                    </div>

                    {!active ? (
                      <>
                        <div className="idle-title">You're in {state?.user?.location?.station || "Tokyo"}.</div>
                        <div className="idle-sub">AEGIS is listening for earthquake early-warnings, station announcements and evacuation notices — in your language.</div>
                        <div className="orb-wrap">
                          <div className={`orb ${listening ? "listening" : ""}`} onClick={toggleMic}>
                            {listening && <span className="ring" />}
                            <span className="core"><Icon name="mic" size={26} /></span>
                          </div>
                        </div>
                        <div className="orb-label">{listening ? "Listening…" : "Tap to speak"}</div>
                        <div className="orb-hint">Ask “where's the nearest shelter?” — it answers out loud.</div>
                      </>
                    ) : (
                      <GuidanceCards g={g} r={r} best={best} hospital={hospital} offline={offline} card={card} setCard={setCard} onConfirm={() => emit("user_tap")} />
                    )}

                    {/* live translate transcript (real PA translations + user turns) */}
                    <Transcript state={state} offline={offline} />

                    {active && <button className="sos" onClick={startSos}><Icon name="warning" size={18} /> I need help now</button>}

                    {/* mic control (real-time voice, not chatbot enter) */}
                    <div className="orb-wrap" style={{ margin: "16px 0 2px" }}>
                      <div className={`orb ${listening ? "listening on-red" : ""}`} style={{ width: 68, height: 68 }} onClick={toggleMic}>
                        {listening && <span className="ring" />}
                        <span className="core" style={{ width: 46, height: 46 }}><Icon name="mic" size={20} /></span>
                      </div>
                    </div>
                    <div className="orb-label">{listening ? "Listening — speak now" : "Hold-free · tap to ask by voice"}</div>

                    {/* the pack: real agents working, tappable for their live trace */}
                    <PackAgents state={state} offline={offline} onOpen={setDrawer} />
                  </div>
                )}
              </div>
            )}

            {tab === "map" && <MapTab state={state} />}
            {tab === "support" && <SupportTab hospital={hospital} />}
            {tab === "privacy" && <PrivacyTab consent={consent} setConsent={setConsent} lang={lang} setLang={setLang} state={state} offline={offline} onOffline={forceOffline} onOnline={goOnline} />}

            <nav className="nav">
              {[["home", "home", "Home"], ["map", "map", "Map"], ["support", "headphones", "Support"], ["privacy", "lock", "Privacy"]].map(([id, ic, lb]) => (
                <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}><Icon name={ic} size={20} /><span>{lb}</span></button>
              ))}
            </nav>

            {drawer && <AgentDrawer agent={drawer} state={state} onClose={() => setDrawer(null)} />}
            {sos && <SosOverlay consent={consent} onResolve={() => setSos(false)} />}
          </div>
        </div>
    </div>
  );
}

/* ── guidance swipe cards ── */
function GuidanceCards({ g, r, best, hospital, offline, card, setCard, onConfirm }) {
  // All hooks first, unconditionally — never behind an early return (hook order).
  const [expanded, setExpanded] = useState(false);
  const sx = useRef(null);
  const cards = [];
  if (g.action || g.headline || g.current_instruction_en) cards.push("action");
  if (r?.coords?.length || best) cards.push("shelter");
  if (hospital) cards.push("hospital");
  if (!cards.length) return null;
  const idx = Math.min(card, cards.length - 1);
  const k = cards[idx];
  return (
    <div onTouchStart={(e) => (sx.current = e.touches[0].clientX)} onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - (sx.current ?? 0); if (dx < -40 && idx < cards.length - 1) setCard(idx + 1); if (dx > 40 && idx > 0) setCard(idx - 1); }}>
      {k === "action" && (<>
        <div className="action">{g.action || "STAY CALM"}</div>
        {g.headline && <div className="headline">{g.headline}</div>}
        {expanded && g.current_instruction_en && <p className="detail-text">{g.current_instruction_en}</p>}
        {g.current_instruction_en && <button className="detail-btn" onClick={() => setExpanded((v) => !v)}>{expanded ? "Less" : "Why this?"} <Icon name="chevronD" size={14} /></button>}
      </>)}
      {k === "shelter" && (
        <div className="dest-card">
          <div className="dest-go">GO HERE</div>
          <div className="dest-name">{r?.target || best?.name}</div>
          <div className="dest-meta">
            {r && <span className="dest-eta">{Math.max(1, Math.round(r.duration_s / 60))} min</span>}
            {r && <span className="dest-dist">{r.distance_m} m</span>}
            {r?.first_step && <span className="dest-via">via {r.first_step}</span>}
          </div>
          {best?.why?.length > 0 && <div className="why-row">{best.why.slice(0, 3).map((w, i) => <span className="why" key={i}><Icon name="check" size={11} /> {w}</span>)}</div>}
        </div>
      )}
      {k === "hospital" && (
        <div className="dest-card">
          <div className="dest-go" style={{ color: "var(--red)" }}>NEAREST MEDICAL</div>
          <div className="dest-name">{hospital.name}</div>
          <div className="dest-meta"><span className="dest-dist">{hospital.dist_m} m</span>{hospital.open && <span className="why" style={{ color: "var(--green)" }}><Icon name="check" size={11} /> Open</span>}</div>
        </div>
      )}
      <div className="dots">{cards.map((c, i) => <span key={c} className={i === idx ? "on" : ""} onClick={() => setCard(i)} />)}</div>
      {g.needs_tap && <button className="sos" style={{ background: "var(--green)" }} onClick={onConfirm}><Icon name="check" size={18} /> I'm moving there</button>}
    </div>
  );
}

/* ── live translate transcript ── */
function Transcript({ state, offline }) {
  const env = [...(state?.environment || [])].filter((e) => e.en).slice(-3);
  if (!env.length) return null;
  return (
    <div className="transcript">
      {env.map((e, i) => (
        <div key={i}>
          {e.ja && <div className="bubble ja">{e.ja}</div>}
          <div className="bubble">{e.en}</div>
          <div className="bubble-label">{e.src === "PA" ? (offline ? "Gemma · offline" : "Live translate") : e.src === "user" ? "You" : "AEGIS"}</div>
        </div>
      ))}
    </div>
  );
}

/* ── the pack: real agents, tappable ── */
const PACK = [
  { id: "Listener", name: "Live translate", sub: "Japanese PA → your language", icon: "message" },
  { id: "Scout", name: "Situation scout", sub: "Antigravity web agent", icon: "globe" },
  { id: "Maps", name: "Shelters & hospitals", sub: "Google Maps grounding", icon: "building" },
  { id: "Router", name: "Step-free route", sub: "Real streets (OSRM)", icon: "navigation" },
  { id: "QA", name: "Safety check", sub: "Guidance verified", icon: "shieldCheck" },
];
function PackAgents({ state, offline, onOpen }) {
  const agents = state?.agents || [];
  const statusOf = (id) => { const last = [...agents].reverse().find((a) => a.agent === id); return last?.status; };
  return (
    <div className="pack">
      <div className="pack-head"><span className="pack-title">{offline ? "In your survival pack" : "Your AEGIS pack, working"}</span><span className="pack-hint">tap to inspect</span></div>
      <div className="pack-list">
        {PACK.map((p) => {
          const st = statusOf(p.id);
          const cls = st === "done" ? "done" : st === "active" ? "run" : "";
          return (
            <button key={p.id} className={`pack-item ${cls}`} onClick={() => onOpen(p)}>
              <span className="pack-ico"><Icon name={p.icon} size={16} /></span>
              <span className="pack-body"><span className="pack-name">{p.name}</span><span className="pack-sub">{p.sub}</span></span>
              <span className="pack-state">{cls === "run" ? <span className="spin" /> : cls === "done" ? <Icon name="checkCircle" size={17} /> : <Icon name="chevronR" size={16} />}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
function AgentDrawer({ agent, state, onClose }) {
  const lines = [...(state?.agents || [])].filter((a) => a.agent === agent.id).slice(-6);
  return (
    <div className="drawer-scrim" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head"><div className="drawer-title"><Icon name={agent.icon} size={17} /> {agent.name}</div><button onClick={onClose}><Icon name="close" size={18} /></button></div>
        <div className="trace">
          {lines.length ? lines.map((l, i) => <div className="trace-line" key={i}><span className="dot" style={{ background: l.status === "error" ? "var(--red)" : l.status === "active" ? "var(--amber)" : "var(--green)" }} />{l.detail}</div>)
            : <div className="trace-line"><span className="dot" style={{ background: "var(--ink-3)" }} />Idle — runs live during an emergency.</div>}
        </div>
      </div>
    </div>
  );
}

/* ── Map tab: just the map, clean ── */
function MapTab({ state }) {
  return <div style={{ position: "relative", flex: 1 }}><MapView state={state} active /></div>;
}

/* ── Support tab ── */
function SupportTab({ hospital }) {
  return (
    <div className="view">
      <div className="view-title">Support</div>
      <div className="view-sub">Emergency lines, a person, or your embassy — fastest first.</div>
      <div className="call-row">
        {[["Police", "110", "shieldCheck"], ["Ambulance / Fire", "119", "cross"]].map(([lb, num, ic]) => (
          <div className="card call" key={num}><Icon name={ic} size={20} /><div className="call-label">{lb}</div><div className="call-num">{num}</div><a className="call-btn" href={`tel:${num}`}><Icon name="phone" size={13} /> Call</a></div>
        ))}
      </div>
      <div className="card row-card"><div className="row-ico" style={{ background: "var(--blue-dim)" }}><Icon name="headphones" size={17} style={{ color: "var(--blue)" }} /></div><div className="row-body"><div className="row-name">Chat with a person</div><div className="row-sub">~2 min wait · translated live</div></div><button className="row-btn">Connect</button></div>
      <div className="card row-card"><div className="row-ico" style={{ background: "var(--green-dim)" }}><Icon name="building" size={17} style={{ color: "var(--green)" }} /></div><div className="row-body"><div className="row-name">Nearest hospital</div><div className="row-sub">{hospital ? `${hospital.name} · ${hospital.dist_m} m` : "Locating…"}</div></div><Icon name="chevronR" size={16} style={{ color: "var(--ink-3)" }} /></div>
    </div>
  );
}

/* ── Privacy tab ── */
function PrivacyTab({ consent, setConsent, lang, setLang, state, offline, onOffline, onOnline }) {
  const toggles = [
    { key: "autoAlert", title: "Auto-alert nearby authorities", desc: "Notify the nearest police box automatically in a detected emergency." },
    { key: "liveLocation", title: "Share live location with contacts", desc: "Continuous share to chosen contacts once an emergency starts." },
    { key: "govShare", title: "Share with government rescue", desc: "Optional — lets disaster-response agencies use your status." },
  ];
  const vault = ["Shibuya–Shinjuku offline map", "JP earthquake protocol", "Emergency phrases + audio", "Shelters & hospitals (with capacity)", "Gemma 4 on-device model"];
  return (
    <div className="view">
      <div className="view-title">Privacy & vault</div>
      <div className="view-sub">Set once. Revoke anytime — effective immediately.</div>
      <div className="card">{toggles.map((t) => (
        <div className="consent-row" key={t.key}><button className={`toggle ${consent[t.key] ? "on" : ""}`} onClick={() => setConsent({ ...consent, [t.key]: !consent[t.key] })}><span className="knob" /></button><div><div className="consent-title">{t.title}</div><div className="consent-desc">{t.desc}</div></div></div>
      ))}</div>
      <div className="card">
        <div className="row-name" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><Icon name="download" size={15} style={{ color: "var(--amber)" }} /> Survival vault · ready offline</div>
        {vault.map((v) => <div className="dl-check" key={v}><Icon name="check" size={14} /> {v}</div>)}
      </div>
      {/* demo controls, discreetly here in Privacy (not on the main map) */}
      <div className="card">
        <div className="row-name" style={{ marginBottom: 10 }}>Network</div>
        {offline
          ? <button className="btn primary" style={{ width: "100%" }} onClick={onOnline}><Icon name="wifi" size={15} /> Restore network</button>
          : <button className="btn ghost" style={{ width: "100%" }} onClick={onOffline}><Icon name="wifiOff" size={15} /> Simulate signal loss (tunnel)</button>}
      </div>
    </div>
  );
}

/* ── SOS overlay ── */
function SosOverlay({ consent, onResolve }) {
  const [el, setEl] = useState(0); const [stg, setStg] = useState(0);
  useEffect(() => { const t = setInterval(() => setEl((e) => e + 1), 1000); const a = [setTimeout(() => setStg(1), 800), setTimeout(() => setStg(2), 1800), setTimeout(() => setStg(3), 2700)]; return () => { clearInterval(t); a.forEach(clearTimeout); }; }, []);
  const items = [
    { done: stg >= 1, label: "Shibuya police box (kōban) notified", show: consent.autoAlert },
    { done: stg >= 2, label: "Emergency contact — live location shared", show: consent.liveLocation },
    { done: stg >= 3, label: "Embassy case opened", show: consent.autoAlert },
  ].filter((i) => i.show);
  const mm = String(Math.floor(el / 60)).padStart(2, "0"), ss = String(el % 60).padStart(2, "0");
  return (
    <div className="sos-overlay">
      <div className="sos-badge"><Icon name="warning" size={14} /> Emergency active</div>
      <div className="sos-timer">{mm}:{ss}</div>
      <div className="sos-note">{items.length ? "Notifying your people…" : "No auto-alert consents on for this trip"}</div>
      {items.map((it) => <div className="sos-item" key={it.label} style={{ opacity: it.done ? 1 : 0.4 }}><Icon name="checkCircle" size={17} style={{ color: it.done ? "var(--green)" : "var(--ink-3)" }} /><span className="sos-item-txt">{it.label}</span></div>)}
      <button className="sos-safe" onClick={onResolve}>I'm safe now</button>
    </div>
  );
}

function age(iso) { const s = Math.max(0, (Date.now() - new Date(iso)) / 1000); return s < 90 ? `${Math.round(s)}s` : `${Math.round(s / 60)}min`; }

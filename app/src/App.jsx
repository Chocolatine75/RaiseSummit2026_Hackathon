import { useEffect, useRef, useState } from "react";
import { useAegis } from "./hooks/useAegis";
import MapView from "./components/MapView";
import CameraView from "./components/CameraView";
import AgentOps from "./components/AgentOps";

export default function App() {
  const { state, offline, emit, regionPrep, session, forceOffline } = useAegis();
  const [tab, setTab] = useState("map");
  const [ask, setAsk] = useState("");
  const spokenRef = useRef("");

  const g = state?.guidance || {};
  const r = state?.route;
  const quake = state?.event?.type === "earthquake";

  // Speak new guidance aloud (once unlocked by a tap).
  const voiceRef = useRef({ unlocked: false, pending: null });
  useEffect(() => {
    const unlock = () => { voiceRef.current.unlocked = true; try { speechSynthesis.resume(); } catch {}
      if (voiceRef.current.pending) { speak(voiceRef.current.pending); voiceRef.current.pending = null; } };
    document.addEventListener("pointerdown", unlock, { once: true });
    return () => document.removeEventListener("pointerdown", unlock);
  }, []);
  useEffect(() => {
    if (g.current_instruction_en && g.current_instruction_en !== spokenRef.current && !offline) {
      spokenRef.current = g.current_instruction_en; speak(g.current_instruction_en);
    }
  }, [g.current_instruction_en, offline]);
  function speak(t) {
    if (!("speechSynthesis" in window)) return;
    if (!voiceRef.current.unlocked) { voiceRef.current.pending = t; return; }
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = "en-US"; u.rate = 1.02; speechSynthesis.speak(u); } catch {}
  }

  const submitAsk = () => { const t = ask.trim(); if (!t) return; setAsk(""); emit("user_utterance", { text: t }); };
  const statusText = offline ? "Offline · on-device" : quake ? "Guiding you" : "Monitoring";

  return (
    <div className={`app ${offline ? "offline" : ""}`}>
      <MapView state={state} active={tab === "map"} />
      <CameraView state={state} session={session} active={tab === "cam"} />

      {/* status pill */}
      <div className={`statusPill ${offline ? "offline" : "online"}`}>
        <span className="brand">AEGIS</span>
        <span className="dot" />
        <span>{statusText}</span>
        <button className="proofBtn" onClick={() => document.querySelector(".proof")?.toggleAttribute("open")}>ⓘ</button>
      </div>

      {/* region-prep toast */}
      {regionPrep && (
        <div className="toast">
          {!regionPrep.done && <div className="tspin" />}
          {regionPrep.done && <div className="tdone">✓</div>}
          <div className="tbody"><b>{regionPrep.title}</b><span>{regionPrep.sub}</span></div>
        </div>
      )}

      {/* route banner */}
      {r?.coords?.length > 0 && (
        <div className="routeBanner">
          <div className="rb-icon">🧭</div>
          <div className="rb-body">
            <div className="rb-eta"><b>{Math.max(1, Math.round(r.duration_s / 60))} min</b> <span>· {r.distance_m} m</span></div>
            <div className="rb-to">to {r.target}</div>
          </div>
          {r.first_step && <div className="rb-step">via {r.first_step}</div>}
        </div>
      )}

      {/* bottom sheet */}
      <div className="sheet">
        <div className="grip" />
        <p className="instruction">{g.current_instruction_en || "You're set up. I'm watching the area for alerts."}</p>
        {state?.live_delta?.as_of && <div className="freshness">Live · updated {age(state.live_delta.as_of)} ago</div>}
        <div className="qRow">
          <p className="question">{g.next_question || ""}</p>
          {g.needs_tap && <button className="confirmBtn" onClick={() => emit("user_tap")}>Confirm</button>}
        </div>
        <div className="askRow">
          <input value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitAsk()} placeholder="Ask AEGIS anything…" />
          <button className="micBtn" onClick={submitAsk}>🎤</button>
        </div>
        <AgentOps state={state} offline={offline} />
        <div className="demoRow">
          <button onClick={() => emit("quake", { magnitude: "5+" })}>▶ Run scenario</button>
          <button onClick={() => fetch(`/api/reset?session=${session}`, { method: "POST" })}>↺ Reset</button>
          <button onClick={forceOffline}>✈ Go offline</button>
        </div>
      </div>

      {/* tab bar */}
      <nav className="tabbar">
        <button className={`tab ${tab === "map" ? "active" : ""}`} onClick={() => setTab("map")}><span className="ti">🗺</span><span>Map</span></button>
        <button className={`tab ${tab === "cam" ? "active" : ""}`} onClick={() => setTab("cam")}><span className="ti">📷</span><span>Camera</span></button>
      </nav>
    </div>
  );
}
function age(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
  return s < 90 ? `${Math.round(s)}s` : `${Math.round(s / 60)}min`;
}

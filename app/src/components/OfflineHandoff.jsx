import { useEffect, useState } from "react";
import Icon from "./Icon";

// The signature moment: the network dies mid-crisis and the agent's whole
// situation state survives on the edge. We don't fake a loader — we narrate
// what is actually true: the last state was already serialized to the device,
// and on-device Gemma takes over. Three beats, ~2.6s, then it dissolves into
// the amber on-device mode. Fires once per offline transition.
const BEATS = [
  { k: "lost", label: "Network lost", sub: "Cellular signal dropped", ms: 900 },
  { k: "restore", label: "Restoring from on-device memory", sub: "Route, shelter, and situation state recovered", ms: 1100 },
  { k: "ready", label: "On-device assistant active", sub: "Gemma 4 is now guiding you offline", ms: 900 },
];

export default function OfflineHandoff({ state, onDone }) {
  const [i, setI] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const shelter = state?.route?.target || state?.live_delta?.shelters?.[0]?.name;
  const dist = state?.route?.distance_m;

  useEffect(() => {
    if (i >= BEATS.length) {
      setLeaving(true);
      const t = setTimeout(onDone, 420);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setI((n) => n + 1), BEATS[i].ms);
    return () => clearTimeout(t);
  }, [i, onDone]);

  const beat = BEATS[Math.min(i, BEATS.length - 1)];
  const done = i >= 2;

  return (
    <div className={`handoff ${leaving ? "leaving" : ""}`} role="status" aria-live="assertive">
      <div className="handoff-sweep" />
      <div className="handoff-core">
        <div className={`handoff-glyph ${done ? "ok" : ""}`}>
          {done ? <Icon name="shield" size={30} /> : <Icon name="wifiOff" size={30} />}
        </div>
        <div className="handoff-beat" key={beat.k}>
          <div className="handoff-label">{beat.label}</div>
          <div className="handoff-sub">{beat.sub}</div>
        </div>

        {/* the proof: state that survived the disconnect stays pinned on screen */}
        {shelter && (
          <div className="handoff-state">
            <span className="hs-dot" />
            Still routing to <b>{shelter}</b>{dist ? ` · ${dist} m` : ""}
          </div>
        )}

        <div className="handoff-steps">
          {BEATS.map((b, n) => <span key={b.k} className={n <= i ? "on" : ""} />)}
        </div>
      </div>
    </div>
  );
}

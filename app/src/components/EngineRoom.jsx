import { useEffect, useMemo, useRef, useState } from "react";

// THE ENGINE ROOM — the backend made visible as a living nervous system.
// Six real agents are nodes wired to a central Keeper. When an agent actually
// fires on the server (state.agents grows), its node ignites and a pulse of
// data travels down the wire from the Keeper. This is NOT decorative: every
// light maps 1:1 to a real server-side action logged by the Keeper.
//
// Layout: Keeper in the middle, the pipeline fanned around it in execution
// order so a narrator can point and say "translate → scout → ground → route →
// verify". A seismograph trace runs under it as the live heartbeat.

const NODES = {
  Keeper:   { x: 50, y: 50, r: 7,   label: "Keeper",   sub: "orchestrator" },
  Listener: { x: 20, y: 22, r: 5.5, label: "Listener", sub: "live translate" },
  Scout:    { x: 80, y: 22, r: 5.5, label: "Scout",    sub: "antigravity" },
  Maps:     { x: 88, y: 60, r: 5.5, label: "Maps",     sub: "grounding" },
  Router:   { x: 62, y: 84, r: 5.5, label: "Router",   sub: "osrm streets" },
  QA:       { x: 30, y: 82, r: 5.5, label: "QA",       sub: "safety audit" },
};
const ORDER = ["Listener", "Scout", "Maps", "Router", "QA"];

export default function EngineRoom({ state, offline }) {
  const agents = state?.agents || [];
  const [flash, setFlash] = useState({}); // agent -> timestamp of last ignite
  const [pulses, setPulses] = useState([]); // active travelling pulses
  const seenRef = useRef(0);

  // Detect newly-arrived real agent events and ignite the matching node.
  useEffect(() => {
    if (agents.length <= seenRef.current) { seenRef.current = agents.length; return; }
    const fresh = agents.slice(seenRef.current);
    seenRef.current = agents.length;
    fresh.forEach((a, i) => {
      const name = NODES[a.agent] ? a.agent : "Keeper";
      setTimeout(() => {
        setFlash((f) => ({ ...f, [name]: Date.now(), _status: { ...f._status, [name]: a.status } }));
        if (name !== "Keeper") {
          const id = Date.now() + Math.random();
          setPulses((p) => [...p, { id, to: name, status: a.status }]);
          setTimeout(() => setPulses((p) => p.filter((x) => x.id !== id)), 900);
        }
      }, i * 120);
    });
  }, [agents.length]);

  const status = (name) => flash._status?.[name];
  const lit = (name) => flash[name] && Date.now() - flash[name] < 2600;

  // current headline: the latest real agent detail, for the narrator strip
  const latest = agents[agents.length - 1];
  const activeCount = useMemo(() => ORDER.filter((n) => lit(n)).length, [flash]);

  return (
    <div className={`engine ${offline ? "off" : ""}`}>
      <div className="engine-top">
        <div>
          <div className="engine-kicker">System backplane</div>
          <div className="engine-title">{offline ? "Running on-device" : "Agents live"}</div>
        </div>
        <div className="engine-mode">
          <span className={`emode-dot ${offline ? "amber" : "live"}`} />
          {offline ? "Edge · Gemma 4" : `${activeCount || 0} active · cloud`}
        </div>
      </div>

      <svg className="engine-graph" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--go)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--go)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* wires */}
        {ORDER.map((n) => {
          const a = NODES.Keeper, b = NODES[n];
          return <line key={"w" + n} className={`wire ${lit(n) ? "on" : ""}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}

        {/* ambient heartbeat: a faint particle always drifting on every wire so
            the system NEVER looks frozen — even at rest it reads as alive */}
        {ORDER.map((n, k) => {
          const a = NODES.Keeper, b = NODES[n];
          return (
            <circle key={"amb" + n} className="ambient" r="0.7" fill="currentColor">
              <animate attributeName="cx" values={`${a.x};${b.x};${a.x}`} dur={`${3.2 + k * 0.4}s`} repeatCount="indefinite" />
              <animate attributeName="cy" values={`${a.y};${b.y};${a.y}`} dur={`${3.2 + k * 0.4}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.6;0" dur={`${3.2 + k * 0.4}s`} repeatCount="indefinite" />
            </circle>
          );
        })}

        {/* travelling pulses (data flowing Keeper → agent) */}
        {pulses.map((p) => {
          const a = NODES.Keeper, b = NODES[p.to];
          return (
            <circle key={p.id} className={`pulse ${p.status}`} r="1.5" fill="currentColor">
              <animate attributeName="cx" from={a.x} to={b.x} dur="0.8s" fill="freeze" />
              <animate attributeName="cy" from={a.y} to={b.y} dur="0.8s" fill="freeze" />
              <animate attributeName="opacity" from="1" to="0" dur="0.8s" fill="freeze" />
            </circle>
          );
        })}

        {/* core glow */}
        <circle cx={NODES.Keeper.x} cy={NODES.Keeper.y} r="18" fill="url(#coreGlow)" className={lit("Keeper") ? "breathe" : ""} />

        {/* nodes */}
        {Object.entries(NODES).map(([name, n]) => (
          <g key={name} className={`node ${lit(name) ? "lit" : ""} ${status(name) || ""}`}>
            <circle className="node-ring" cx={n.x} cy={n.y} r={n.r + 2.5} />
            <circle className="node-core" cx={n.x} cy={n.y} r={n.r} />
          </g>
        ))}
      </svg>

      {/* node legend row */}
      <div className="engine-legend">
        {Object.entries(NODES).filter(([k]) => k !== "Keeper").map(([name, n]) => (
          <div key={name} className={`leg ${lit(name) ? "lit" : ""} ${status(name) || ""}`}>
            <span className="leg-dot" />
            <span className="leg-name">{name}</span>
            <span className="leg-sub">{n.sub}</span>
          </div>
        ))}
      </div>

      {/* live metrics — real numbers from the Situation Object, always current */}
      <div className="engine-metrics">
        <Metric label="Shelters" value={state?.live_delta?.shelters?.length || 0} on={!!state?.live_delta?.shelters?.length} />
        <Metric label="Hospitals" value={state?.live_delta?.hospitals?.length || 0} on={!!state?.live_delta?.hospitals?.length} />
        <Metric label="Route" value={state?.route?.distance_m ? `${state.route.distance_m} m` : "—"} on={!!state?.route} />
        <Metric label="Latency" value={state?.timing?.last_reason_ms ? `${(state.timing.last_reason_ms / 1000).toFixed(1)} s` : "—"} on={!!state?.timing?.last_reason_ms} />
        <Metric label="Antigravity" value={state?.scout_environment_id ? shortId(state.scout_environment_id) : "—"} on={!!state?.scout_environment_id} mono />
        <Metric label="Safety QA" value={state?.audit?.status && state.audit.status !== "idle" ? state.audit.status.toUpperCase() : "—"} on={state?.audit?.status === "pass"} />
      </div>

      {/* narrator strip: the single latest real thing an agent did */}
      <div className="engine-ticker">
        {latest ? (
          <>
            <span className={`tick-agent ${latest.status}`}>{latest.agent}</span>
            <span className="tick-detail">{latest.detail}</span>
          </>
        ) : (
          <span className="tick-detail idle">Standing by — monitoring for seismic alerts.</span>
        )}
      </div>
    </div>
  );
}

function shortId(id) { return id ? `${String(id).slice(0, 8)}…` : "—"; }
function Metric({ label, value, on, mono }) {
  return (
    <div className={`emetric ${on ? "on" : ""}`}>
      <div className="em-label">{label}</div>
      <div className={`em-value ${mono ? "mono" : ""}`}>{value}</div>
    </div>
  );
}

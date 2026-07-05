// The "control room": live agent operations + system status. This is the
// backend made visible — every server-side agent action, streamed in real time.
export default function AgentOps({ state, offline }) {
  const short = (id) => (id ? `${String(id).slice(0, 10)}…` : "—");
  const loc = state?.user?.location;
  const audit = state?.audit;
  const agents = [...(state?.agents || [])].reverse().slice(0, 8);

  const cell = (label, value, ok) => (
    <div className="pcell">
      <span>{label}</span>
      <b className={ok === true ? "ok" : ok === false ? "warn" : ""}>{value}</b>
    </div>
  );

  return (
    <div className="proof">
      <div className="proof-title">System status · agent operations</div>

      <div className="proof-grid">
        {cell("Reasoning", offline ? "Gemma 4 E2B" : "Gemini 3.5 Flash")}
        {cell("Latency", state?.timing?.last_reason_ms ? `${(state.timing.last_reason_ms / 1000).toFixed(1)}s` : "—")}
        {cell("State chain", short(state?.interaction_chain_id), !!state?.interaction_chain_id)}
        {cell("Antigravity", short(state?.scout_environment_id), !!state?.scout_environment_id)}
        {cell("QA check", audit && audit.status !== "idle" ? audit.status.toUpperCase() : "—", audit?.status === "pass")}
        {cell("Position", loc?.source === "device_gps" ? `GPS ±${loc.accuracy_m ?? "?"}m` : "default", loc?.source === "device_gps")}
      </div>

      <div className="ops-head">Live agent operations</div>
      <div className="ops">
        {agents.length === 0 && <div className="op"><span className="detail">Idle — run the scenario to see agents work.</span></div>}
        {agents.map((a, i) => (
          <div key={i} className={`op ${a.status}`}>
            <span className={`agent ${a.agent}`}>{a.agent}</span>
            <span className="detail">{a.detail}</span>
            <span className="st" />
          </div>
        ))}
      </div>

      <div className="ops-head">Situation feed</div>
      <div className="feed">
        {[...(state?.environment || [])].reverse().slice(0, 10).map((e, i) => (
          <div className="evt" key={i}>
            <span className="src">{e.src}</span>{e.en}
            {e.ja && <div className="ja">{e.ja}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

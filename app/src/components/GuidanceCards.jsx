import { useState, useRef } from "react";
import Icon from "./Icon";

// Panic-mode guidance. A scared person cannot read a paragraph, so guidance is
// broken into swipeable cards — ONE thing per card, big. Card 1 is the immediate
// action; card 2 is the shelter decision with why; card 3 is the nearest hospital.
// The full sentence lives behind a "details" tap so it never crowds the screen.
export default function GuidanceCards({ state, offline, onConfirm, onAsk }) {
  const g = state?.guidance || {};
  const r = state?.route;
  const best = state?.live_delta?.shelters?.[0];
  const hospital = (state?.live_delta?.hospitals || [])[0];
  const [i, setI] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const startX = useRef(null);

  // Build the card set from whatever real data exists right now.
  const cards = [];
  if (g.action || g.headline || g.current_instruction_en) {
    cards.push({ kind: "action", key: "a" });
  }
  if (r?.coords?.length || best) {
    cards.push({ kind: "shelter", key: "s" });
  }
  if (hospital) cards.push({ kind: "hospital", key: "h" });
  if (cards.length === 0) return null;

  const idx = Math.min(i, cards.length - 1);
  const card = cards[idx];

  const onTouchStart = (e) => { startX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (startX.current == null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (dx < -40 && idx < cards.length - 1) setI(idx + 1);
    if (dx > 40 && idx > 0) setI(idx - 1);
    startX.current = null;
  };

  return (
    <div className="gcards" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="gcard-viewport">
        {card.kind === "action" && (
          <div className="gcard action">
            <div className="gc-action">{g.action || "STAY CALM"}</div>
            {g.headline && <div className="gc-headline">{g.headline}</div>}
            {expanded && g.current_instruction_en && (
              <p className="gc-detail">{g.current_instruction_en}</p>
            )}
            {g.current_instruction_en && (
              <button className="gc-more" onClick={() => setExpanded((v) => !v)}>
                {expanded ? "Less" : "Why?"}
              </button>
            )}
          </div>
        )}

        {card.kind === "shelter" && (
          <div className="gcard shelter">
            <div className="gc-go">GO</div>
            <div className="gc-dest">{r?.target || best?.name}</div>
            <div className="gc-meta">
              {r && <span className="gc-eta">{Math.max(1, Math.round(r.duration_s / 60))} min</span>}
              {r && <span className="gc-dist">{r.distance_m} m</span>}
              {r?.first_step && <span className="gc-via">via {r.first_step}</span>}
            </div>
            {best?.why?.length > 0 && (
              <div className="gc-why">
                {best.why.slice(0, 3).map((w, k) => (
                  <span className="gc-chip" key={k}><Icon name="check" size={11} /> {w}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {card.kind === "hospital" && (
          <div className="gcard hospital">
            <div className="gc-tag">Nearest medical</div>
            <div className="gc-dest">{hospital.name}</div>
            <div className="gc-meta">
              {hospital.dist_m != null && <span className="gc-dist">{hospital.dist_m} m</span>}
              {hospital.open != null && <span className="gc-open">{hospital.open ? "Open" : "Status unknown"}</span>}
            </div>
          </div>
        )}
      </div>

      <div className="gc-footer">
        <div className="gc-dots">
          {cards.map((c, k) => <span key={c.key} className={k === idx ? "on" : ""} onClick={() => setI(k)} />)}
        </div>
        {g.needs_tap && <button className="gc-confirm" onClick={onConfirm}>I'm on my way</button>}
      </div>
    </div>
  );
}

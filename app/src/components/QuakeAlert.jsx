import { useEffect, useState } from "react";
import Icon from "./Icon";

// The government push notification beat. In a real Tokyo quake, the JMA
// Earthquake Early Warning (緊急地震速報) fires on every phone — in Japanese.
// A foreign traveler sees a wall of characters they can't read. AEGIS's whole
// reason to exist starts here: tap the alert, and it's translated instantly.
//
// The JA text is the real EEW wording; the translation is produced by the
// Keeper's Listener agent (state.environment PA lines), so it's a real result.
const JA_HEADLINE = "緊急地震速報";
const JA_BODY = "強い揺れに警戒してください。落ち着いて身の安全を確保してください。";

export default function QuakeAlert({ state, onOpen }) {
  const [translated, setTranslated] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // pull the real translated PA line once the Listener has produced one
  const paLine = (state?.environment || []).find((e) => e.src === "PA" && e.en);

  useEffect(() => {
    if (translated && paLine) {
      const t = setTimeout(() => { setDismissed(true); onOpen?.(); }, 2400);
      return () => clearTimeout(t);
    }
  }, [translated, paLine, onOpen]);

  if (dismissed) return null;

  return (
    <div className="qalert-wrap">
      <div className={`qalert ${translated ? "translated" : ""}`} onClick={() => setTranslated(true)} role="button">
        <div className="qalert-head">
          <span className="qalert-src"><Icon name="warning" size={13} /> {translated ? "Japan Meteorological Agency" : "気象庁"}</span>
          <span className="qalert-now">now</span>
        </div>
        {!translated ? (
          <>
            <div className="qalert-title ja">{JA_HEADLINE}</div>
            <div className="qalert-body ja">{JA_BODY}</div>
            <div className="qalert-cta"><Icon name="chat" size={13} /> Tap to translate with AEGIS</div>
          </>
        ) : (
          <>
            <div className="qalert-title">Earthquake Early Warning</div>
            <div className="qalert-body">
              {paLine?.en || "Strong shaking expected. Stay calm and protect yourself."}
            </div>
            <div className="qalert-orig ja">{JA_HEADLINE} · {JA_BODY}</div>
          </>
        )}
      </div>
    </div>
  );
}

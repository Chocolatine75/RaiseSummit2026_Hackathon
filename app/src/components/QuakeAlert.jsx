import { useEffect, useState } from "react";
import Icon from "./Icon";

// The government push beat. JMA Earthquake Early Warning (緊急地震速報) fires on
// every phone in Japanese. Tap to translate — the real Listener PA translation.
const JA_HEADLINE = "緊急地震速報";
const JA_BODY = "強い揺れに警戒してください。落ち着いて身の安全を確保してください。";

export default function QuakeAlert({ state, onOpen }) {
  const [translated, setTranslated] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const paLine = (state?.environment || []).find((e) => e.src === "PA" && e.en);

  useEffect(() => {
    if (translated) { const t = setTimeout(() => { setDismissed(true); onOpen?.(); }, 2400); return () => clearTimeout(t); }
  }, [translated, onOpen]);

  // Auto-clear even if the user never taps, so the push never sits over the
  // guidance/transcript. 6s: enough to read + tap, gone before it blocks content.
  useEffect(() => {
    const t = setTimeout(() => { setDismissed(true); onOpen?.(); }, 6000);
    return () => clearTimeout(t);
  }, [onOpen]);

  if (dismissed) return null;
  return (
    <div className="push-wrap">
      <div className={`push ${translated ? "translated" : ""}`} onClick={() => setTranslated(true)} role="button">
        <div className="push-head">
          <span className="push-src"><Icon name="warning" size={13} /> {translated ? "Japan Meteorological Agency" : "気象庁"}</span>
          <span className="push-now">now</span>
        </div>
        {!translated ? (<>
          <div className="push-title" style={{ fontFamily: "'Hiragino Sans','Yu Gothic',sans-serif" }}>{JA_HEADLINE}</div>
          <div className="push-body" style={{ fontFamily: "'Hiragino Sans','Yu Gothic',sans-serif" }}>{JA_BODY}</div>
          <div className="push-cta"><Icon name="message" size={13} /> Tap to translate with AEGIS</div>
        </>) : (<>
          <div className="push-title">Earthquake Early Warning</div>
          <div className="push-body">{paLine?.en || "Strong shaking expected. Stay calm and protect yourself."}</div>
          <div className="push-orig">{JA_HEADLINE} · {JA_BODY}</div>
        </>)}
      </div>
    </div>
  );
}

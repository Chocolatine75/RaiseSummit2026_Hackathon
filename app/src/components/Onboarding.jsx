import { useEffect, useState } from "react";
import Icon from "./Icon";

const LANGS = [
  { code: "en", label: "English" }, { code: "ja", label: "日本語" }, { code: "zh", label: "中文" },
  { code: "ko", label: "한국어" }, { code: "es", label: "Español" }, { code: "fr", label: "Français" },
];

// The journey: language → trip → consent → download. Mirrors the reference
// product flow. The download beat is the "we prepare Tokyo on-device" moment.
export default function Onboarding({ lang, setLang, consent, setConsent, onDone }) {
  const [step, setStep] = useState(0);
  const [prog, setProg] = useState(0);
  useEffect(() => {
    if (step !== 3) return;
    setProg(0);
    const id = setInterval(() => setProg((p) => Math.min(100, p + 4)), 80);
    return () => clearInterval(id);
  }, [step]);

  const consents = [
    { key: "autoAlert", title: "Auto-alert nearby authorities", desc: "If AEGIS detects an emergency, notify the nearest police box automatically — no tap needed in the moment." },
    { key: "liveLocation", title: "Share live location with contacts", desc: "Starts a continuous share with your emergency contacts, only when an emergency is triggered." },
    { key: "govShare", title: "Share with government rescue", desc: "Optional — lets disaster-response agencies use your location for coordinated rescue." },
  ];

  return (
    <div className="onb">
      <div className="onb-steps">{[0, 1, 2, 3].map((i) => <span key={i} className={i <= step ? "on" : ""} />)}</div>
      <div className="onb-brand"><Icon name="shield" size={18} /> AEGIS</div>

      <div className="onb-body">
        {step === 0 && (<>
          <div className="onb-title">Choose your language</div>
          <div className="onb-sub">AEGIS will translate every alert and speak to you in this language.</div>
          <div className="lang-grid">{LANGS.map((l) => <button key={l.code} className={`lang-opt ${lang === l.code ? "on" : ""}`} onClick={() => setLang(l.code)}>{l.label}</button>)}</div>
        </>)}

        {step === 1 && (<>
          <div className="onb-title">Your trip</div>
          <div className="onb-sub">AEGIS prepares everything for this destination, so it works even underground.</div>
          <div className="trip-card">
            <div className="trip-city"><Icon name="pin" size={17} /> Tokyo, Japan</div>
            <div className="trip-when">Jul 14 – Jul 21, 2026 · Shibuya · Shinjuku</div>
          </div>
        </>)}

        {step === 2 && (<>
          <div className="onb-title">Set your safety defaults</div>
          <div className="onb-sub">Decide these once, now — so nothing needs a decision from you mid-emergency. Change anytime in Privacy.</div>
          {consents.map((c) => (
            <div className="consent-row" key={c.key}>
              <button className={`toggle ${consent[c.key] ? "on" : ""}`} onClick={() => setConsent({ ...consent, [c.key]: !consent[c.key] })}><span className="knob" /></button>
              <div><div className="consent-title">{c.title}</div><div className="consent-desc">{c.desc}</div></div>
            </div>
          ))}
        </>)}

        {step === 3 && (<>
          <div className="onb-title">Preparing Tokyo, on-device</div>
          <div className="onb-sub">Offline maps, shelters, hospitals, phrases and the Gemma 4 model — so AEGIS keeps working with no signal.</div>
          <div className="trip-card">
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}><span>{prog < 100 ? "Downloading…" : "Ready for offline use"}</span><span style={{ color: "var(--amber)" }}>{prog}%</span></div>
            <div className="progress"><div style={{ width: `${prog}%` }} /></div>
            <div className="dl-line"><Icon name="download" size={13} /> Gemma 4 · offline map · shelters · hospitals · phrases</div>
          </div>
        </>)}
      </div>

      <div className="onb-nav">
        {step > 0 && <button className="btn ghost" onClick={() => setStep(step - 1)}>Back</button>}
        <button className="btn primary" disabled={step === 3 && prog < 100} onClick={() => (step < 3 ? setStep(step + 1) : onDone())}>
          {step < 3 ? "Continue" : "Enter Tokyo"}
        </button>
      </div>
    </div>
  );
}

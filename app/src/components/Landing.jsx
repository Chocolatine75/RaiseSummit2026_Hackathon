import Icon from "./Icon";

// The product's first impression. Branded hero → Get started → onboarding.
// Calm, confident, Tokyo-specific. Not a generic splash.
export default function Landing({ onStart }) {
  return (
    <div className="landing">
      <div className="landing-sky" aria-hidden="true">
        {/* concentric seismic rings — the "early-warning" signature, calm not alarming */}
        <span className="ring r1" /><span className="ring r2" /><span className="ring r3" />
      </div>

      <div className="landing-top">
        <div className="landing-logo"><Icon name="shield" size={22} /></div>
        <span className="landing-word">AEGIS</span>
      </div>

      <div className="landing-hero">
        <h1 className="landing-h1">Calm in Tokyo's<br />next earthquake.</h1>
        <p className="landing-sub">
          The moment the ground moves, AEGIS translates the warning, finds you a
          real shelter, and keeps guiding you — even with no signal.
        </p>
      </div>

      <div className="landing-facts">
        <div className="lf"><span className="lf-ico" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}><Icon name="message" size={16} /></span><div><div className="lf-t">Understand</div><div className="lf-s">Japanese alerts, your language</div></div></div>
        <div className="lf"><span className="lf-ico" style={{ background: "var(--green-dim)", color: "var(--green)" }}><Icon name="navigation" size={16} /></span><div><div className="lf-t">Get out</div><div className="lf-s">Step-free route to a real shelter</div></div></div>
        <div className="lf"><span className="lf-ico" style={{ background: "var(--amber-dim)", color: "var(--amber)" }}><Icon name="wifiOff" size={16} /></span><div><div className="lf-t">Stay guided</div><div className="lf-s">Keeps working fully offline</div></div></div>
      </div>

      <button className="landing-cta" onClick={onStart}>
        Get started <Icon name="chevronR" size={18} />
      </button>
      <div className="landing-foot">For visitors in Tokyo · Free · No account</div>
    </div>
  );
}

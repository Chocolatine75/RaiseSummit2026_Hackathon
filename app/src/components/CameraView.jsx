import { useEffect, useRef, useState } from "react";
import { distM } from "../hooks/useAegis";

// Live camera + AR arrow that points at the shelter using the real compass.
export default function CameraView({ state, session, active }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [compass, setCompass] = useState(null);
  const [scan, setScan] = useState("Scan a sign");
  const loc = state?.user?.location;
  const route = state?.route;

  useEffect(() => {
    if (!active) { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; return; }
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch {}
    })();
    const handler = (e) => {
      const d = e.webkitCompassHeading ?? (e.alpha != null ? 360 - e.alpha : null);
      if (d != null) setCompass(d);
    };
    if (typeof DeviceOrientationEvent?.requestPermission === "function")
      DeviceOrientationEvent.requestPermission().then((p) => { if (p === "granted") window.addEventListener("deviceorientation", handler, true); }).catch(() => {});
    else window.addEventListener("deviceorientationabsolute", handler, true);
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); window.removeEventListener("deviceorientation", handler, true); };
  }, [active]);

  const scanSign = async () => {
    const v = videoRef.current;
    if (!v?.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    const b64 = c.toDataURL("image/jpeg", 0.8).split(",")[1];
    setScan("Reading…");
    const res = await fetch(`/api/eyes?session=${session}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_b64: b64, mime_type: "image/jpeg" }),
    }).catch(() => null);
    setScan(res?.ok ? "Sign read ✓" : "Try closer");
    setTimeout(() => setScan("Scan a sign"), 2000);
  };

  // AR arrow angle
  let rel = null, label = null;
  if (route?.coords?.length && compass != null && loc) {
    const tgt = route.coords[route.coords.length - 1];
    const brg = bearing({ lat: loc.lat, lng: loc.lng }, { lat: tgt[0], lng: tgt[1] });
    rel = ((brg - compass) % 360 + 360) % 360;
    const dist = Math.round(distM({ lat: loc.lat, lng: loc.lng }, { lat: tgt[0], lng: tgt[1] }));
    const dir = rel < 30 || rel > 330 ? "straight ahead" : rel < 180 ? "to your right" : "to your left";
    label = `${route.target} · ${dist}m · ${dir}`;
  }

  return (
    <div id="camView" className={`view ${active ? "active" : ""}`}>
      <video ref={videoRef} autoPlay playsInline muted />
      {rel != null && (
        <div id="arOverlay">
          <div id="arArrow" style={{ transform: `rotate(${rel}deg)` }}>↑</div>
          <div id="arLabel">{label}</div>
        </div>
      )}
      <button id="scanBtn" onClick={scanSign}>{scan}</button>
    </div>
  );
}
function bearing(a, b) {
  const y = Math.sin(((b.lng - a.lng) * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180);
  const x = Math.cos((a.lat * Math.PI) / 180) * Math.sin((b.lat * Math.PI) / 180) -
    Math.sin((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.cos(((b.lng - a.lng) * Math.PI) / 180);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

import { useEffect, useRef, useState } from "react";
import { distM } from "../hooks/useAegis";

// Live camera + AR arrow that points at the shelter using the real compass.
export default function CameraView({ state, session, active }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [compass, setCompass] = useState(null);
  const [scan, setScan] = useState("Scan a sign");
  const [hasCamera, setHasCamera] = useState(false);
  const loc = state?.user?.location;
  const route = state?.route;

  useEffect(() => {
    if (!active) { 
      streamRef.current?.getTracks().forEach((t) => t.stop()); 
      streamRef.current = null; 
      setHasCamera(false);
      return; 
    }
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
        setHasCamera(true);
      } catch {
        setHasCamera(false);
      }
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
    let b64 = null;
    const v = videoRef.current;

    if (hasCamera && v?.videoWidth) {
      const c = document.createElement("canvas");
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext("2d").drawImage(v, 0, 0);
      b64 = c.toDataURL("image/jpeg", 0.8).split(",")[1];
    } else {
      // Dynamic rendering of Japanese closed exit signboard for demoing on desktop/without camera
      const c = document.createElement("canvas");
      c.width = 640; c.height = 480;
      const ctx = c.getContext("2d");
      
      // Caution white-yellow board
      ctx.fillStyle = "#fffbef";
      ctx.fillRect(0, 0, 640, 480);
      
      // Outer warning border
      ctx.strokeStyle = "#ff4d5e";
      ctx.lineWidth = 14;
      ctx.strokeRect(20, 20, 600, 440);
      
      // Warning stripes top & bottom
      ctx.fillStyle = "#ff4d5e";
      ctx.fillRect(27, 27, 586, 30);
      ctx.fillRect(27, 423, 586, 30);
      
      // Header text
      ctx.font = "bold 28px sans-serif";
      ctx.fillStyle = "#ff4d5e";
      ctx.textAlign = "center";
      ctx.fillText("⚠️ CLOSED / 閉鎖中", 320, 120);
      
      // Main Japanese Text
      ctx.font = "bold 65px sans-serif";
      ctx.fillStyle = "#05070a";
      ctx.fillText("この出口閉鎖", 320, 245);
      
      // Subtitle English Text
      ctx.font = "bold 30px sans-serif";
      ctx.fillStyle = "#63707f";
      ctx.fillText("This exit is closed", 320, 315);
      
      // Station label
      ctx.font = "600 16px sans-serif";
      ctx.fillStyle = "#aeb9c7";
      ctx.fillText("SHINJUKU STATION EAST EXIT / 新宿駅 東口", 320, 390);
      
      b64 = c.toDataURL("image/jpeg", 0.8).split(",")[1];
    }

    setScan("Reading…");
    const res = await fetch(`/api/eyes?session=${session}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_b64: b64, mime_type: "image/jpeg" }),
    }).catch(() => null);
    setScan(res?.ok ? "Sign read" : "Try closer");
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
      {hasCamera ? (
        <video id="camStream" ref={videoRef} autoPlay playsInline muted />
      ) : (
        <div className="simulated-cam">
          <div className="signboard-mock">
            <div className="signboard-header">WARNING</div>
            <div className="signboard-body">
              <div className="signboard-ja">この出口閉鎖</div>
              <div className="signboard-en">This exit is closed</div>
            </div>
            <div className="signboard-footer">SHINJUKU EAST EXIT / 新宿駅 東口</div>
          </div>
        </div>
      )}
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

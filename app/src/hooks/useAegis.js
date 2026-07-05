import { useEffect, useRef, useState, useCallback } from "react";

// Single source of truth for the whole app: connects to the Keeper over
// WebSocket, mirrors the Situation Object, drives real GPS + region entry,
// caches state for the offline handoff, and exposes emit().
const SESSION = new URLSearchParams(location.search).get("session") || "demo";
const CACHE_KEY = `aegis_state_${SESSION}`;

export function useAegis() {
  const [state, setState] = useState(() => {
    // Restore cached state for offline resilience, but start every fresh page
    // load with a CLEAN conversation — no stale chat survives a reload. We wipe
    // it from localStorage too, so nothing (offline restore included) revives it.
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      s.environment = [];
      localStorage.setItem(CACHE_KEY, JSON.stringify(s));
      return s;
    } catch { return null; }
  });
  const [offline, setOffline] = useState(false);
  const wsRef = useRef(null);
  const packedRef = useRef(false);
  const forcedRef = useRef(false); // demo "Go offline" pins us offline (no reconnect)
  const [regionPrep, setRegionPrep] = useState(null); // {title, sub, done}

  const emit = useCallback((type, payload = {}) => {
    const ev = { type, payload, src: "client", t: new Date().toISOString() };
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(ev));
    else fetch(`/event?session=${SESSION}`, { method: "POST", body: JSON.stringify(ev) }).catch(() => {});
  }, []);

  // WebSocket connection with auto-reconnect. connect() is stored in a ref so
  // goOnline() can re-establish the socket after a demo "Cut the network".
  const connectRef = useRef(null);
  const aliveRef = useRef(true);
  const chatClearedRef = useRef(false);
  const chatSettledRef = useRef(false);
  useEffect(() => {
    aliveRef.current = true;
    // Fresh page load → clear any stale conversation on the backend BEFORE the
    // socket streams state, so no old chat is ever rendered. Fire-and-forget.
    if (!chatClearedRef.current) {
      chatClearedRef.current = true;
      fetch(`/event?session=${SESSION}`, { method: "POST", body: JSON.stringify({ type: "clear_chat", payload: {}, src: "client", t: new Date().toISOString() }) })
        .finally(() => { chatSettledRef.current = true; });
      // safety: settle after 2s even if the request stalls
      setTimeout(() => { chatSettledRef.current = true; }, 2000);
    }
    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/ws?session=${SESSION}`);
      wsRef.current = ws;
      ws.onmessage = (m) => {
        if (forcedRef.current) return; // pinned offline for the demo
        const s = JSON.parse(m.data);
        s.network = { ...s.network, last_serialized_to_device: new Date().toISOString() };
        // Until the on-load clear_chat has round-tripped, suppress any stale
        // conversation so a reload never briefly shows old chat.
        if (!chatSettledRef.current) s.environment = [];
        // Cache for offline resilience, but never persist the ephemeral chat.
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ...s, environment: [] }));
        setState(s);
        setOffline(false);
        if (s?.user?.location?.lat) prepareRegion(s.user.location);
      };
      ws.onclose = () => { setOffline(true); if (aliveRef.current && !forcedRef.current) setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
    };
    connectRef.current = connect;
    connect();
    return () => { aliveRef.current = false; wsRef.current?.close(); };
  }, []);

  // Real GPS + automatic new-region detection.
  useEffect(() => {
    let last = null;
    let fallbackInterval = null;

    const updateLocation = (lat, lng, accuracy) => {
      if (last && distM(last, { lat, lng }) < 10) return;
      last = { lat, lng };
      emit("set_location", { lat, lng, accuracy_m: Math.round(accuracy) });
    };

    const startSimulatedTokyoGPS = () => {
      const baseLat = 35.6896; // Shinjuku, Tokyo
      const baseLng = 139.7006;
      let driftStep = 0;
      
      const sendMock = () => {
        const driftLat = Math.sin(driftStep * 0.2) * 0.00015;
        const driftLng = Math.cos(driftStep * 0.2) * 0.00015;
        driftStep++;
        
        updateLocation(baseLat + driftLat, baseLng + driftLng, 8 + Math.floor(Math.random() * 4));
      };

      sendMock();
      fallbackInterval = setInterval(sendMock, 4000);
    };

    if (navigator.geolocation) {
      const geoId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords;
          const inJapan = lat > 30 && lat < 46 && lng > 128 && lng < 148;
          if (!inJapan) {
            if (!fallbackInterval) startSimulatedTokyoGPS();
          } else {
            updateLocation(lat, lng, accuracy);
          }
        },
        () => {
          // No device GPS (denied/unavailable) → seamlessly use the Tokyo demo
          // location. This is expected, not an error, so we don't log noise.
          if (!fallbackInterval) startSimulatedTokyoGPS();
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
      );

      return () => {
        navigator.geolocation.clearWatch(geoId);
        if (fallbackInterval) clearInterval(fallbackInterval);
      };
    } else {
      startSimulatedTokyoGPS();
      return () => {
        if (fallbackInterval) clearInterval(fallbackInterval);
      };
    }
  }, [emit]);

  // Region prep: cache map tiles for offline (a designed moment). Re-runs when
  // the user enters a NEW area (>1.5km from the last prep) so warping to another
  // city during the demo re-caches that city's tiles.
  async function prepareRegion(loc) {
    const prev = packedRef.current;
    if (prev && distM(prev, loc) < 1500) return; // already cached this area
    packedRef.current = { lat: loc.lat, lng: loc.lng };
    const name = loc.station && loc.station !== "—" ? loc.station : "this area";
    setRegionPrep({ title: `Preparing ${name} for offline`, sub: "Downloading map tiles…", done: false });
    try {
      const cache = await caches.open("aegis-tiles");
      const jobs = [];
      // Cache the same Esri English street tiles the map renders.
      const TILE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
      for (const z of [14, 15, 16, 17]) {
        const c = ll2tile(loc.lat, loc.lng, z), r = z >= 16 ? 3 : 2;
        for (let x = c.x - r; x <= c.x + r; x++) for (let y = c.y - r; y <= c.y + r; y++)
          jobs.push(TILE.replace("{z}", z).replace("{x}", x).replace("{y}", y));
      }
      let done = 0;
      await Promise.allSettled(jobs.map(async (u) => {
        try { const res = await fetch(u, { mode: "cors" }); if (res.ok) await cache.put(u, res); } catch {}
        setRegionPrep((p) => ({ ...p, sub: `Downloading map · ${++done}/${jobs.length} tiles` }));
      }));
      setRegionPrep({ title: `${name} ready for offline`, sub: `${done} tiles saved · assistant on standby`, done: true });
      setTimeout(() => setRegionPrep(null), 2600);
    } catch { setRegionPrep(null); }
  }

  const forceOffline = useCallback(() => { forcedRef.current = true; wsRef.current?.close(); setOffline(true); }, []);
  const goOnline = useCallback(() => {
    forcedRef.current = false;
    setOffline(false);
    // The socket was closed by forceOffline and never auto-reconnected (pinned);
    // re-establish it now so aftershocks and confirmations flow again.
    if (!wsRef.current || wsRef.current.readyState > 1) connectRef.current?.();
  }, []);

  // Offline turn: apply an on-device (Gemma) update to the mirrored Situation
  // Object through React state, so the UI actually re-renders. `patch` receives
  // the current state and returns the next one (pure, immutable).
  const ingestOffline = useCallback((patch) => {
    setState((prev) => {
      const next = patch(prev || {});
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { state, offline, emit, regionPrep, session: SESSION, forceOffline, goOnline, ingestOffline };
}

// geo helpers
export function distM(a, b) {
  const R = 6371000, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function ll2tile(lat, lng, z) {
  const n = 2 ** z;
  return { x: Math.floor(((lng + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n) };
}

import { useEffect, useRef } from "react";
import L from "leaflet";

// Light Google-Maps-style basemap + real GPS dot + real shelters/hospitals +
// real OSRM route. CartoDB "voyager" is a clean light nav basemap (Google-Maps
// feel) with no key. The map is always the base layer; chrome floats over it.
export default function MapView({ state, active, offline }) {
  const mapRef = useRef(null);
  const layersRef = useRef({});
  const loc = state?.user?.location;
  const hasCenteredRef = useRef(false);

  useEffect(() => {
    if (mapRef.current) return;
    const el = document.getElementById("map");
    if (!el) return;
    const center = [loc?.lat ?? 35.6595, loc?.lng ?? 139.7005];
    const map = L.map("map", { zoomControl: false, attributionControl: false }).setView(center, 15);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20 }).addTo(map);
    layersRef.current.user = L.marker(center, { icon: L.divIcon({ className: "gps-dot", html: '<div class="gps-core"></div>', iconSize: [22, 22] }) }).addTo(map);
    layersRef.current.shelters = L.layerGroup().addTo(map);
    layersRef.current.hospitals = L.layerGroup().addTo(map);
    mapRef.current = map;

    const recenter = () => { const c = layersRef.current.user?.getLatLng(); if (c) map.setView(c, 16, { animate: true }); };
    window.addEventListener("aegis-recenter", recenter);
    return () => {
      window.removeEventListener("aegis-recenter", recenter);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => { if (active && mapRef.current) setTimeout(() => mapRef.current.invalidateSize(), 90); }, [active]);

  useEffect(() => {
    const map = mapRef.current; if (!map || !state) return;
    const st = { lat: loc?.lat ?? 35.6595, lng: loc?.lng ?? 139.7005 };
    layersRef.current.user.setLatLng([st.lat, st.lng]);

    if (!hasCenteredRef.current && loc?.lat) {
      map.setView([st.lat, st.lng], 15);
      hasCenteredRef.current = true;
    }

    const sl = layersRef.current.shelters; sl.clearLayers();
    (state.live_delta?.shelters || []).forEach((sh, i) => {
      if (sh.lat == null) return;
      const best = i === 0;
      L.marker([sh.lat, sh.lng], { icon: L.divIcon({ className: `pin shelter ${best ? "best" : ""}`, html: `<span class="pin-glyph">▲</span>`, iconSize: [26, 26], iconAnchor: [13, 22] }) })
        .addTo(sl).bindPopup(`<b>${sh.name}</b><br>${sh.dist_m}m · ${sh.step_free ? "step-free" : "stairs"}${sh.score ? ` · score ${sh.score}` : ""}`);
    });

    const hl = layersRef.current.hospitals; hl.clearLayers();
    (state.live_delta?.hospitals || []).forEach((hp) => {
      if (hp.lat == null) return;
      L.marker([hp.lat, hp.lng], { icon: L.divIcon({ className: "pin hospital", html: `<span class="pin-cross"></span>`, iconSize: [24, 24], iconAnchor: [12, 12] }) })
        .addTo(hl).bindPopup(`<b>${hp.name}</b><br>${hp.dist_m}m · emergency medical`);
    });

    if (layersRef.current.route) layersRef.current.route.remove();
    if (layersRef.current.casing) layersRef.current.casing.remove();
    const r = state.route;
    if (r?.coords?.length) {
      const off = offline || state.network?.online === false;
      const line = off ? "#e8710a" : "#1a73e8";
      layersRef.current.casing = L.polyline(r.coords, { color: "#ffffff", weight: 11, opacity: .9, lineJoin: "round" }).addTo(map);
      layersRef.current.route = L.polyline(r.coords, { color: line, weight: 6, opacity: 1, lineJoin: "round", lineCap: "round" }).addTo(map);
      try { map.fitBounds(layersRef.current.route.getBounds().pad(0.35)); } catch {}
    }
  }, [state, offline]);

  return <div id="map" />;
}

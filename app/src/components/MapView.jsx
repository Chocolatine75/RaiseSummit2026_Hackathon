import { useEffect, useRef } from "react";
import L from "leaflet";

// Premium dark basemap + real GPS dot + real shelters + real OSRM route.
export default function MapView({ state, active }) {
  const mapRef = useRef(null);
  const layersRef = useRef({});
  const loc = state?.user?.location;

  useEffect(() => {
    if (mapRef.current) return;
    const center = [loc?.lat ?? 35.6896, loc?.lng ?? 139.7006];
    const map = L.map("map", { zoomControl: false, attributionControl: false }).setView(center, 16);
    // CartoDB dark_all: a clean, label-light dark basemap made for navigation —
    // no tourist POI clutter, so the route and shelters are the only signal.
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd", maxZoom: 20,
    }).addTo(map);
    layersRef.current.user = L.marker(center, {
      icon: L.divIcon({ className: "user-pin", html: '<div class="core"></div>', iconSize: [18, 18] }),
    }).addTo(map);
    layersRef.current.shelters = L.layerGroup().addTo(map);
    layersRef.current.hospitals = L.layerGroup().addTo(map);
    mapRef.current = map;
  }, []);

  useEffect(() => { if (active && mapRef.current) setTimeout(() => mapRef.current.invalidateSize(), 80); }, [active]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !state) return;
    const st = { lat: loc?.lat ?? 35.6896, lng: loc?.lng ?? 139.7006 };
    layersRef.current.user.setLatLng([st.lat, st.lng]);

    const sl = layersRef.current.shelters;
    sl.clearLayers();
    (state.live_delta?.shelters || []).forEach((sh, i) => {
      if (sh.lat == null) return;
      // The top-ranked shelter (i===0) is the chosen destination — mark it.
      const best = i === 0;
      L.marker([sh.lat, sh.lng], {
        icon: L.divIcon({ className: `pin shelter ${best ? "best" : ""}`,
          html: `<span class="pin-glyph">◈</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
      }).addTo(sl).bindPopup(`<b>${sh.name}</b><br>${sh.dist_m}m · ${sh.step_free ? "step-free" : "stairs"}${sh.score ? ` · score ${sh.score}` : ""}`);
    });

    const hl = layersRef.current.hospitals;
    hl.clearLayers();
    (state.live_delta?.hospitals || []).forEach((hp) => {
      if (hp.lat == null) return;
      L.marker([hp.lat, hp.lng], {
        icon: L.divIcon({ className: "pin hospital", html: `<span class="pin-cross"></span>`, iconSize: [24, 24], iconAnchor: [12, 12] }),
      }).addTo(hl).bindPopup(`<b>${hp.name}</b><br>${hp.dist_m}m · emergency medical`);
    });

    if (layersRef.current.route) layersRef.current.route.remove();
    if (layersRef.current.casing) layersRef.current.casing.remove();
    const r = state.route;
    if (r?.coords?.length) {
      const off = state.network && state.network.online === false;
      const line = off ? "#f5b301" : "#33c9b7";
      layersRef.current.casing = L.polyline(r.coords, { color: "#02201c", weight: 12, opacity: .6, lineJoin: "round" }).addTo(map);
      layersRef.current.route = L.polyline(r.coords, { color: line, weight: 6, opacity: .96, lineJoin: "round", lineCap: "round" }).addTo(map);
      try { map.fitBounds(layersRef.current.route.getBounds().pad(0.3)); } catch {}
    }
  }, [state]);

  return <div id="map" style={{ height: "100%", width: "100%" }} />;
}

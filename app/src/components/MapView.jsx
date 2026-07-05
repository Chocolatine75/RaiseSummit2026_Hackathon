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
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(map);
    layersRef.current.user = L.marker(center, {
      icon: L.divIcon({ className: "user-pin", html: '<div class="core"></div>', iconSize: [18, 18] }),
    }).addTo(map);
    layersRef.current.shelters = L.layerGroup().addTo(map);
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
    (state.live_delta?.shelters || []).forEach((sh) => {
      if (sh.lat == null) return;
      const open = sh.capacity === "open";
      L.marker([sh.lat, sh.lng], {
        icon: L.divIcon({ className: `shelter-pin ${open ? "" : "full"}`, html: open ? "🟢" : "⛔", iconSize: [24, 24] }),
      }).addTo(sl).bindPopup(`<b>${sh.name}</b><br>${sh.dist_m}m · ${sh.step_free ? "step-free ✓" : "stairs"}`);
    });

    if (layersRef.current.route) layersRef.current.route.remove();
    if (layersRef.current.casing) layersRef.current.casing.remove();
    const r = state.route;
    if (r?.coords?.length) {
      layersRef.current.casing = L.polyline(r.coords, { color: "#052b1e", weight: 12, opacity: .6, lineJoin: "round" }).addTo(map);
      layersRef.current.route = L.polyline(r.coords, { color: "#19e08a", weight: 7, opacity: .96, lineJoin: "round", lineCap: "round" }).addTo(map);
      try { map.fitBounds(layersRef.current.route.getBounds().pad(0.3)); } catch {}
    }
  }, [state]);

  return <div id="map" style={{ height: "100%", width: "100%" }} />;
}

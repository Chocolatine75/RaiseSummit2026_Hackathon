import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useSituation } from '@/context/SituationContext';
import { Colors } from '@/constants/theme';
import { Shelter, Route } from '@/types/situation';

interface MapData {
  userLat: number | null;
  userLng: number | null;
  shelters: Shelter[];
  route: Route | null;
}

function buildMapHtml({ userLat, userLng, shelters, route }: MapData): string {
  const pins = shelters
    .filter((s) => s.lat != null && s.lng != null)
    .map((s) => ({
      lat: s.lat!,
      lng: s.lng!,
      name: s.name,
      dist: s.dist_m,
      stepFree: s.step_free,
      capacity: s.capacity,
    }));

  // Default to Shinjuku if no GPS yet
  const centerLat = userLat ?? 35.6896;
  const centerLng = userLng ?? 139.7006;

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { height: 100%; background: #0A0A0A; }
    .popup { font-family: monospace; font-size: 12px; color: #fff; background: #141414; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 8px; }
    .popup b { color: #FAFAFA; }
    .popup .dist { color: #F59E0B; margin-top: 4px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([${centerLat}, ${centerLng}], 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
      attribution: '© CartoDB', subdomains: 'abcd', maxZoom: 19
    }).addTo(map);

    // Maria's position
    ${userLat != null ? `
    var mariaIcon = L.divIcon({
      html: '<div style="width:14px;height:14px;background:#FF4D2E;border-radius:50%;border:2px solid #fff;box-shadow:0 0 6px #FF4D2E;"></div>',
      className: '', iconSize: [14, 14], iconAnchor: [7, 7]
    });
    L.marker([${userLat}, ${userLng}], { icon: mariaIcon }).addTo(map).bindPopup('<div class="popup"><b>Maria</b></div>');
    ` : ''}

    // OSRM route polyline
    ${route?.coords?.length ? `
    var routeCoords = ${JSON.stringify(route.coords)};
    L.polyline(routeCoords, { color: '#FF4D2E', weight: 3, opacity: 0.8, dashArray: '6, 4' }).addTo(map);
    ` : ''}

    // Shelter pins
    var pins = ${JSON.stringify(pins)};
    pins.forEach(function(p) {
      var color = p.stepFree ? '#FAFAFA' : '#52525B';
      var icon = L.divIcon({
        html: '<div style="width:12px;height:12px;background:' + color + ';border-radius:50%;border:2px solid #fff;"></div>',
        className: '', iconSize: [12, 12], iconAnchor: [6, 6]
      });
      var popup = '<div class="popup"><b>' + p.name + '</b>' +
        (p.stepFree ? ' (step-free)' : '') +
        '<div class="dist">' + p.dist + 'm · ' + p.capacity + '</div></div>';
      L.marker([p.lat, p.lng], { icon: icon }).addTo(map).bindPopup(popup);
    });

    // Fit to show everything
    var all = pins.map(function(p) { return [p.lat, p.lng]; });
    ${userLat != null ? `all.push([${userLat}, ${userLng}]);` : ''}
    if (all.length > 1) {
      map.fitBounds(L.latLngBounds(all).pad(0.2));
    }
  </script>
</body>
</html>`;
}

export default function MapScreen() {
  const { situation } = useSituation();

  const userLat = situation?.user.location?.lat ?? null;
  const userLng = situation?.user.location?.lng ?? null;
  const shelters = situation?.live_delta?.shelters ?? [];
  const route = situation?.route ?? null;

  const html = buildMapHtml({ userLat, userLng, shelters, route });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <WebView
          key={`${route?.target ?? 'none'}-${shelters.length}-${userLat?.toFixed(4) ?? '0'}`}
          source={{ html }}
          style={styles.map}
          originWhitelist={['*']}
          scrollEnabled={false}
          javaScriptEnabled
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  map: { flex: 1, backgroundColor: Colors.background },
});

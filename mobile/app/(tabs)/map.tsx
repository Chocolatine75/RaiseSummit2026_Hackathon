import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useSituation } from '@/context/SituationContext';
import { Colors } from '@/constants/theme';
import { Shelter } from '@/types/situation';

function buildMapHtml(shelters: Shelter[]): string {
  const pins = shelters
    .filter((s) => s.coordinates)
    .map((s) => ({
      lat: s.coordinates!.lat,
      lng: s.coordinates!.lng,
      name: s.name,
      address: s.address,
      dist: s.dist_m,
      stepFree: s.step_free,
      capacity: s.capacity,
    }));

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { height: 100%; background: #0A0A0A; }
    .popup { font-family: monospace; font-size: 12px; color: #fff; background: #0F172A; border: 1px solid #334155; border-radius: 6px; padding: 8px; }
    .popup b { color: #00FF66; }
    .popup .addr { color: #94A3B8; margin-top: 4px; }
    .popup .dist { color: #F59E0B; margin-top: 2px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([35.6938, 139.7034], 14);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
      attribution: '© CartoDB',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    var pins = ${JSON.stringify(pins)};
    pins.forEach(function(p) {
      var color = p.stepFree ? '#00FF66' : '#84CC16';
      var icon = L.divIcon({
        html: '<div style="width:14px;height:14px;background:' + color + ';border-radius:50%;border:2px solid #fff;"></div>',
        className: '', iconSize: [14, 14], iconAnchor: [7, 7]
      });
      var popup = '<div class="popup"><b>' + p.name + '</b>' +
        (p.stepFree ? ' ♿' : '') +
        '<div class="addr">' + p.address + '</div>' +
        '<div class="dist">' + p.dist + 'm · ' + p.capacity + '</div></div>';
      L.marker([p.lat, p.lng], { icon: icon }).addTo(map).bindPopup(popup);
    });

    if (pins.length > 0) {
      var group = L.featureGroup(pins.map(function(p) { return L.marker([p.lat, p.lng]); }));
      map.fitBounds(group.getBounds().pad(0.3));
    }
  </script>
</body>
</html>`;
}

export default function MapScreen() {
  const { situation } = useSituation();
  const shelters = situation?.live_delta.shelters ?? [];
  const html = buildMapHtml(shelters);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <WebView
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

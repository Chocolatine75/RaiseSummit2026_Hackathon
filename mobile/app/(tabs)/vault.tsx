import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSituation } from '@/context/SituationContext';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

function SectionLabel({ title }: { title: string }) {
  return <Text style={styles.sectionLabel}>{title}</Text>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
    </View>
  );
}

export default function VaultScreen() {
  const { situation } = useSituation();

  if (!situation) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Vault empty — waiting for Scout...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { live_delta, country_context, active_alerts } = situation;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {live_delta.shelters.length > 0 && (
          <View style={styles.section}>
            <SectionLabel title={`SHELTERS (${live_delta.shelters.length})`} />
            {live_delta.shelters.map((s, i) => (
              <Card key={i}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>{s.name}</Text>
                  {s.step_free && (
                    <View style={styles.accessBadge}>
                      <Text style={styles.accessBadgeText}>STEP-FREE</Text>
                    </View>
                  )}
                </View>
                <Row label="Address" value={s.address} />
                <Row label="Distance" value={`${s.dist_m}m`} valueColor={Colors.textPrimary} />
                <Row label="Capacity" value={s.capacity} />
              </Card>
            ))}
          </View>
        )}

        {country_context?.embassy && (
          <View style={styles.section}>
            <SectionLabel title="EMBASSY" />
            <Card>
              <Text style={styles.cardTitle}>{country_context.embassy.nationality}</Text>
              <Row label="Address" value={country_context.embassy.address} />
              <Row label="Phone" value={country_context.embassy.phone} />
              <Row label="Emergency" value={country_context.embassy.emergency_line} valueColor={Colors.warning} />
            </Card>
          </View>
        )}

        {Object.keys(country_context?.emergency_numbers ?? {}).length > 0 && (
          <View style={styles.section}>
            <SectionLabel title="EMERGENCY NUMBERS" />
            <Card>
              {Object.entries(country_context!.emergency_numbers).map(([k, v]) => (
                <Row key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} value={v} valueColor={Colors.accent} />
              ))}
            </Card>
          </View>
        )}

        {active_alerts.length > 0 && (
          <View style={styles.section}>
            <SectionLabel title="ALERTS" />
            {active_alerts.map((a, i) => (
              <Card key={i}>
                <View style={styles.alertHeader}>
                  <Text style={styles.alertSource}>{a.source}</Text>
                  <Text style={[styles.alertSeverity, { color: a.severity === 'None' ? Colors.textSecondary : Colors.warning }]}>{a.severity}</Text>
                </View>
                <Text style={styles.alertMsg}>{a.message}</Text>
                <Text style={styles.alertTime}>{a.t}</Text>
              </Card>
            ))}
          </View>
        )}

        {(country_context?.key_phrases ?? []).length > 0 && (
          <View style={styles.section}>
            <SectionLabel title="KEY PHRASES" />
            {country_context!.key_phrases.map((p, i) => (
              <Card key={i}>
                <Text style={styles.phraseLocal}>{p.local}</Text>
                <Text style={styles.phraseRoman}>{p.romanized}</Text>
                <Text style={styles.phraseEn}>{p.en}</Text>
              </Card>
            ))}
          </View>
        )}

        {(country_context?.protocols ?? []).length > 0 && (
          <View style={styles.section}>
            <SectionLabel title="PROTOCOLS" />
            <Card>
              {country_context!.protocols.map((p, i) => (
                <Text key={i} style={styles.protocol}>· {p}</Text>
              ))}
            </Card>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.xl, paddingBottom: 40 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: Fonts.mono, fontSize: Fonts.size.sm, color: Colors.textMuted },
  section: { gap: Spacing.sm },
  sectionLabel: { fontFamily: Fonts.mono, fontSize: Fonts.size.xxs, letterSpacing: 1.6, color: Colors.textMuted, marginBottom: 2 },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.xs },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  cardTitle: { color: Colors.textPrimary, fontSize: Fonts.size.md, fontWeight: '600' },
  accessBadge: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: Radius.sm, paddingHorizontal: 5, paddingVertical: 1 },
  accessBadgeText: { fontFamily: Fonts.mono, fontSize: 7, letterSpacing: 0.8, color: Colors.textMuted },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rowLabel: { fontFamily: Fonts.mono, fontSize: Fonts.size.xs, color: Colors.textMuted, flex: 1 },
  rowValue: { fontFamily: Fonts.mono, fontSize: Fonts.size.xs, color: Colors.textSecondary, flex: 2, textAlign: 'right' },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  alertSource: { fontFamily: Fonts.mono, fontSize: Fonts.size.xs, color: Colors.textMuted },
  alertSeverity: { fontFamily: Fonts.mono, fontSize: Fonts.size.xs, fontWeight: '700' },
  alertMsg: { color: Colors.textPrimary, fontSize: Fonts.size.md },
  alertTime: { fontFamily: Fonts.mono, fontSize: Fonts.size.xxs, color: Colors.textMuted, marginTop: 4 },
  phraseLocal: { fontSize: Fonts.size.lg, color: Colors.textPrimary, fontWeight: '600' },
  phraseRoman: { fontFamily: Fonts.mono, fontSize: Fonts.size.xs, color: Colors.accent },
  phraseEn: { fontSize: Fonts.size.sm, color: Colors.textSecondary },
  protocol: { color: Colors.textSecondary, fontSize: Fonts.size.md, lineHeight: 22 },
});

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSituation } from '@/context/SituationContext';
import { Colors, Fonts } from '@/constants/theme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
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
          <Text style={styles.emptyText}>Vault vide — en attente du Scout…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { live_delta, country_context, active_alerts } = situation;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {live_delta.shelters.length > 0 && (
          <Section title={`🏠 ABRIS (${live_delta.shelters.length})`}>
            {live_delta.shelters.map((s, i) => (
              <Card key={i}>
                <Text style={styles.cardTitle}>{s.name}{s.step_free ? '  ♿' : ''}</Text>
                <Row label="Adresse" value={s.address} />
                <Row label="Distance" value={`${s.dist_m}m`} valueColor={Colors.stepFree} />
                <Row label="Capacité" value={s.capacity} />
                <Row label="Type" value={s.type} />
              </Card>
            ))}
          </Section>
        )}

        {country_context?.embassy && (
          <Section title="🏛️ AMBASSADE">
            <Card>
              <Text style={styles.cardTitle}>{country_context.embassy.nationality}</Text>
              <Row label="Adresse" value={country_context.embassy.address} />
              <Row label="Téléphone" value={country_context.embassy.phone} />
              <Row label="Urgences" value={country_context.embassy.emergency_line} valueColor={Colors.warning} />
            </Card>
          </Section>
        )}

        {Object.keys(country_context?.emergency_numbers ?? {}).length > 0 && (
          <Section title="🚨 NUMÉROS D'URGENCE">
            <Card>
              {Object.entries(country_context!.emergency_numbers).map(([k, v]) => (
                <Row key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} value={v} valueColor={Colors.offline} />
              ))}
            </Card>
          </Section>
        )}

        {active_alerts.length > 0 && (
          <Section title="⚠️ ALERTES">
            {active_alerts.map((a, i) => (
              <Card key={i}>
                <View style={styles.alertHeader}>
                  <Text style={styles.alertSource}>{a.source}</Text>
                  <Text style={[styles.alertSeverity, a.severity === 'None' ? { color: Colors.online } : { color: Colors.warning }]}>
                    {a.severity}
                  </Text>
                </View>
                <Text style={styles.alertMsg}>{a.message}</Text>
                <Text style={styles.alertTime}>{a.t}</Text>
              </Card>
            ))}
          </Section>
        )}

        {(country_context?.key_phrases ?? []).length > 0 && (
          <Section title="💬 PHRASES CLÉS">
            {country_context!.key_phrases.map((p, i) => (
              <Card key={i}>
                <Text style={styles.phraseLocal}>{p.local}</Text>
                <Text style={styles.phraseRoman}>{p.romanized}</Text>
                <Text style={styles.phraseEn}>{p.en}</Text>
              </Card>
            ))}
          </Section>
        )}

        {(country_context?.protocols ?? []).length > 0 && (
          <Section title="📋 PROTOCOLES">
            <Card>
              {country_context!.protocols.map((p, i) => (
                <Text key={i} style={styles.protocol}>• {p}</Text>
              ))}
            </Card>
          </Section>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: Fonts.mono, fontSize: Fonts.size.md, color: Colors.textMuted },
  section: { gap: 8 },
  sectionTitle: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xs,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 6,
  },
  cardTitle: { color: Colors.textPrimary, fontSize: Fonts.size.md, fontWeight: '600', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rowLabel: { fontFamily: Fonts.mono, fontSize: Fonts.size.sm, color: Colors.textMuted, flex: 1 },
  rowValue: { fontFamily: Fonts.mono, fontSize: Fonts.size.sm, color: Colors.textSecondary, flex: 2, textAlign: 'right' },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  alertSource: { fontFamily: Fonts.mono, fontSize: Fonts.size.sm, color: Colors.textMuted },
  alertSeverity: { fontFamily: Fonts.mono, fontSize: Fonts.size.sm, fontWeight: '700' },
  alertMsg: { color: Colors.textPrimary, fontSize: Fonts.size.md },
  alertTime: { fontFamily: Fonts.mono, fontSize: Fonts.size.xs, color: Colors.textMuted, marginTop: 4 },
  phraseLocal: { fontSize: Fonts.size.lg, color: Colors.textPrimary, fontWeight: '600' },
  phraseRoman: { fontFamily: Fonts.mono, fontSize: Fonts.size.sm, color: Colors.accent },
  phraseEn: { fontSize: Fonts.size.sm, color: Colors.textSecondary },
  protocol: { color: Colors.textSecondary, fontSize: Fonts.size.md, lineHeight: 22 },
});

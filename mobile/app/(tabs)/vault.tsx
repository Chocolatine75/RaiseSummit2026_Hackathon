import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

const PROFILE = {
  name: 'Maria Dupont',
  nationality: 'French',
  passport: 'FR 87 241 903',
  dob: '14 Mar 1988',
  blood: 'A+',
  allergies: 'None',
  medicalNotes: 'Travelling with child (age 6) — no stairs',
};

const CONTACTS = [
  { label: 'Husband — Jean Dupont', phone: '+33 6 12 45 78 23', color: Colors.textPrimary },
  { label: 'French Embassy Tokyo', phone: '+81-3-5798-6000', color: Colors.accent },
  { label: 'AXA Assistance (insurer)', phone: '+33 1 55 92 25 25', color: Colors.warning },
];

const INSURANCE = { provider: 'AXA Assistance', ref: 'AXA-2026-FR-00412' };

function Label({ title, color }: { title: string; color?: string }) {
  return <Text style={[styles.label, color ? { color } : undefined]}>{title}</Text>;
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
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.section}>
          <Label title="IDENTITY" color={Colors.textPrimary} />
          <View style={styles.card}>
            <Text style={styles.name}>{PROFILE.name}</Text>
            <Text style={styles.nat}>{PROFILE.nationality}</Text>
            <View style={styles.divider} />
            <Row label="Passport" value={PROFILE.passport} valueColor={Colors.textPrimary} />
            <Row label="Date of birth" value={PROFILE.dob} />
            <Row label="Blood type" value={PROFILE.blood} valueColor={Colors.warning} />
            <Row label="Allergies" value={PROFILE.allergies} />
            <Row label="Notes" value={PROFILE.medicalNotes} />
          </View>
        </View>

        <View style={styles.section}>
          <Label title="INSURANCE" />
          <View style={styles.card}>
            <Row label="Provider" value={INSURANCE.provider} valueColor={Colors.textPrimary} />
            <Row label="Policy ref." value={INSURANCE.ref} />
          </View>
        </View>

        <View style={styles.section}>
          <Label title="EMERGENCY CONTACTS" color={Colors.accent} />
          <View style={styles.card}>
            {CONTACTS.map((c, i) => (
              <View key={i} style={[styles.row, i < CONTACTS.length - 1 && styles.rowBorder]}>
                <Text style={styles.rowLabel}>{c.label}</Text>
                <Text style={[styles.contactPhone, { color: c.color }]}>{c.phone}</Text>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.lg, paddingBottom: 40 },
  section: { gap: Spacing.xs },
  label: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xxs,
    letterSpacing: 1.8,
    color: Colors.textMuted,
    fontWeight: '700',
    marginBottom: 2,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.xs + 2,
  },
  name: { fontSize: Fonts.size.xl, fontWeight: '700', color: Colors.textPrimary },
  nat: { fontFamily: Fonts.mono, fontSize: Fonts.size.xs, color: Colors.textMuted, letterSpacing: 0.8 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingVertical: 2 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: Spacing.xs, marginBottom: 2 },
  rowLabel: { fontFamily: Fonts.mono, fontSize: Fonts.size.xs, color: Colors.textMuted, flex: 1 },
  rowValue: { fontFamily: Fonts.mono, fontSize: Fonts.size.xs, color: Colors.textSecondary, textAlign: 'right', flex: 1 },
  contactPhone: { fontFamily: Fonts.mono, fontSize: Fonts.size.sm, fontWeight: '700', textAlign: 'right' },
});

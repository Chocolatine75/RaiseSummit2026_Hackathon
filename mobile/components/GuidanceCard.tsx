import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';

interface Props {
  text: string | null;
  needsTap: boolean;
  onConfirm: () => void;
}

export function GuidanceCard({ text, needsTap, onConfirm }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>INSTRUCTION</Text>
      <Text style={styles.text}>
        {text ?? 'En attente d\'instructions…'}
      </Text>
      {needsTap && (
        <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm}>
          <Text style={styles.confirmText}>CONFIRMER ✓</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 16,
    marginHorizontal: 16,
  },
  label: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xs,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  text: {
    color: Colors.textPrimary,
    fontSize: Fonts.size.lg,
    lineHeight: 24,
  },
  confirmBtn: {
    marginTop: 14,
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  confirmText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: Fonts.size.sm,
    letterSpacing: 1,
  },
});

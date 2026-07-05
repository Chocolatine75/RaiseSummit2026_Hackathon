import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

interface Props {
  text: string | null;
  needsTap: boolean;
  onConfirm: () => void;
  isEarthquake?: boolean;
}

export function GuidanceCard({ text, needsTap, onConfirm, isEarthquake }: Props) {
  return (
    <View style={[styles.card, isEarthquake && styles.cardActive]}>
      <View style={styles.header}>
        {isEarthquake && (
          <View style={styles.alertChip}>
            <Text style={styles.alertChipText}>QUAKE ACTIVE</Text>
          </View>
        )}
        <Text style={styles.label}>GUIDANCE AEGIS</Text>
      </View>

      <Text style={[styles.text, !text && styles.textEmpty]}>
        {text ?? 'En attente de données...'}
      </Text>

      {needsTap && (
        <Pressable onPress={onConfirm} style={styles.confirmBtn}>
          <Feather name="check" size={12} color={Colors.background} />
          <Text style={styles.confirmText}>CONFIRM</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardActive: {
    borderColor: 'rgba(255,77,46,0.5)',
    backgroundColor: 'rgba(255,77,46,0.05)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  alertChip: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  alertChipText: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xxs,
    letterSpacing: 1,
    color: Colors.background,
    fontWeight: '700',
  },
  label: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xxs,
    letterSpacing: 1.4,
    color: Colors.textMuted,
  },
  text: {
    fontSize: Fonts.size.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 26,
  },
  textEmpty: {
    color: Colors.textMuted,
    fontSize: Fonts.size.md,
    fontWeight: '400',
    fontStyle: 'italic',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: Colors.accent,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    marginTop: 2,
  },
  confirmText: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xxs,
    letterSpacing: 1.2,
    color: Colors.background,
    fontWeight: '700',
  },
});

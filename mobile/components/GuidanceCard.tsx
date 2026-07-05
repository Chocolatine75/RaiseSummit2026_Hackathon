import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

interface Props {
  text: string | null;
  needsTap: boolean;
  isOfflineSource: boolean;
  onConfirm: () => void;
}

export function GuidanceCard({ text, needsTap, isOfflineSource, onConfirm }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>CURRENT INSTRUCTION</Text>
        {isOfflineSource && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>ON-DEVICE</Text>
          </View>
        )}
      </View>
      <Text style={styles.text}>
        {text ?? 'Waiting for guidance...'}
      </Text>
      {needsTap && (
        <Pressable onPress={onConfirm} style={styles.confirmBtn}>
          <Text style={styles.confirmText}>CONFIRM ›</Text>
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
    gap: Spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  label: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xxs,
    letterSpacing: 1.6,
    color: Colors.textMuted,
  },
  badge: {
    borderWidth: 1,
    borderColor: 'rgba(255,77,46,0.3)',
    borderRadius: Radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: 'rgba(255,77,46,0.08)',
  },
  badgeText: {
    fontFamily: Fonts.mono,
    fontSize: 7,
    letterSpacing: 0.8,
    color: Colors.accent,
  },
  text: {
    fontSize: Fonts.size.md,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 21,
  },
  confirmBtn: {
    marginTop: Spacing.xs,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  confirmText: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xxs,
    letterSpacing: 1.0,
    color: Colors.textMuted,
  },
});

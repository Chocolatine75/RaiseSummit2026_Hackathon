import { StyleSheet, Text, View } from 'react-native';
import { SituationObject } from '@/types/situation';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

type DotState = 'active' | 'idle' | 'offline';

function getDotStates(isOnline: boolean, situation: SituationObject | null): DotState[] {
  if (!isOnline) return ['offline', 'offline', 'offline', 'offline'];
  if (!situation) return ['idle', 'idle', 'idle', 'idle'];
  const hasShelters = (situation.live_delta?.shelters?.length ?? 0) > 0;
  const hasPhrases  = (situation.country_context?.key_phrases?.length ?? 0) > 0;
  const hasContext  = !!situation.country_context?.country;
  const hasMap      = false; // offline map not implemented yet
  return [
    hasContext  ? 'active' : 'idle',
    hasShelters ? 'active' : 'idle',
    hasPhrases  ? 'active' : 'idle',
    hasMap      ? 'active' : 'idle',
  ];
}

export function AgentsStrip({ isOnline, situation }: { isOnline: boolean; situation: SituationObject | null }) {
  const states = getDotStates(isOnline, situation);
  const dotColor = (s: DotState) => {
    if (s === 'active')  return Colors.textPrimary;
    if (s === 'offline') return Colors.accent;
    return '#27272A';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Scout</Text>
      <View style={styles.dots}>
        {states.map((s, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: dotColor(s) }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm + 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xxs,
    letterSpacing: 1.2,
    color: Colors.textMuted,
  },
  dots: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
});

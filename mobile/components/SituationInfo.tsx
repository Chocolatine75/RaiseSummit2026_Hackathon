import { StyleSheet, Text, View } from 'react-native';
import { SituationObject } from '@/types/situation';
import { Colors, Fonts } from '@/constants/theme';

interface Props {
  situation: SituationObject | null;
}

export function SituationInfo({ situation }: Props) {
  if (!situation) return null;

  const { event, active_alerts, live_delta, country_context } = situation;
  const rows: { icon: string; text: string; color?: string }[] = [];

  if (event.type) {
    const mag = event.magnitude_reported ? ` M${event.magnitude_reported}` : '';
    rows.push({
      icon: '🔴',
      text: `${event.type.toUpperCase()}${mag} — ${country_context?.city ?? ''}`,
      color: Colors.offline,
    });
  }

  const alert = active_alerts[0];
  if (alert) {
    rows.push({ icon: '⚠️', text: `${alert.source}: ${alert.message}`, color: Colors.warning });
  }

  const stepFree = live_delta.shelters.filter((s) => s.step_free);
  if (stepFree.length > 0) {
    const nearest = stepFree[0];
    rows.push({
      icon: '🏠',
      text: `${stepFree.length} abri${stepFree.length > 1 ? 's' : ''} accessibles · ${nearest.dist_m}m`,
      color: Colors.stepFree,
    });
  }

  if (rows.length === 0) return null;

  return (
    <View style={styles.container}>
      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.icon}>{row.icon}</Text>
          <Text style={[styles.text, row.color ? { color: row.color } : undefined]} numberOfLines={1}>
            {row.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 14,
  },
  text: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    flex: 1,
  },
});

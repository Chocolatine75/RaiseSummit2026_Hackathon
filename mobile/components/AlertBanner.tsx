import { StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

type Alert = { source: string; severity: string; message: string; t: string };

export function AlertBanner({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null;
  const top = alerts[0];

  return (
    <View style={styles.container}>
      <Text style={styles.source}>{top.source} · {top.severity.toUpperCase()}</Text>
      <Text style={styles.message}>{top.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.md,
    backgroundColor: 'rgba(255,77,46,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,46,0.20)',
    borderRadius: Radius.md,
    padding: Spacing.sm + 2,
  },
  source: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xxs,
    letterSpacing: 1.4,
    color: Colors.accent,
    marginBottom: 3,
  },
  message: {
    fontSize: Fonts.size.sm,
    fontWeight: '500',
    color: Colors.textPrimary,
    lineHeight: 18,
  },
});

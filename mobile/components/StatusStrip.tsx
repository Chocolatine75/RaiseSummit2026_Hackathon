import { StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts, Spacing } from '@/constants/theme';

interface Props {
  sessionId: string;
  scoutEnvId: string | null;
  isConnected: boolean;
  lastSync: string | null;
}

export function StatusStrip({ sessionId, isConnected, lastSync }: Props) {
  const time = lastSync
    ? new Date(lastSync).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';

  return (
    <View style={[styles.container, !isConnected && styles.containerOffline]}>
      <View style={styles.left}>
        <View style={[styles.dot, { backgroundColor: isConnected ? '#22C55E' : Colors.accent }]} />
        <Text style={[styles.status, { color: isConnected ? '#22C55E' : Colors.accent }]}>
          {isConnected ? 'ONLINE' : 'OFFLINE'}
        </Text>
        <Text style={styles.sep}>·</Text>
        <Text style={styles.session}>{sessionId}</Text>
      </View>
      <Text style={styles.time}>{time}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  containerOffline: {
    borderBottomColor: 'rgba(255,77,46,0.3)',
    backgroundColor: 'rgba(255,77,46,0.04)',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  status: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xxs,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  sep: {
    color: Colors.textMuted,
    fontSize: Fonts.size.xxs,
  },
  session: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xxs,
    color: Colors.textMuted,
    letterSpacing: 0.6,
  },
  time: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xxs,
    color: Colors.textMuted,
  },
});

import { StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';

interface Props {
  sessionId: string;
  scoutEnvId: string | null;
  isConnected: boolean;
  isOfflineMode: boolean;
  lastSync: string | null;
}

export function StatusStrip({ sessionId, scoutEnvId, isConnected, isOfflineMode, lastSync }: Props) {
  const statusColor = isOfflineMode ? Colors.offline : isConnected ? Colors.online : Colors.warning;
  const statusText = isOfflineMode ? 'OFFLINE' : isConnected ? 'LIVE' : 'CONNECTING';

  return (
    <View style={styles.container}>
      <Text style={styles.text} numberOfLines={1}>
        SESSION: {sessionId.slice(0, 16)}  ENV: {scoutEnvId ? scoutEnvId.slice(0, 8) : '——'}
      </Text>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
        <Text style={[styles.text, { color: statusColor }]}>{statusText}</Text>
        {lastSync && (
          <Text style={[styles.text, { marginLeft: 8 }]}>
            sync {lastSync.slice(11, 19)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  text: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xs,
    color: Colors.textMuted,
  },
});

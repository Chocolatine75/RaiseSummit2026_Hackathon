import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts, Spacing } from '@/constants/theme';

interface Props {
  sessionId: string;
  scoutEnvId: string | null;
  isConnected: boolean;
  isOfflineMode: boolean;
  lastSync: string | null;
  onLongPress?: () => void;
}

export function StatusStrip({ sessionId, isConnected, isOfflineMode, lastSync, onLongPress }: Props) {
  const dotColor = isOfflineMode ? Colors.accent : Colors.online;
  const time = lastSync ? new Date(lastSync).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '--:--';

  return (
    <Pressable onLongPress={onLongPress} delayLongPress={800}>
      <View style={styles.container}>
        <View style={styles.left}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Text style={styles.text}>{sessionId}</Text>
        </View>
        <Text style={styles.text}>{time}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  text: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xxs,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
});

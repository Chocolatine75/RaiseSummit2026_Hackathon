import { StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts, Spacing } from '@/constants/theme';

export function OfflineBanner() {
  return (
    <View style={styles.container}>
      <View style={styles.dot} />
      <Text style={styles.text}>OFFLINE — GEMMA ACTIVE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    gap: 6,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  text: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xxs,
    letterSpacing: 1.4,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});

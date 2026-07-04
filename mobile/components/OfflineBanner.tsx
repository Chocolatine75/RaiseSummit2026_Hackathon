import { StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';

export function OfflineBanner() {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>● HORS LIGNE — VAULT LOCAL ACTIF</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Colors.offline,
    paddingVertical: 8,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: Fonts.size.sm,
    fontFamily: Fonts.mono,
    fontWeight: '700',
    letterSpacing: 1,
  },
});

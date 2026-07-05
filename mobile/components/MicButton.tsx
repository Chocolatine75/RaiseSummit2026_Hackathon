import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

interface Props {
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  onPressIn: () => void;
  onPressOut: () => void;
}

export function MicButton({ isListening, isProcessing, transcript, onPressIn, onPressOut }: Props) {
  const ringColor = isListening ? Colors.accent : Colors.micBorder;
  const iconColor = isListening ? Colors.accent : Colors.textPrimary;
  const hintText  = isProcessing ? 'PROCESSING...' : isListening ? 'LISTENING...' : 'HOLD TO SPEAK';

  return (
    <View style={styles.wrapper}>
      {!!transcript && (
        <View style={styles.transcript}>
          <Text style={styles.transcriptText}>"{transcript}"</Text>
        </View>
      )}
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.ring, { borderColor: ringColor }]}
      >
        <Feather name="mic" size={22} color={iconColor} />
      </Pressable>
      <Text style={styles.hint}>{hintText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: Spacing.sm,
    width: '100%',
  },
  transcript: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    width: '100%',
  },
  transcriptText: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  ring: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    backgroundColor: Colors.micIdle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xxs,
    letterSpacing: 1.2,
    color: Colors.textMuted,
  },
});

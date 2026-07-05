import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

interface Props {
  isListening: boolean;
  isProcessing: boolean;
  isConversationActive: boolean;
  transcript: string;
  onPress: () => void;
}

export function MicButton({ isListening, isProcessing, isConversationActive, transcript, onPress }: Props) {
  const active = isListening || isConversationActive;
  const ringColor = isListening
    ? Colors.accent
    : isConversationActive
    ? 'rgba(255,77,46,0.3)'
    : Colors.micBorder;
  const bgColor = isListening
    ? 'rgba(255,77,46,0.12)'
    : Colors.micIdle;

  const hintText = isProcessing
    ? 'PROCESSING...'
    : isListening
    ? 'LISTENING...'
    : isConversationActive
    ? 'WAITING...'
    : 'TAP TO SPEAK';

  return (
    <View style={styles.wrapper}>
      <Pressable onPress={onPress} style={[styles.ring, { borderColor: ringColor, backgroundColor: bgColor }]}>
        <Feather
          name={isProcessing ? 'loader' : active ? 'mic' : 'mic-off'}
          size={26}
          color={isListening ? Colors.accent : isConversationActive ? 'rgba(255,77,46,0.6)' : Colors.textMuted}
        />
      </Pressable>

      <Text style={[styles.hint, active && { color: isListening ? Colors.accent : 'rgba(255,77,46,0.5)' }]}>
        {hintText}
      </Text>

      {!!transcript && (
        <View style={styles.transcript}>
          <Text style={styles.transcriptText}>"{transcript}"</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: Spacing.sm,
    width: '100%',
    paddingVertical: Spacing.md,
  },
  ring: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xxs,
    letterSpacing: 1.4,
    color: Colors.textMuted,
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
    textAlign: 'center',
  },
});

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';

interface Props {
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  onPressIn: () => void;
  onPressOut: () => void;
}

export function MicButton({ isListening, isProcessing, transcript, onPressIn, onPressOut }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(1);
    }
  }, [isListening]);

  const bgColor = isListening ? Colors.micActive : Colors.micIdle;

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.ripple, isListening && { transform: [{ scale: pulse }] }]}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: bgColor }]}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          activeOpacity={0.8}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : (
            <Text style={styles.icon}>{isListening ? '🎙️' : '🎤'}</Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      <Text style={styles.hint}>
        {isProcessing ? 'Analyse en cours…' : isListening ? 'Parlez…' : 'Maintenez pour parler'}
      </Text>

      {transcript.length > 0 && (
        <Text style={styles.transcript} numberOfLines={2}>{transcript}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 12,
  },
  ripple: {
    borderRadius: 60,
  },
  button: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 36,
  },
  hint: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.sm,
    color: Colors.textMuted,
  },
  transcript: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginHorizontal: 32,
    fontStyle: 'italic',
  },
});

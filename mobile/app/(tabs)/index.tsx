import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSituation } from '@/context/SituationContext';
import { OfflineBanner } from '@/components/OfflineBanner';
import { StatusStrip } from '@/components/StatusStrip';
import { GuidanceCard } from '@/components/GuidanceCard';
import { SituationInfo } from '@/components/SituationInfo';
import { MicButton } from '@/components/MicButton';
import { Colors, Fonts } from '@/constants/theme';

export default function VoiceScreen() {
  const {
    situation,
    isConnected,
    isOfflineMode,
    isListening,
    isProcessing,
    transcript,
    sessionId,
    toggleOfflineMode,
    onMicPressIn,
    onMicPressOut,
    confirmGuidance,
  } = useSituation();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {isOfflineMode && <OfflineBanner />}

      <StatusStrip
        sessionId={sessionId}
        scoutEnvId={situation?.scout_environment_id ?? null}
        isConnected={isConnected}
        isOfflineMode={isOfflineMode}
        lastSync={situation?.network.last_serialized_to_device ?? null}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <GuidanceCard
          text={situation?.guidance.current_instruction_en ?? null}
          needsTap={situation?.guidance.needs_tap ?? false}
          onConfirm={confirmGuidance}
        />

        <SituationInfo situation={situation} />

        <View style={styles.micSection}>
          <MicButton
            isListening={isListening}
            isProcessing={isProcessing}
            transcript={transcript}
            onPressIn={onMicPressIn}
            onPressOut={onMicPressOut}
          />
        </View>

        {/* Mode offline toggle — visible pour la démo */}
        <View style={styles.offlineToggle}>
          <Text style={styles.offlineLabel}>
            {isOfflineMode ? '✈️  Mode avion (démo)' : '🌐  En ligne'}
          </Text>
          <Switch
            value={isOfflineMode}
            onValueChange={toggleOfflineMode}
            trackColor={{ false: Colors.surfaceAlt, true: Colors.offline }}
            thumbColor={Colors.textPrimary}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingVertical: 20,
    gap: 20,
  },
  micSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  offlineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  offlineLabel: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
  },
});

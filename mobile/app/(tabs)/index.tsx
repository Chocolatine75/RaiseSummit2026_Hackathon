import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSituation } from '@/context/SituationContext';
import { AlertBanner } from '@/components/AlertBanner';
import { AgentsStrip } from '@/components/AgentsStrip';
import { GuidanceCard } from '@/components/GuidanceCard';
import { MicButton } from '@/components/MicButton';
import { OfflineBanner } from '@/components/OfflineBanner';
import { StatusStrip } from '@/components/StatusStrip';
import { Colors, Spacing } from '@/constants/theme';

export default function VoiceScreen() {
  const {
    situation,
    isConnected,
    isOfflineMode,
    isListening,
    isProcessing,
    transcript,
    sessionId,
    onLongPressStatus,
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
        onLongPress={onLongPressStatus}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AlertBanner alerts={situation?.active_alerts ?? []} />

        <GuidanceCard
          text={situation?.guidance.current_instruction_en ?? null}
          needsTap={situation?.guidance.needs_tap ?? false}
          isOfflineSource={isOfflineMode}
          onConfirm={confirmGuidance}
        />

        <AgentsStrip isOnline={isConnected && !isOfflineMode} situation={situation} />

        <MicButton
          isListening={isListening}
          isProcessing={isProcessing}
          transcript={transcript}
          onPressIn={onMicPressIn}
          onPressOut={onMicPressOut}
        />
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
    padding: Spacing.md,
    gap: Spacing.sm + 2,
    paddingBottom: Spacing.xl,
  },
});

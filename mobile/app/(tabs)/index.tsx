import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSituation } from '@/context/SituationContext';
import { AgentsStrip } from '@/components/AgentsStrip';
import { GuidanceCard } from '@/components/GuidanceCard';
import { MicButton } from '@/components/MicButton';
import { StatusStrip } from '@/components/StatusStrip';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

export default function VoiceScreen() {
  const {
    situation,
    isConnected,
    isListening,
    isProcessing,
    isConversationActive,
    transcript,
    sessionId,
    onMicTap,
    confirmGuidance,
  } = useSituation();

  const isEarthquake = situation?.event?.type === 'earthquake';
  const route = situation?.route;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusStrip
        sessionId={sessionId}
        scoutEnvId={situation?.scout_environment_id ?? null}
        isConnected={isConnected}
        lastSync={situation?.network.last_serialized_to_device ?? null}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* MIC EN PREMIER */}
        <MicButton
          isListening={isListening}
          isProcessing={isProcessing}
          isConversationActive={isConversationActive}
          transcript={transcript}
          onPress={onMicTap}
        />

        {/* GUIDANCE */}
        <GuidanceCard
          text={situation?.guidance.current_instruction_en ?? null}
          needsTap={situation?.guidance.needs_tap ?? false}
          onConfirm={confirmGuidance}
          isEarthquake={isEarthquake}
        />

        {/* ROUTE BANNER */}
        {isEarthquake && route && (
          <View style={styles.routeBanner}>
            <Text style={styles.routeLabel}>ROUTE</Text>
            <View style={styles.routeRow}>
              <Text style={styles.routeTarget}>{route.target}</Text>
              <View style={styles.routeStats}>
                <Text style={styles.routeEta}>{Math.round(route.duration_s / 60)} min</Text>
                <Text style={styles.routeSep}>·</Text>
                <Text style={styles.routeDist}>{route.distance_m}m</Text>
              </View>
            </View>
            {route.first_step && (
              <Text style={styles.firstStep}>→ {route.first_step}</Text>
            )}
          </View>
        )}

        {/* AGENTS */}
        <AgentsStrip agents={situation?.agents ?? []} isConnected={isConnected} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  routeBanner: {
    backgroundColor: 'rgba(255,77,46,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,46,0.3)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 4,
  },
  routeLabel: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xxs,
    letterSpacing: 1.6,
    color: Colors.accent,
    fontWeight: '700',
  },
  routeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeTarget: {
    fontSize: Fonts.size.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  routeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeEta: {
    fontSize: Fonts.size.md,
    fontWeight: '700',
    color: Colors.warning,
  },
  routeSep: { color: Colors.textMuted },
  routeDist: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
  },
  firstStep: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xs,
    color: Colors.textMuted,
  },
});

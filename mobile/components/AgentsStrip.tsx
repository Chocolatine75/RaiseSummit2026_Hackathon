import { StyleSheet, Text, View } from 'react-native';
import { AgentOp } from '@/types/situation';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

const AGENTS = ['Keeper', 'Listener', 'Scout', 'Maps', 'Router', 'QA'];

function statusColor(status: AgentOp['status'] | 'idle' | 'offline') {
  if (status === 'active')  return Colors.warning;
  if (status === 'done')    return '#22C55E';
  if (status === 'error')   return Colors.accent;
  if (status === 'offline') return Colors.accent;
  return '#27272A';
}

export function AgentsStrip({ agents, isConnected }: { agents: AgentOp[]; isConnected: boolean }) {
  const latest = new Map<string, AgentOp['status']>();
  for (const op of agents) latest.set(op.agent, op.status);

  const lastOp = agents[agents.length - 1];

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.label}>AGENTS</Text>
        {lastOp && (
          <Text style={styles.lastAction} numberOfLines={1}>
            {lastOp.agent} — {lastOp.detail}
          </Text>
        )}
      </View>
      <View style={styles.dots}>
        {AGENTS.map((name) => {
          const status = !isConnected ? 'offline' : (latest.get(name) ?? 'idle');
          return (
            <View key={name} style={styles.agent}>
              <View style={[styles.dot, { backgroundColor: statusColor(status) }]} />
              <Text style={[styles.name, status === 'active' && { color: Colors.warning }]}>
                {name.toUpperCase()}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.sm + 2,
    gap: Spacing.xs,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xxs,
    letterSpacing: 1.2,
    color: Colors.textMuted,
  },
  lastAction: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xxs,
    color: Colors.textMuted,
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  dots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  agent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  name: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xxs,
    letterSpacing: 0.6,
    color: '#3F3F46',
  },
});

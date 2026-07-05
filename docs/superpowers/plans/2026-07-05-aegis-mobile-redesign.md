# AEGIS Mobile Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the AEGIS React Native app with a production-quality dark UI and confirm the Keeper backend connection works end-to-end for the Tokyo earthquake demo.

**Architecture:** Update design tokens in `constants/theme.ts`, rebuild each component in place using the new tokens, assemble updated screens. No new navigation structure — 3 tabs unchanged. New components `AlertBanner` and `AgentsStrip` are added; `SituationInfo` is deleted (its content is absorbed into `GuidanceCard` and `AlertBanner`).

**Tech Stack:** Expo SDK 54, expo-router 6, React Native 0.81.5, `@expo/vector-icons` (Feather icons, already bundled with Expo — no install needed), `react-native-safe-area-context`, Cloudflare Workers (Keeper)

## Global Constraints

- All UI text in **English**
- No emoji used as UI icons — use `@expo/vector-icons` Feather icons
- Font: system default for body (`undefined` in StyleSheet = platform default), `Platform.select({ ios: 'Menlo', android: 'monospace', default: 'Courier New' })` for mono
- All screens use `SafeAreaView` with `edges={['top']}`
- Session ID hardcoded: `aegis-maria-001`
- Keeper URL: `https://aegis-keeper.devstar7014.workers.dev`
- Node 22 required (`source ~/.nvm/nvm.sh && nvm use 22`)
- Run app: `cd mobile && source ~/.nvm/nvm.sh && nvm use 22 && npx expo start --tunnel`

---

## File Map

**Modified:**
- `mobile/constants/theme.ts` — design tokens (colors, fonts, spacing)
- `mobile/components/StatusStrip.tsx` — session/connection bar + long-press offline trigger
- `mobile/components/OfflineBanner.tsx` — red full-width bar
- `mobile/components/GuidanceCard.tsx` — instruction card + ON-DEVICE badge
- `mobile/components/MicButton.tsx` — Feather mic icon, ring design
- `mobile/app/(tabs)/_layout.tsx` — Feather icons, new tab bar style
- `mobile/app/(tabs)/index.tsx` — Voice screen layout
- `mobile/app/(tabs)/map.tsx` — restyled container only
- `mobile/app/(tabs)/vault.tsx` — restyled cards

**Created:**
- `mobile/components/AlertBanner.tsx` — JMA alert card
- `mobile/components/AgentsStrip.tsx` — 4 Scout agent status dots

**Deleted:**
- `mobile/components/SituationInfo.tsx`

---

### Task 1: Design Tokens

**Files:**
- Modify: `mobile/constants/theme.ts`

**Interfaces:**
- Produces: `Colors` object, `Fonts` object, `Spacing` object — consumed by every component

- [ ] **Step 1: Replace theme.ts**

```typescript
import { Platform } from 'react-native';

export const Colors = {
  background:    '#0C0C0C',
  surface:       '#141414',
  border:        'rgba(255,255,255,0.07)',
  borderAccent:  'rgba(255,77,46,0.25)',

  textPrimary:   '#FAFAFA',
  textSecondary: '#A1A1AA',
  textMuted:     '#3F3F46',

  accent:        '#FF4D2E',
  warning:       '#F59E0B',
  online:        '#FAFAFA',

  // Semantic
  micIdle:       '#141414',
  micBorder:     'rgba(255,255,255,0.10)',
  micActive:     '#FF4D2E',
};

export const Fonts = {
  body: undefined as string | undefined, // system default
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'Courier New' }) as string,
  size: {
    xxs: 8,
    xs:  10,
    sm:  12,
    md:  14,
    lg:  16,
    xl:  20,
  },
};

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
};

export const Radius = {
  sm: 4,
  md: 6,
  lg: 10,
};
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd mobile && source ~/.nvm/nvm.sh && nvm use 22 && npx tsc --noEmit
```

Expected: no errors (or only pre-existing unrelated errors).

- [ ] **Step 3: Commit**

```bash
git add mobile/constants/theme.ts
git commit -m "feat(mobile): update design tokens — dark warm palette, accent #FF4D2E"
```

---

### Task 2: Deploy Keeper + Verify Endpoints

**Files:**
- No code changes — deployment only

**Interfaces:**
- Produces: live endpoints at `https://aegis-keeper.devstar7014.workers.dev`
  - `GET  /api/state?session=aegis-maria-001` → `SituationObject`
  - `POST /api/gemma?session=aegis-maria-001` body: `{ question: string, vault_context: string }` → `{ response: string }`
  - `POST /api/voice?session=aegis-maria-001` body: `{ audio_b64: string, mime_type: string }` → `{ transcript: string, response: string }`
  - `WS   /ws?session=aegis-maria-001` → pushes `SituationObject` on change

- [ ] **Step 1: Deploy**

```bash
cd keeper && source ~/.nvm/nvm.sh && nvm use 22
CLOUDFLARE_API_TOKEN=<your_token> npx wrangler deploy
```

Expected output: `✅ Deployed ... aegis-keeper`

- [ ] **Step 2: Verify /api/state**

```bash
curl "https://aegis-keeper.devstar7014.workers.dev/api/state?session=aegis-maria-001"
```

Expected: JSON with `session_id`, `guidance`, `network`, etc. (see schema in memory).

- [ ] **Step 3: Verify /api/gemma**

```bash
curl -X POST "https://aegis-keeper.devstar7014.workers.dev/api/gemma?session=aegis-maria-001" \
  -H "Content-Type: application/json" \
  -d '{"question":"Where is the nearest shelter?","vault_context":"Shelter: Shinjuku Park, 400m"}'
```

Expected: `{ "response": "..." }` with non-empty response string.

- [ ] **Step 4: Commit (no files, just note)**

```bash
git commit --allow-empty -m "chore: verify keeper deployed with /api/gemma + /api/voice"
```

---

### Task 3: AlertBanner + AgentsStrip (New Components)

**Files:**
- Create: `mobile/components/AlertBanner.tsx`
- Create: `mobile/components/AgentsStrip.tsx`

**Interfaces:**
- `AlertBanner` props: `alerts: Array<{ source: string; severity: string; message: string; t: string }>`
- `AgentsStrip` props: `isOnline: boolean; situation: SituationObject | null`

- [ ] **Step 1: Create AlertBanner**

```typescript
// mobile/components/AlertBanner.tsx
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

type Alert = { source: string; severity: string; message: string; t: string };

export function AlertBanner({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null;
  const top = alerts[0];

  return (
    <View style={styles.container}>
      <Text style={styles.source}>{top.source} · {top.severity.toUpperCase()}</Text>
      <Text style={styles.message}>{top.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.md,
    backgroundColor: 'rgba(255,77,46,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,46,0.20)',
    borderRadius: Radius.md,
    padding: Spacing.sm + 2,
  },
  source: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xxs,
    letterSpacing: 1.4,
    color: Colors.accent,
    marginBottom: 3,
  },
  message: {
    fontSize: Fonts.size.sm,
    fontWeight: '500',
    color: Colors.textPrimary,
    lineHeight: 18,
  },
});
```

- [ ] **Step 2: Create AgentsStrip**

Dot states: all 4 dots white when online + situation loaded; all red-dim when offline; amber pulse for working state (simplified: just color, no animation in v1).

```typescript
// mobile/components/AgentsStrip.tsx
import { StyleSheet, Text, View } from 'react-native';
import { SituationObject } from '@/types/situation';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

type DotState = 'active' | 'idle' | 'offline';

function getDotStates(isOnline: boolean, situation: SituationObject | null): DotState[] {
  if (!isOnline) return ['offline', 'offline', 'offline', 'offline'];
  if (!situation) return ['idle', 'idle', 'idle', 'idle'];
  const hasShelters = (situation.live_delta?.shelters?.length ?? 0) > 0;
  const hasPhrases  = (situation.country_context?.key_phrases?.length ?? 0) > 0;
  const hasContext  = !!situation.country_context?.country;
  const hasMap      = false; // offline map not implemented yet
  return [
    hasContext  ? 'active' : 'idle',
    hasShelters ? 'active' : 'idle',
    hasPhrases  ? 'active' : 'idle',
    hasMap      ? 'active' : 'idle',
  ];
}

export function AgentsStrip({ isOnline, situation }: { isOnline: boolean; situation: SituationObject | null }) {
  const states = getDotStates(isOnline, situation);
  const dotColor = (s: DotState) => {
    if (s === 'active')  return Colors.textPrimary;
    if (s === 'offline') return Colors.accent;
    return '#27272A';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Scout</Text>
      <View style={styles.dots}>
        {states.map((s, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: dotColor(s) }]} />
        ))}
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
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm + 2,
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
  dots: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
});
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/components/AlertBanner.tsx mobile/components/AgentsStrip.tsx
git commit -m "feat(mobile): add AlertBanner + AgentsStrip components"
```

---

### Task 4: StatusStrip + OfflineBanner

**Files:**
- Modify: `mobile/components/StatusStrip.tsx`
- Modify: `mobile/components/OfflineBanner.tsx`

**Interfaces:**
- `StatusStrip` props: `sessionId: string; scoutEnvId: string | null; isConnected: boolean; isOfflineMode: boolean; lastSync: string | null; onLongPress?: () => void`
- `OfflineBanner` props: none (styling only)

- [ ] **Step 1: Rewrite StatusStrip**

```typescript
// mobile/components/StatusStrip.tsx
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
```

- [ ] **Step 2: Rewrite OfflineBanner**

```typescript
// mobile/components/OfflineBanner.tsx
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
```

- [ ] **Step 3: Commit**

```bash
git add mobile/components/StatusStrip.tsx mobile/components/OfflineBanner.tsx
git commit -m "feat(mobile): redesign StatusStrip + OfflineBanner"
```

---

### Task 5: GuidanceCard + MicButton

**Files:**
- Modify: `mobile/components/GuidanceCard.tsx`
- Modify: `mobile/components/MicButton.tsx`

**Interfaces:**
- `GuidanceCard` props: `text: string | null; needsTap: boolean; isOfflineSource: boolean; onConfirm: () => void`
- `MicButton` props: `isListening: boolean; isProcessing: boolean; transcript: string; onPressIn: () => void; onPressOut: () => void`

- [ ] **Step 1: Rewrite GuidanceCard**

```typescript
// mobile/components/GuidanceCard.tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

interface Props {
  text: string | null;
  needsTap: boolean;
  isOfflineSource: boolean;
  onConfirm: () => void;
}

export function GuidanceCard({ text, needsTap, isOfflineSource, onConfirm }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>CURRENT INSTRUCTION</Text>
        {isOfflineSource && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>ON-DEVICE</Text>
          </View>
        )}
      </View>
      <Text style={styles.text}>
        {text ?? 'Waiting for guidance...'}
      </Text>
      {needsTap && (
        <Pressable onPress={onConfirm} style={styles.confirmBtn}>
          <Text style={styles.confirmText}>CONFIRM ›</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  label: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xxs,
    letterSpacing: 1.6,
    color: Colors.textMuted,
  },
  badge: {
    borderWidth: 1,
    borderColor: 'rgba(255,77,46,0.3)',
    borderRadius: Radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: 'rgba(255,77,46,0.08)',
  },
  badgeText: {
    fontFamily: Fonts.mono,
    fontSize: 7,
    letterSpacing: 0.8,
    color: Colors.accent,
  },
  text: {
    fontSize: Fonts.size.md,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 21,
  },
  confirmBtn: {
    marginTop: Spacing.xs,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  confirmText: {
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xxs,
    letterSpacing: 1.0,
    color: Colors.textMuted,
  },
});
```

- [ ] **Step 2: Rewrite MicButton**

Uses `@expo/vector-icons` Feather (bundled with Expo, no install needed).

```typescript
// mobile/components/MicButton.tsx
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
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd mobile && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add mobile/components/GuidanceCard.tsx mobile/components/MicButton.tsx
git commit -m "feat(mobile): redesign GuidanceCard + MicButton with Feather icons"
```

---

### Task 6: Voice Screen

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx`
- Modify: `mobile/context/SituationContext.tsx` (remove `toggleOfflineMode` from interface — keep internal, expose via `onLongPressStatus`)
- Delete: `mobile/components/SituationInfo.tsx`

**Interfaces:**
- `SituationContext` now exposes `onLongPressStatus: () => void` instead of `toggleOfflineMode`
- `GuidanceCard` receives `isOfflineSource={isOfflineMode}` to show ON-DEVICE badge

- [ ] **Step 1: Add onLongPressStatus to SituationContext**

In `mobile/context/SituationContext.tsx`, rename `toggleOfflineMode` → `onLongPressStatus` in the interface and provider value (keep the implementation identical):

```typescript
// In SituationContextValue interface — replace:
toggleOfflineMode: () => void;
// with:
onLongPressStatus: () => void;

// In the provider value — replace:
toggleOfflineMode,
// with:
onLongPressStatus: toggleOfflineMode,
```

- [ ] **Step 2: Rewrite Voice screen**

```typescript
// mobile/app/(tabs)/index.tsx
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
```

- [ ] **Step 3: Delete SituationInfo**

```bash
rm mobile/components/SituationInfo.tsx
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd mobile && npx tsc --noEmit
```

Fix any import errors (remove any remaining SituationInfo imports).

- [ ] **Step 5: Visual test — run app, check Voice screen**

```bash
cd mobile && source ~/.nvm/nvm.sh && nvm use 22 && npx expo start --tunnel
```

Open in Expo Go. Verify:
- Black background, no light flash
- StatusStrip visible at top with session ID
- GuidanceCard shows "Waiting for guidance..."
- AgentsStrip shows 4 dim dots (no data yet)
- MicButton centered with Feather mic icon
- Long-press on StatusStrip for 800ms → OfflineBanner appears red at top, mic ring turns red
- Long-press again → OfflineBanner disappears

- [ ] **Step 6: Commit**

```bash
git add mobile/app/(tabs)/index.tsx mobile/context/SituationContext.tsx
git rm mobile/components/SituationInfo.tsx
git commit -m "feat(mobile): redesign Voice screen — assemble new components"
```

---

### Task 7: Tab Bar

**Files:**
- Modify: `mobile/app/(tabs)/_layout.tsx`

**Interfaces:**
- No external interface — self-contained layout

- [ ] **Step 1: Rewrite tab layout with Feather icons**

```typescript
// mobile/app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

function TabIcon({ name, focused }: { name: FeatherName; focused: boolean }) {
  return (
    <Feather
      name={name}
      size={16}
      color={focused ? Colors.textPrimary : Colors.textMuted}
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: Fonts.mono,
          fontSize: 7,
          letterSpacing: 1.0,
        },
        tabBarActiveTintColor: Colors.textPrimary,
        tabBarInactiveTintColor: Colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'VOICE',
          tabBarIcon: ({ focused }) => <TabIcon name="mic" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'MAP',
          tabBarIcon: ({ focused }) => <TabIcon name="map" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          title: 'VAULT',
          tabBarIcon: ({ focused }) => <TabIcon name="lock" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 2: Visual test**

Run app in Expo Go. Verify tab bar shows crisp Feather icons, uppercase mono labels, correct active/inactive states.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/(tabs)/_layout.tsx
git commit -m "feat(mobile): tab bar — Feather icons, mono labels"
```

---

### Task 8: Vault Screen

**Files:**
- Modify: `mobile/app/(tabs)/vault.tsx`

**Interfaces:**
- No interface changes — same `useSituation()` hook

- [ ] **Step 1: Restyle Vault screen with new tokens**

Replace `mobile/app/(tabs)/vault.tsx` with the same structure, updated tokens:

```typescript
// mobile/app/(tabs)/vault.tsx
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSituation } from '@/context/SituationContext';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

function SectionLabel({ title }: { title: string }) {
  return <Text style={styles.sectionLabel}>{title}</Text>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
    </View>
  );
}

export default function VaultScreen() {
  const { situation } = useSituation();

  if (!situation) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Vault empty — waiting for Scout...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { live_delta, country_context, active_alerts } = situation;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {live_delta.shelters.length > 0 && (
          <View style={styles.section}>
            <SectionLabel title={`SHELTERS (${live_delta.shelters.length})`} />
            {live_delta.shelters.map((s, i) => (
              <Card key={i}>
                <Text style={styles.cardTitle}>{s.name}{s.step_free ? '  ♿' : ''}</Text>
                <Row label="Address" value={s.address} />
                <Row label="Distance" value={`${s.dist_m}m`} valueColor={Colors.textPrimary} />
                <Row label="Capacity" value={s.capacity} />
              </Card>
            ))}
          </View>
        )}

        {country_context?.embassy && (
          <View style={styles.section}>
            <SectionLabel title="EMBASSY" />
            <Card>
              <Text style={styles.cardTitle}>{country_context.embassy.nationality}</Text>
              <Row label="Address" value={country_context.embassy.address} />
              <Row label="Phone" value={country_context.embassy.phone} />
              <Row label="Emergency" value={country_context.embassy.emergency_line} valueColor={Colors.warning} />
            </Card>
          </View>
        )}

        {Object.keys(country_context?.emergency_numbers ?? {}).length > 0 && (
          <View style={styles.section}>
            <SectionLabel title="EMERGENCY NUMBERS" />
            <Card>
              {Object.entries(country_context!.emergency_numbers).map(([k, v]) => (
                <Row key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} value={v} valueColor={Colors.accent} />
              ))}
            </Card>
          </View>
        )}

        {active_alerts.length > 0 && (
          <View style={styles.section}>
            <SectionLabel title="ALERTS" />
            {active_alerts.map((a, i) => (
              <Card key={i}>
                <View style={styles.alertHeader}>
                  <Text style={styles.alertSource}>{a.source}</Text>
                  <Text style={[styles.alertSeverity, { color: a.severity === 'None' ? Colors.textSecondary : Colors.warning }]}>{a.severity}</Text>
                </View>
                <Text style={styles.alertMsg}>{a.message}</Text>
                <Text style={styles.alertTime}>{a.t}</Text>
              </Card>
            ))}
          </View>
        )}

        {(country_context?.key_phrases ?? []).length > 0 && (
          <View style={styles.section}>
            <SectionLabel title="KEY PHRASES" />
            {country_context!.key_phrases.map((p, i) => (
              <Card key={i}>
                <Text style={styles.phraseLocal}>{p.local}</Text>
                <Text style={styles.phraseRoman}>{p.romanized}</Text>
                <Text style={styles.phraseEn}>{p.en}</Text>
              </Card>
            ))}
          </View>
        )}

        {(country_context?.protocols ?? []).length > 0 && (
          <View style={styles.section}>
            <SectionLabel title="PROTOCOLS" />
            <Card>
              {country_context!.protocols.map((p, i) => (
                <Text key={i} style={styles.protocol}>· {p}</Text>
              ))}
            </Card>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.xl, paddingBottom: 40 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: Fonts.mono, fontSize: Fonts.size.sm, color: Colors.textMuted },
  section: { gap: Spacing.sm },
  sectionLabel: { fontFamily: Fonts.mono, fontSize: Fonts.size.xxs, letterSpacing: 1.6, color: Colors.textMuted, marginBottom: 2 },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.xs },
  cardTitle: { color: Colors.textPrimary, fontSize: Fonts.size.md, fontWeight: '600', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rowLabel: { fontFamily: Fonts.mono, fontSize: Fonts.size.xs, color: Colors.textMuted, flex: 1 },
  rowValue: { fontFamily: Fonts.mono, fontSize: Fonts.size.xs, color: Colors.textSecondary, flex: 2, textAlign: 'right' },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  alertSource: { fontFamily: Fonts.mono, fontSize: Fonts.size.xs, color: Colors.textMuted },
  alertSeverity: { fontFamily: Fonts.mono, fontSize: Fonts.size.xs, fontWeight: '700' },
  alertMsg: { color: Colors.textPrimary, fontSize: Fonts.size.md },
  alertTime: { fontFamily: Fonts.mono, fontSize: Fonts.size.xxs, color: Colors.textMuted, marginTop: 4 },
  phraseLocal: { fontSize: Fonts.size.lg, color: Colors.textPrimary, fontWeight: '600' },
  phraseRoman: { fontFamily: Fonts.mono, fontSize: Fonts.size.xs, color: Colors.accent },
  phraseEn: { fontSize: Fonts.size.sm, color: Colors.textSecondary },
  protocol: { color: Colors.textSecondary, fontSize: Fonts.size.md, lineHeight: 22 },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app/(tabs)/vault.tsx
git commit -m "feat(mobile): restyle Vault screen with new design tokens"
```

---

### Task 9: Map Screen

**Files:**
- Modify: `mobile/app/(tabs)/map.tsx`

**Interfaces:**
- No changes to WebView logic — container restyled only

- [ ] **Step 1: Restyle Map screen container**

Open `mobile/app/(tabs)/map.tsx`. Find the `SafeAreaView` and any wrapper `View` styles. Replace `backgroundColor` values with `Colors.background`. The WebView content (HTML with Leaflet) is unchanged.

The change is minimal — just ensure no light colors bleed around the WebView edges:

```typescript
// At the top of map.tsx, ensure these imports:
import { Colors } from '@/constants/theme';

// SafeAreaView style:
style={{ flex: 1, backgroundColor: Colors.background }}

// Any outer View wrapper:
style={{ flex: 1, backgroundColor: Colors.background }}
```

- [ ] **Step 2: Visual test**

Open Map tab in Expo Go. Verify dark background, no white flash on load.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/(tabs)/map.tsx
git commit -m "feat(mobile): restyle Map screen container — dark background"
```

---

### Task 10: End-to-End Demo Verify

**Files:**
- No code changes — verification only

- [ ] **Step 1: Run full demo flow**

Start app:
```bash
cd mobile && source ~/.nvm/nvm.sh && nvm use 22 && npx expo start --tunnel
```

- [ ] **Step 2: Verify online state**

Open Expo Go. Confirm:
- WebSocket connects (StatusStrip dot is white)
- Fetch initial state from `/api/state` populates guidance/alerts if any exist
- AgentsStrip dots reflect vault content (white = data present, dark = empty)

- [ ] **Step 3: Trigger earthquake event**

```bash
curl -X POST "https://aegis-keeper.devstar7014.workers.dev/event?session=aegis-maria-001" \
  -H "Content-Type: application/json" \
  -d '{"type":"quake","payload":{"magnitude":6.8,"location":"Shinjuku"},"src":"test"}'
```

Expected: AlertBanner appears, GuidanceCard updates via WebSocket push.

- [ ] **Step 4: Test voice online**

Hold mic button → speak "Where should I go?" → release.
Expected: transcript appears, GuidanceCard updates with Gemini response.

- [ ] **Step 5: Trigger offline mode**

Long-press StatusStrip for 800ms.
Expected: red OfflineBanner appears, mic ring border turns red.

- [ ] **Step 6: Test voice offline**

Hold mic button → speak → release.
Expected: GuidanceCard updates with Gemma response, `ON-DEVICE` badge visible.

- [ ] **Step 7: Final commit + push**

```bash
git add -A
git commit -m "feat(mobile): complete UI redesign + backend connection verified"
git push origin Matteo
```

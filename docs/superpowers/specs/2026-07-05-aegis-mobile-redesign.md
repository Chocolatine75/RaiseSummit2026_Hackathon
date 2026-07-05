# AEGIS Mobile — Redesign + Backend Connection Spec

**Date:** 2026-07-05  
**Scope:** React Native app (`mobile/`) — full visual redesign + wire backend endpoints  
**Demo target:** RaiseSummit Paris, July 8-9 2026 — Tokyo earthquake, Maria (French, no Japanese)

---

## Goal

Replace the current placeholder UI with a production-quality visual design, and confirm the backend connection (Keeper WebSocket + REST) works end-to-end for the demo.

---

## Design System

### Colors

| Token | Value | Use |
|---|---|---|
| `background` | `#0C0C0C` | Screen background |
| `surface` | `#141414` | Cards, panels |
| `border` | `rgba(255,255,255,0.07)` | All borders |
| `textPrimary` | `#FAFAFA` | Body text, instructions |
| `textSecondary` | `#A1A1AA` | Supporting text |
| `textMuted` | `#3F3F46` | Labels, timestamps |
| `accent` | `#FF4D2E` | Offline state, mic active, critical alerts |
| `warning` | `#F59E0B` | JMA warnings, embassy urgency |
| `online` | `#FAFAFA` | Online dot (white, no celebration) |

Offline state is signaled by: red border on screen root, red top bar, red mic ring. Not a color theme — a signal.

### Typography

| Role | Font | Size | Weight |
|---|---|---|---|
| Body / instructions | Inter (system fallback) | 14–16px | 400–600 |
| Data / labels / IDs | JetBrains Mono (or Courier as RN fallback) | 8–11px | 400–500 |
| Guidance text | Inter | 14px | 600 |
| Section labels | Mono, uppercase, `letterSpacing: 1.8` | 8px | 400 |

### Shape

- Card radius: `10px`
- Badge/button radius: `4px`
- Border: `1px solid rgba(255,255,255,0.07)`

---

## Component Inventory

### Updated components (existing, restyled)

**`constants/theme.ts`** — Replace all tokens with new values above. Add `Fonts.body = 'Inter'` (or system default), keep `Fonts.mono`.

**`components/StatusStrip`** — Single line: connection dot (white=online, red=offline) + session ID in mono + right-aligned timestamp. Height ~32px. No background — floats over screen.

**`components/OfflineBanner`** — Full-width red bar (`#FF4D2E`), pulsing dot, `OFFLINE — GEMMA ACTIVE` in mono. Replaces current banner.

**`components/GuidanceCard`** — Surface card with mono label `CURRENT INSTRUCTION`, large body text (14px semibold), `CONFIRM ›` button (outline, mono, small). When Gemma is source, show `ON-DEVICE` badge (red outline, mono).

**`components/MicButton`** — 80px circle, `#141414` fill, `border: 1px solid rgba(255,255,255,0.10)`. Mic SVG icon (not emoji). When listening: border turns `#FF4D2E`, slight scale-up animation. Hint text below: `HOLD TO SPEAK` in mono.

**`components/SituationInfo`** — Remove. Content absorbed into GuidanceCard and AlertBanner.

### New components

**`components/AlertBanner`** — Replaces the current inline alert display. Shows JMA source in mono red + alert text. Background `rgba(255,77,46,0.08)`, border `rgba(255,77,46,0.20)`. Only rendered when `active_alerts` has entries.

**`components/AgentsStrip`** — 4 small dots (5px circles) representing Scout agents: Context, Shelters, Phrases, Map. States: active (white), working (amber pulse), offline/dead (red), idle (dark gray). Label `Scout` in mono left. Tap-to-expand is future work — not in this spec.

### Tab bar

- Height: 64px, padding-bottom: 12px (safe area)
- Background: `#0C0C0C`, border-top: `rgba(255,255,255,0.06)`
- Icons: inline SVG (mic, globe, lock) — no emojis
- Labels: mono, 7px, `letterSpacing: 1.0` — `VOICE`, `MAP`, `VAULT`
- Active: icon + label full white; inactive: opacity 0.2

---

## Screen Designs

### Voice Screen (`app/(tabs)/index.tsx`)

Layout (top to bottom):
1. `StatusStrip` — session ID + connection state
2. `AlertBanner` — shown only when `active_alerts.length > 0`
3. `GuidanceCard` — always shown (empty state: placeholder text)
4. `AgentsStrip` — scout status
5. Mic area (flex:1, centered) — `MicButton` + transcript card below when not empty
6. Tab bar

Offline mode toggle: removed from UI. State is driven by actual WebSocket disconnect. For demo, a hidden long-press on the StatusStrip triggers `toggleOfflineMode()`.

### Map Screen (`app/(tabs)/map.tsx`)

Same layout shell (StatusStrip + tab bar). WebView with dark OSM tiles (CartoDB DarkMatter or equivalent). Shelter pins as small red circles. No change to existing map logic — restyled container only.

### Vault Screen (`app/(tabs)/vault.tsx`)

Same sections as current (Shelters, Embassy, Emergency Numbers, Key Phrases, Protocols). Restyled with new tokens: `surface` cards, mono section labels, `border` separators. No structural change.

---

## Backend Connection

The connection code in `services/keeper.ts` and `context/SituationContext.tsx` is already complete and correct. The only blocker is Keeper not being deployed with the new endpoints.

**Required before demo:**

1. Deploy Keeper: `cd keeper && CLOUDFLARE_API_TOKEN=<token> npx wrangler deploy`
2. Verify `/api/gemma` responds (POST with `question` + `vault_context`)
3. Verify `/api/voice` responds (POST with `audio_b64` + `mime_type`)
4. Verify WebSocket pushes situation updates after Scout run

No code changes needed in `services/keeper.ts`. Session ID stays hardcoded as `aegis-maria-001` for demo.

---

## Demo Flow (spec reference)

1. App opens → WebSocket connects → Scout fills vault in background → AgentsStrip shows 4 active dots
2. Trigger earthquake event via Keeper (POST `/event` with `type: "quake"`) → AlertBanner appears, GuidanceCard fills
3. Hold mic → speak → Gemini transcribes + responds → guidance updates
4. Long-press StatusStrip → offline mode → red border + OfflineBanner → mic now routes to `/api/gemma`
5. Speak → Gemma answers from vault → `ON-DEVICE` badge on GuidanceCard

---

## Out of Scope

- On-device Gemma (future)
- Agent inspection tap-to-expand (future)
- Live Translate UI (future)
- Offline map tiles (future)
- Identity vault (future)

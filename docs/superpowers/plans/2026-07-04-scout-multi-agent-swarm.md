# Scout Multi-Agent Swarm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock-page-browsing Scout with a real multi-agent swarm: an Orchestrator decides tasks, three parallel Antigravity sub-agents gather live country/shelter/alert data from the real web, and a Verifier checks quality before emitting to the Keeper.

**Architecture:** The existing `scout.mjs` becomes a loop driver. It spawns an Orchestrator (stateful Gemini 3.5 Flash, no web browsing needed) that produces task prompts from the live Situation Object context. Three Antigravity agents run in parallel with `Promise.allSettled` and each resume their own sandbox via `environment_id`. A Verifier (stateless Gemini call) checks completeness and flags gaps for a single targeted retry before emitting an enriched `delta_update` to the Keeper.

**Tech Stack:** Node.js ESM, `@google/genai` v2.3.0, Cloudflare Workers + Durable Objects, Interactions API (`antigravity-preview-05-2026`), `gemini-3.5-flash`

## Global Constraints

- All files are ESM (`"type": "module"` in `workers/package.json`) — no `require()`
- Use `@google/genai` v2.3.0 SDK for all Gemini calls — import from `@google/genai`
- Antigravity agent ID: `"antigravity-preview-05-2026"` — exact string, no variations
- Keeper event bus contract: never write Situation Object directly; always emit events via `POST /event?session=<SESSION>`
- New event type `delta_update` already exists in the Keeper — extend its payload; do not add new event types
- 15-second timeout per Antigravity agent per cycle — never block the loop
- All files live under `workers/scout/` — do not create new top-level directories
- Env vars: `GEMINI_API_KEY`, `KEEPER_URL` (default `http://localhost:8787`), `SESSION` (default `"demo"`), `COUNTRY` (default `"Japan"`), `CITY` (default `"Tokyo"`), `USER_NATIONALITY` (default `"French"`)
- Demo scenario: Maria, Shinjuku station, Tokyo earthquake — defaults must match

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `workers/scout/scout.mjs` | Loop driver: orchestrate → parallel agents → verify → emit |
| Create | `workers/scout/orchestrator.mjs` | Reads Keeper state, produces task prompts for sub-agents |
| Create | `workers/scout/agents/country.mjs` | Antigravity: embassy, emergency numbers, key phrases |
| Create | `workers/scout/agents/shelter.mjs` | Antigravity: real shelters/hospitals from OSM + gov registries |
| Create | `workers/scout/agents/alert.mjs` | Antigravity: live crisis alerts from JMA/USGS/transit APIs |
| Create | `workers/scout/verifier.mjs` | Stateless Gemini call: quality check + gap list |
| Modify | `keeper/src/index.js` | Add `country_context`/`active_alerts` to schema; extend `delta_update`; enrich `reason()` prompt |
| Create | `workers/scout/scout-state.json` | Persisted agent IDs (gitignored) |
| Create | `scripts/test-scout-swarm.mjs` | Smoke test: run one full cycle, assert emit reaches Keeper |

---

## Task 1: Extend Keeper schema and delta_update handler

**Files:**
- Modify: `keeper/src/index.js:36-52` (`freshState`) and `:131-141` (`delta_update` case) and `:162-172` (`reason` prompt)

**Interfaces:**
- Consumes: nothing new
- Produces: `Situation Object` now has `country_context` and `active_alerts` fields that later tasks emit into

- [ ] **Step 1: Open the file and locate the three sections to change**

```
keeper/src/index.js:36  → freshState()
keeper/src/index.js:131 → delta_update case in handleEvent()
keeper/src/index.js:162 → reason() prompt string
```

- [ ] **Step 2: Add `country_context` and `active_alerts` to `freshState()`**

In `freshState()`, after the `live_delta` block, add two fields:

```js
// Before (line ~51):
live_delta: { exits_down: [], official_evac_direction: null, shelters: [], as_of: null },

// After:
live_delta: { exits_down: [], official_evac_direction: null, shelters: [], as_of: null },
country_context: null,   // filled by Scout's country agent on first cycle
active_alerts: [],        // filled by Scout's alert agent each cycle
```

- [ ] **Step 3: Extend the `delta_update` handler to write the new fields**

In the `delta_update` case in `handleEvent()`, after the existing `if (p.shelters)` line, add:

```js
// Before (line ~138):
if (p.shelters) s.live_delta.shelters = p.shelters;
s.live_delta.as_of = t;
if (p.environment_id) s.scout_environment_id = p.environment_id;

// After:
if (p.shelters) s.live_delta.shelters = p.shelters;
s.live_delta.as_of = t;
if (p.environment_id) s.scout_environment_id = p.environment_id;
if (p.country_context) s.country_context = p.country_context;
if (p.active_alerts) s.active_alerts = p.active_alerts;
```

- [ ] **Step 4: Enrich the `reason()` prompt to use the new fields**

In `reason()`, the prompt currently builds context from `s`. Extend it to surface `country_context` and `active_alerts`:

```js
// Add after the existing prompt string (insert before the closing backtick):
`${s.country_context ? `\nCountry context (embassy, protocols): ${JSON.stringify(s.country_context)}` : ""}` +
`${s.active_alerts?.length ? `\nActive alerts: ${JSON.stringify(s.active_alerts)}` : ""}` +
```

The full prompt construction should look like:

```js
const prompt =
  `You are AEGIS, guiding ${s.user.name} through a live emergency. ` +
  `Her constraints: ${s.user.constraints.join(", ")}. Location: ${JSON.stringify(s.user.location)}.\n` +
  `Current situation JSON:\n${JSON.stringify(s)}\n\n` +
  `${s.country_context ? `\nCountry context (embassy, protocols): ${JSON.stringify(s.country_context)}` : ""}` +
  `${s.active_alerts?.length ? `\nActive alerts: ${JSON.stringify(s.active_alerts)}` : ""}` +
  `Latest development is the last entry of "environment" or the "live_delta". ` +
  `Respond ONLY with JSON: {"surface_now": boolean, "plain_line_en": string, ` +
  `"next_question": string, "needs_tap": boolean}. ` +
  `plain_line_en is ONE short spoken-style instruction respecting her constraints, ` +
  `citing data freshness when using live_delta. needs_tap=true only when the ` +
  `instruction changes her route or files something on her behalf.`;
```

- [ ] **Step 5: Smoke-test the schema change locally**

```bash
cd keeper && npx wrangler dev &
sleep 3
curl -s http://localhost:8787/api/state | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const s=JSON.parse(d); console.assert('country_context' in s, 'missing country_context'); console.assert(Array.isArray(s.active_alerts), 'missing active_alerts'); console.log('schema ok')"
kill %1
```

Expected output: `schema ok`

- [ ] **Step 6: Commit**

```bash
git add keeper/src/index.js
git commit -m "feat(keeper): add country_context and active_alerts to Situation Object"
```

---

## Task 2: CountryAgent (Antigravity)

**Files:**
- Create: `workers/scout/agents/country.mjs`

**Interfaces:**
- Consumes: `{ task, prevState: { interaction_id, environment_id } }` — task string from Orchestrator, prev agent state
- Produces:
```js
{
  interaction_id: string,
  environment_id: string,
  data: {
    country: string,
    city: string,
    emergency_numbers: { police: string, ambulance: string, fire: string },
    embassy: { nationality: string, address: string, phone: string, emergency_line: string },
    key_phrases: Array<{ local: string, en: string, romanized: string }>,
    protocols: string[]
  }
}
```

- [ ] **Step 1: Write a smoke test for the agent interface**

Create `scripts/test-country-agent.mjs`:

```js
import { runCountryAgent } from "../workers/scout/agents/country.mjs";

const result = await runCountryAgent(
  "Find the French embassy in Tokyo. Get Japan emergency numbers (police, ambulance). Get 3 key Japanese survival phrases.",
  {}
);

console.assert(result.data?.emergency_numbers?.police, "missing police number");
console.assert(result.data?.embassy?.phone, "missing embassy phone");
console.assert(result.data?.key_phrases?.length >= 3, "too few phrases");
console.assert(result.environment_id, "missing environment_id");
console.log("country agent ok:", JSON.stringify(result.data, null, 2));
```

- [ ] **Step 2: Run it to verify it fails (module not found)**

```bash
cd workers && GEMINI_API_KEY=test node ../scripts/test-country-agent.mjs 2>&1 | head -5
```

Expected: `Error: Cannot find module`

- [ ] **Step 3: Implement `workers/scout/agents/country.mjs`**

```js
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Antigravity agent: browses real web sources to fill country_context.
 * @param {string} task - specific instructions from the Orchestrator
 * @param {{ interaction_id?: string, environment_id?: string }} prev
 * @returns {{ interaction_id: string, environment_id: string, data: object }}
 */
export async function runCountryAgent(task, prev = {}) {
  const SYSTEM = `You are a country intelligence agent in a crisis. Browse the real web.
Reply ONLY with valid JSON — no prose, no markdown fences:
{
  "country": string,
  "city": string,
  "emergency_numbers": {"police": string, "ambulance": string, "fire": string},
  "embassy": {"nationality": string, "address": string, "phone": string, "emergency_line": string},
  "key_phrases": [{"local": string, "en": string, "romanized": string}],
  "protocols": string[]
}`;

  const interaction = await ai.interactions.create({
    agent: "antigravity-preview-05-2026",
    input: `${SYSTEM}\n\nTask: ${task}`,
    environment: prev.environment_id || "remote",
    ...(prev.interaction_id ? { previous_interaction_id: prev.interaction_id } : {}),
  });

  const environment_id = interaction.environment_id || prev.environment_id;
  const data = parseJsonLoose(interaction.output_text || "");

  return { interaction_id: interaction.id, environment_id, data };
}

function parseJsonLoose(text) {
  try { return JSON.parse(text); } catch {}
  const m = String(text).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}
```

- [ ] **Step 4: Run the smoke test with a real API key**

```bash
cd workers && GEMINI_API_KEY=<your_key> node ../scripts/test-country-agent.mjs
```

Expected: `country agent ok:` followed by JSON with embassy phone and emergency numbers.

- [ ] **Step 5: Commit**

```bash
git add workers/scout/agents/country.mjs scripts/test-country-agent.mjs
git commit -m "feat(scout): add CountryAgent (Antigravity) for live country context"
```

---

## Task 3: ShelterAgent (Antigravity)

**Files:**
- Create: `workers/scout/agents/shelter.mjs`

**Interfaces:**
- Consumes: `{ task, prevState: { interaction_id, environment_id } }`
- Produces:
```js
{
  interaction_id: string,
  environment_id: string,
  data: {
    shelters: Array<{
      name: string,
      type: string,   // free string: "park", "hospital", "school", "shelter", "evac_point", etc.
      address: string,
      dist_m: number,
      step_free: boolean,
      capacity: "open"|"full"|"unknown",
      coordinates: { lat: number, lng: number },
      source: string
    }>
  }
}
```

- [ ] **Step 1: Write a smoke test**

Create `scripts/test-shelter-agent.mjs`:

```js
import { runShelterAgent } from "../workers/scout/agents/shelter.mjs";

const result = await runShelterAgent(
  "Find step-free emergency shelters and hospitals within 2km of Shinjuku station, Tokyo. Use Overpass API at https://overpass-api.de/api/interpreter to query OSM amenity=shelter and amenity=hospital near lat=35.6896,lng=139.7006 within 2000m. Also check https://www.bousai.metro.tokyo.lg.jp/ for official Tokyo shelter registry.",
  {}
);

console.assert(result.data?.shelters?.length > 0, "no shelters found");
console.assert(result.environment_id, "missing environment_id");
const stepFree = result.data.shelters.filter(s => s.step_free);
console.log(`shelter agent ok: ${result.data.shelters.length} shelters, ${stepFree.length} step-free`);
console.log(JSON.stringify(result.data.shelters[0], null, 2));
```

- [ ] **Step 2: Run it to verify it fails (module not found)**

```bash
cd workers && GEMINI_API_KEY=test node ../scripts/test-shelter-agent.mjs 2>&1 | head -5
```

Expected: `Error: Cannot find module`

- [ ] **Step 3: Implement `workers/scout/agents/shelter.mjs`**

```js
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Antigravity agent: browses OSM Overpass API and official registries for real shelters.
 * @param {string} task - specific instructions from the Orchestrator
 * @param {{ interaction_id?: string, environment_id?: string }} prev
 * @returns {{ interaction_id: string, environment_id: string, data: object }}
 */
export async function runShelterAgent(task, prev = {}) {
  const SYSTEM = `You are a shelter intelligence agent in a crisis. Browse the real web and APIs.
Reply ONLY with valid JSON — no prose, no markdown fences:
{
  "shelters": [
    {
      "name": string,
      "type": "shelter"|"hospital"|"embassy"|"evac_point",
      "address": string,
      "dist_m": number,
      "step_free": boolean,
      "capacity": "open"|"full"|"unknown",
      "coordinates": {"lat": number, "lng": number},
      "source": string
    }
  ]
}`;

  const interaction = await ai.interactions.create({
    agent: "antigravity-preview-05-2026",
    input: `${SYSTEM}\n\nTask: ${task}`,
    environment: prev.environment_id || "remote",
    ...(prev.interaction_id ? { previous_interaction_id: prev.interaction_id } : {}),
  });

  const environment_id = interaction.environment_id || prev.environment_id;
  const data = parseJsonLoose(interaction.output_text || "");

  return { interaction_id: interaction.id, environment_id, data };
}

function parseJsonLoose(text) {
  try { return JSON.parse(text); } catch {}
  const m = String(text).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}
```

- [ ] **Step 4: Run the smoke test with a real API key**

```bash
cd workers && GEMINI_API_KEY=<your_key> node ../scripts/test-shelter-agent.mjs
```

Expected: `shelter agent ok: N shelters, M step-free` with at least one result from Shinjuku area.

- [ ] **Step 5: Commit**

```bash
git add workers/scout/agents/shelter.mjs scripts/test-shelter-agent.mjs
git commit -m "feat(scout): add ShelterAgent (Antigravity) for real OSM shelter data"
```

---

## Task 4: AlertAgent (Antigravity)

**Files:**
- Create: `workers/scout/agents/alert.mjs`

**Interfaces:**
- Consumes: `{ task, prevState: { interaction_id, environment_id } }`
- Produces:
```js
{
  interaction_id: string,
  environment_id: string,
  data: {
    exits_down: string[],
    official_evac_direction: string | null,
    active_alerts: Array<{ source: string, severity: string, message: string, t: string }>,
    transit_status: { service: string, disrupted_lines: string[], message: string }
  }
}
```

- [ ] **Step 1: Write a smoke test**

Create `scripts/test-alert-agent.mjs`:

```js
import { runAlertAgent } from "../workers/scout/agents/alert.mjs";

const result = await runAlertAgent(
  "Check https://www.jma.go.jp/en/quake/ for latest Japan earthquake alerts. Check NHK World https://www3.nhk.or.jp/nhkworld/en/news/ for emergency news. Check Tokyo Metro https://www.tokyometro.jp/en/ for service disruptions. Report any closed exits at Shinjuku station and official evacuation direction.",
  {}
);

console.assert(result.data, "no data returned");
console.assert(Array.isArray(result.data.exits_down), "exits_down not array");
console.assert(Array.isArray(result.data.active_alerts), "active_alerts not array");
console.assert(result.environment_id, "missing environment_id");
console.log("alert agent ok:", JSON.stringify(result.data, null, 2));
```

- [ ] **Step 2: Run it to verify it fails (module not found)**

```bash
cd workers && GEMINI_API_KEY=test node ../scripts/test-alert-agent.mjs 2>&1 | head -5
```

Expected: `Error: Cannot find module`

- [ ] **Step 3: Implement `workers/scout/agents/alert.mjs`**

```js
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Antigravity agent: browses live alert sources (JMA, NHK, transit) for crisis delta.
 * @param {string} task - specific instructions from the Orchestrator
 * @param {{ interaction_id?: string, environment_id?: string }} prev
 * @returns {{ interaction_id: string, environment_id: string, data: object }}
 */
export async function runAlertAgent(task, prev = {}) {
  const SYSTEM = `You are a live crisis alert agent. Browse official alert sources now.
Reply ONLY with valid JSON — no prose, no markdown fences:
{
  "exits_down": string[],
  "official_evac_direction": string | null,
  "active_alerts": [{"source": string, "severity": string, "message": string, "t": string}],
  "transit_status": {"service": string, "disrupted_lines": string[], "message": string}
}`;

  const interaction = await ai.interactions.create({
    agent: "antigravity-preview-05-2026",
    input: `${SYSTEM}\n\nTask: ${task}`,
    environment: prev.environment_id || "remote",
    ...(prev.interaction_id ? { previous_interaction_id: prev.interaction_id } : {}),
  });

  const environment_id = interaction.environment_id || prev.environment_id;
  const data = parseJsonLoose(interaction.output_text || "");

  return { interaction_id: interaction.id, environment_id, data };
}

function parseJsonLoose(text) {
  try { return JSON.parse(text); } catch {}
  const m = String(text).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}
```

- [ ] **Step 4: Run the smoke test**

```bash
cd workers && GEMINI_API_KEY=<your_key> node ../scripts/test-alert-agent.mjs
```

Expected: `alert agent ok:` with JSON containing `exits_down` array and `active_alerts` array.

- [ ] **Step 5: Commit**

```bash
git add workers/scout/agents/alert.mjs scripts/test-alert-agent.mjs
git commit -m "feat(scout): add AlertAgent (Antigravity) for live JMA/NHK/transit alerts"
```

---

## Task 5: OrchestratorAgent

**Files:**
- Create: `workers/scout/orchestrator.mjs`

**Interfaces:**
- Consumes:
```js
{
  city: string,
  country: string,
  user_nationality: string,
  crisis_type: string,
  station: string,
  constraints: string[],
  existing: {            // what we already have — avoids redundant browsing
    has_country_context: boolean,
    shelter_count: number,
    alert_freshness_s: number  // seconds since last alert cycle, Infinity if never
  },
  prevState: { interaction_id?: string }
}
```
- Produces:
```js
{
  interaction_id: string,
  tasks: {
    country_task: string,   // prompt for CountryAgent
    shelter_task: string,   // prompt for ShelterAgent
    alert_task: string      // prompt for AlertAgent
  }
}
```

- [ ] **Step 1: Write a smoke test**

Create `scripts/test-orchestrator.mjs`:

```js
import { runOrchestrator } from "../workers/scout/orchestrator.mjs";

const result = await runOrchestrator({
  city: "Tokyo",
  country: "Japan",
  user_nationality: "French",
  crisis_type: "earthquake",
  station: "Shinjuku",
  constraints: ["child_age_6", "no_stairs"],
  existing: { has_country_context: false, shelter_count: 0, alert_freshness_s: Infinity },
  prevState: {}
});

console.assert(result.tasks?.country_task?.length > 20, "country_task too short");
console.assert(result.tasks?.shelter_task?.length > 20, "shelter_task too short");
console.assert(result.tasks?.alert_task?.length > 20, "alert_task too short");
console.assert(result.tasks.shelter_task.includes("step_free") || result.tasks.shelter_task.includes("stairs"),
  "shelter task must mention constraint");
console.log("orchestrator ok:", JSON.stringify(result.tasks, null, 2));
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd workers && GEMINI_API_KEY=test node ../scripts/test-orchestrator.mjs 2>&1 | head -5
```

Expected: `Error: Cannot find module`

- [ ] **Step 3: Implement `workers/scout/orchestrator.mjs`**

```js
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Stateful Gemini call (no web browsing) that generates precise task prompts
 * for the three Antigravity sub-agents based on the current situation.
 */
export async function runOrchestrator(ctx) {
  const { city, country, user_nationality, crisis_type, station, constraints, existing, prevState } = ctx;

  const prompt =
    `You are the intelligence coordinator for AEGIS, an emergency survival app.\n` +
    `Crisis: ${crisis_type} at ${station}, ${city}, ${country}.\n` +
    `User: ${user_nationality} national, constraints: ${constraints.join(", ")}.\n` +
    `Current data gaps:\n` +
    `- Country context: ${existing.has_country_context ? "already loaded — only refresh if stale" : "MISSING — priority 1"}\n` +
    `- Shelters: ${existing.shelter_count === 0 ? "MISSING — priority 1" : `${existing.shelter_count} loaded`}\n` +
    `- Alerts: ${existing.alert_freshness_s === Infinity ? "MISSING — priority 1" : `${existing.alert_freshness_s}s old`}\n\n` +
    `Generate three web-browsing tasks for specialized agents. Rules:\n` +
    `1. Do NOT hardcode URLs — instruct the agent to FIND the right official source for ${city}, ${country} (e.g. "find the official disaster management authority for ${city} and browse their evacuation site registry").\n` +
    `2. Use city/crisis-specific vocabulary: for Japan earthquake mention 避難場所 (hinan basho) and 指定緊急避難場所; for floods mention water level monitors; adapt to what ${city} actually uses.\n` +
    `3. The shelter task MUST ask for step-free/wheelchair access info (user constraint: no_stairs) and look for the LOCAL type of emergency gathering point (parks in dense Asian cities, schools in Europe, etc.).\n` +
    `4. The country task MUST include: ${user_nationality} embassy emergency line, local emergency numbers, political/safety context specific to ${country} right now, and 5 key survival phrases in the local language.\n` +
    `5. The alert task MUST find real-time crisis data from ${country}'s official meteorological/seismic authority AND local transit status for ${city}.\n\n` +
    `Reply ONLY with JSON — no prose:\n` +
    `{"country_task": string, "shelter_task": string, "alert_task": string}`;

  const body = {
    model: "gemini-3.5-flash",
    input: prompt,
    store: true,
    ...(prevState.interaction_id ? { previous_interaction_id: prevState.interaction_id } : {}),
  };

  const res = await fetch(`${GEMINI_BASE}/interactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`orchestrator ${res.status}: ${await res.text()}`);
  const data = await res.json();

  const text = data.output_text ?? data.outputs?.map(o => o.text ?? "").join("") ?? "";
  const tasks = parseJsonLoose(text);
  if (!tasks?.country_task) throw new Error(`orchestrator bad output: ${text.slice(0, 200)}`);

  return { interaction_id: data.id, tasks };
}

function parseJsonLoose(text) {
  try { return JSON.parse(text); } catch {}
  const m = String(text).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}
```

- [ ] **Step 4: Run the smoke test**

```bash
cd workers && GEMINI_API_KEY=<your_key> node ../scripts/test-orchestrator.mjs
```

Expected: `orchestrator ok:` with three task strings, shelter_task mentioning stairs/step_free.

- [ ] **Step 5: Commit**

```bash
git add workers/scout/orchestrator.mjs scripts/test-orchestrator.mjs
git commit -m "feat(scout): add OrchestratorAgent to dynamically generate sub-agent tasks"
```

---

## Task 6: VerifierAgent

**Files:**
- Create: `workers/scout/verifier.mjs`

**Interfaces:**
- Consumes:
```js
{
  country: PromiseSettledResult<{ data: object }>,
  shelter: PromiseSettledResult<{ data: object }>,
  alert: PromiseSettledResult<{ data: object }>,
  constraints: string[]
}
```
- Produces:
```js
{
  verdict: "ok" | "retry",
  gaps: Array<{ agent: "country"|"shelter"|"alert", field: string, reason: string }>,
  merged: {
    exits_down: string[],
    official_evac_direction: string | null,
    shelters: Array<object>,
    country_context: object | null,
    active_alerts: Array<object>
  }
}
```

- [ ] **Step 1: Write a smoke test**

Create `scripts/test-verifier.mjs`:

```js
import { runVerifier } from "../workers/scout/verifier.mjs";

// Simulate allSettled results
const mockCountry = { status: "fulfilled", value: { data: {
  country: "Japan", city: "Tokyo",
  emergency_numbers: { police: "110", ambulance: "119", fire: "119" },
  embassy: { nationality: "French", address: "4-11-44 Minami-Azabu", phone: "+81-3-5420-8800", emergency_line: "+81-3-5420-8800" },
  key_phrases: [{ local: "助けてください", en: "Help me", romanized: "Tasukete kudasai" }],
  protocols: ["Evacuate to designated shelter"]
}}};

const mockShelter = { status: "fulfilled", value: { data: {
  shelters: [{ name: "Shinjuku Chuo Park", type: "shelter", address: "2-11 Nishi-Shinjuku", dist_m: 600, step_free: true, capacity: "open", coordinates: { lat: 35.694, lng: 139.691 }, source: "OSM" }]
}}};

const mockAlert = { status: "fulfilled", value: { data: {
  exits_down: ["east", "south_stairs"],
  official_evac_direction: "west_concourse",
  active_alerts: [{ source: "JMA", severity: "5+", message: "M5.4 Shinjuku", t: new Date().toISOString() }],
  transit_status: { service: "Tokyo Metro", disrupted_lines: ["Marunouchi"], message: "Service suspended" }
}}};

const result = await runVerifier({
  country: mockCountry,
  shelter: mockShelter,
  alert: mockAlert,
  constraints: ["child_age_6", "no_stairs"]
});

console.assert(result.verdict === "ok", `expected ok, got ${result.verdict}: ${JSON.stringify(result.gaps)}`);
console.assert(result.merged.country_context?.emergency_numbers, "missing emergency numbers in merged");
console.assert(result.merged.shelters?.length > 0, "missing shelters in merged");
console.log("verifier ok:", result.verdict, "gaps:", result.gaps.length);
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd workers && GEMINI_API_KEY=test node ../scripts/test-verifier.mjs 2>&1 | head -5
```

Expected: `Error: Cannot find module`

- [ ] **Step 3: Implement `workers/scout/verifier.mjs`**

```js
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Stateless quality check: merges three agent results and flags gaps.
 * Uses Gemini (non-Antigravity) for semantic checks a regex can't do.
 */
export async function runVerifier({ country, shelter, alert, constraints }) {
  const countryData = country.status === "fulfilled" ? country.value?.data : null;
  const shelterData = shelter.status === "fulfilled" ? shelter.value?.data : null;
  const alertData  = alert.status === "fulfilled"  ? alert.value?.data  : null;

  // Fast structural check — no API call needed for obvious failures
  const structuralGaps = [];
  if (!countryData?.emergency_numbers?.police)
    structuralGaps.push({ agent: "country", field: "emergency_numbers.police", reason: "missing or agent failed" });
  if (!countryData?.embassy?.phone)
    structuralGaps.push({ agent: "country", field: "embassy.phone", reason: "missing or agent failed" });
  if (!shelterData?.shelters?.length)
    structuralGaps.push({ agent: "shelter", field: "shelters", reason: "empty or agent failed" });
  if (!alertData?.exits_down)
    structuralGaps.push({ agent: "alert", field: "exits_down", reason: "missing or agent failed" });

  // If there are structural gaps, skip the LLM call and return immediately
  if (structuralGaps.length) {
    return {
      verdict: "retry",
      gaps: structuralGaps,
      merged: buildMerged(countryData, shelterData, alertData),
    };
  }

  // Semantic check via Gemini: constraint violations and cross-agent coherence
  const hasNoStairs = constraints.includes("no_stairs");
  const prompt =
    `You are a quality checker for emergency survival data. User constraints: ${constraints.join(", ")}.\n\n` +
    `Country data: ${JSON.stringify(countryData)}\n` +
    `Shelter data: ${JSON.stringify(shelterData)}\n` +
    `Alert data: ${JSON.stringify(alertData)}\n\n` +
    `Check for:\n` +
    `1. Shelters listed as step_free=true that actually have stairs (if described)\n` +
    `2. Embassy address in a different city from the crisis location\n` +
    `3. Emergency numbers that look wrong for the country\n` +
    (hasNoStairs ? `4. At least one step_free=true shelter must exist (no_stairs constraint)\n` : "") +
    `Reply ONLY with JSON: {"verdict": "ok"|"retry", "gaps": [{"agent": "country"|"shelter"|"alert", "field": string, "reason": string}]}`;

  const res = await fetch(`${GEMINI_BASE}/models/gemini-3.5-flash:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) {
    // Verifier failure must never kill the loop — return what we have as "ok"
    console.error(`verifier api error ${res.status} — skipping semantic check`);
    return { verdict: "ok", gaps: [], merged: buildMerged(countryData, shelterData, alertData) };
  }

  const raw = await res.json();
  const text = raw.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const check = parseJsonLoose(text) ?? { verdict: "ok", gaps: [] };

  return {
    verdict: check.verdict || "ok",
    gaps: check.gaps || [],
    merged: buildMerged(countryData, shelterData, alertData),
  };
}

function buildMerged(countryData, shelterData, alertData) {
  return {
    exits_down: alertData?.exits_down ?? [],
    official_evac_direction: alertData?.official_evac_direction ?? null,
    shelters: shelterData?.shelters ?? [],
    country_context: countryData ?? null,
    active_alerts: alertData?.active_alerts ?? [],
  };
}

function parseJsonLoose(text) {
  try { return JSON.parse(text); } catch {}
  const m = String(text).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}
```

- [ ] **Step 4: Run the smoke test**

```bash
cd workers && GEMINI_API_KEY=<your_key> node ../scripts/test-verifier.mjs
```

Expected: `verifier ok: ok gaps: 0`

- [ ] **Step 5: Commit**

```bash
git add workers/scout/verifier.mjs scripts/test-verifier.mjs
git commit -m "feat(scout): add VerifierAgent for quality check and gap detection"
```

---

## Task 7: Refactor scout.mjs — loop driver

**Files:**
- Modify: `workers/scout/scout.mjs` (full rewrite)
- Create: `workers/scout/scout-state.json` (initial empty state)
- Create: `scripts/test-scout-swarm.mjs` (integration smoke test)

**Interfaces:**
- Consumes: env vars `GEMINI_API_KEY`, `KEEPER_URL`, `SESSION`, `COUNTRY`, `CITY`, `USER_NATIONALITY`
- Produces: `POST /event?session=<SESSION>` to Keeper with `{ type: "delta_update", payload: merged, src: "scout" }`

- [ ] **Step 1: Write the integration smoke test**

Create `scripts/test-scout-swarm.mjs`:

```js
/**
 * Integration smoke test: run one scout cycle and verify the Keeper received a delta_update.
 * Requires a running Keeper at KEEPER_URL and a valid GEMINI_API_KEY.
 */
const KEEPER = process.env.KEEPER_URL || "http://localhost:8787";
const SESSION = process.env.SESSION || "demo";

// Snapshot state before
const before = await (await fetch(`${KEEPER}/api/state?session=${SESSION}`)).json();

// Run one cycle
const { cycle } = await import("../workers/scout/scout.mjs");
await cycle();

// Snapshot state after
const after = await (await fetch(`${KEEPER}/api/state?session=${SESSION}`)).json();

console.assert(after.live_delta.as_of !== before.live_delta.as_of || after.country_context !== null,
  "Keeper state unchanged after scout cycle");
console.assert(after.country_context?.emergency_numbers || after.live_delta.shelters?.length > 0,
  "no real data landed in Keeper");
console.log("scout swarm integration ok");
console.log("shelters:", after.live_delta.shelters?.length ?? 0);
console.log("alerts:", after.active_alerts?.length ?? 0);
console.log("country:", after.country_context?.country ?? "none");
```

- [ ] **Step 2: Create the initial state file**

Create `workers/scout/scout-state.json`:

```json
{
  "orchestrator": { "interaction_id": null },
  "country": { "interaction_id": null, "environment_id": null },
  "shelter": { "interaction_id": null, "environment_id": null },
  "alert": { "interaction_id": null, "environment_id": null }
}
```

- [ ] **Step 3: Add `scout-state.json` to .gitignore**

In the repo root `.gitignore`, add:

```
workers/scout/scout-state.json
```

- [ ] **Step 4: Rewrite `workers/scout/scout.mjs`**

```js
/**
 * AEGIS Scout v2 — multi-agent swarm loop driver.
 *
 * Each cycle:
 *   1. OrchestratorAgent decides task prompts from live Situation Object context.
 *   2. CountryAgent, ShelterAgent, AlertAgent run in parallel (15s timeout each).
 *   3. VerifierAgent checks quality; retries one failing agent if verdict=retry.
 *   4. Emit enriched delta_update to Keeper.
 *
 * Run one cycle:   node scout.mjs
 * Run demo loop:   node scout.mjs --loop   (cycles every 30s)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { runOrchestrator } from "./orchestrator.mjs";
import { runCountryAgent } from "./agents/country.mjs";
import { runShelterAgent } from "./agents/shelter.mjs";
import { runAlertAgent } from "./agents/alert.mjs";
import { runVerifier } from "./verifier.mjs";

const KEEPER    = process.env.KEEPER_URL || "http://localhost:8787";
const SESSION   = process.env.SESSION || "demo";
const COUNTRY   = process.env.COUNTRY || "Japan";
const CITY      = process.env.CITY || "Tokyo";
const USER_NAT  = process.env.USER_NATIONALITY || "French";
const AGENT_TIMEOUT_MS = 15_000;
const CYCLE_INTERVAL_MS = 30_000;
const STATE_FILE = new URL("./scout-state.json", import.meta.url).pathname;

function loadState() {
  if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  return {
    orchestrator: { interaction_id: null },
    country:      { interaction_id: null, environment_id: null },
    shelter:      { interaction_id: null, environment_id: null },
    alert:        { interaction_id: null, environment_id: null },
  };
}

function saveState(s) {
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

async function keeperState() {
  const res = await fetch(`${KEEPER}/api/state?session=${SESSION}`);
  return res.ok ? res.json() : null;
}

async function emit(payload) {
  await fetch(`${KEEPER}/event?session=${SESSION}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "delta_update", payload, src: "scout" }),
  });
  console.log("→ delta_update emitted:", {
    shelters: payload.shelters?.length ?? 0,
    alerts: payload.active_alerts?.length ?? 0,
    country: payload.country_context?.country ?? "none",
  });
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)),
  ]);
}

export async function cycle() {
  const state = loadState();

  // Fetch current Situation Object for context
  const situation = await keeperState();
  const alertFreshnessS = situation?.live_delta?.as_of
    ? (Date.now() - new Date(situation.live_delta.as_of).getTime()) / 1000
    : Infinity;

  console.log("cycle start — fetching tasks from orchestrator...");

  // 1. Orchestrator
  const orchResult = await runOrchestrator({
    city: CITY,
    country: COUNTRY,
    user_nationality: USER_NAT,
    crisis_type: situation?.event?.type || "earthquake",
    station: situation?.user?.location?.station || "Shinjuku",
    constraints: situation?.user?.constraints || ["no_stairs"],
    existing: {
      has_country_context: !!situation?.country_context,
      shelter_count: situation?.live_delta?.shelters?.length ?? 0,
      alert_freshness_s: alertFreshnessS,
    },
    prevState: state.orchestrator,
  });
  state.orchestrator.interaction_id = orchResult.interaction_id;
  const { tasks } = orchResult;
  console.log("orchestrator tasks:", Object.keys(tasks).join(", "));

  // 2. Parallel sub-agents (15s timeout each)
  console.log("running 3 Antigravity agents in parallel...");
  const [countryResult, shelterResult, alertResult] = await Promise.allSettled([
    withTimeout(runCountryAgent(tasks.country_task, state.country), AGENT_TIMEOUT_MS),
    withTimeout(runShelterAgent(tasks.shelter_task, state.shelter), AGENT_TIMEOUT_MS),
    withTimeout(runAlertAgent(tasks.alert_task, state.alert), AGENT_TIMEOUT_MS),
  ]);

  // Persist environment IDs from successful runs
  if (countryResult.status === "fulfilled") {
    state.country.interaction_id = countryResult.value.interaction_id;
    state.country.environment_id = countryResult.value.environment_id;
  } else {
    console.warn("country agent failed:", countryResult.reason?.message);
  }
  if (shelterResult.status === "fulfilled") {
    state.shelter.interaction_id = shelterResult.value.interaction_id;
    state.shelter.environment_id = shelterResult.value.environment_id;
  } else {
    console.warn("shelter agent failed:", shelterResult.reason?.message);
  }
  if (alertResult.status === "fulfilled") {
    state.alert.interaction_id = alertResult.value.interaction_id;
    state.alert.environment_id = alertResult.value.environment_id;
  } else {
    console.warn("alert agent failed:", alertResult.reason?.message);
  }

  // 3. Verify
  const verified = await runVerifier({
    country: countryResult,
    shelter: shelterResult,
    alert: alertResult,
    constraints: situation?.user?.constraints || ["no_stairs"],
  });
  console.log(`verifier: ${verified.verdict}, gaps: ${verified.gaps.length}`);

  // 4. One targeted retry for flagged gaps (max 1 per cycle to stay within 30s budget)
  if (verified.verdict === "retry" && verified.gaps.length > 0) {
    const gapAgent = verified.gaps[0].agent;
    console.log(`retrying ${gapAgent} agent for gap: ${verified.gaps[0].field}`);
    try {
      if (gapAgent === "country") {
        const r = await withTimeout(runCountryAgent(tasks.country_task, state.country), AGENT_TIMEOUT_MS);
        state.country.interaction_id = r.interaction_id;
        state.country.environment_id = r.environment_id;
        verified.merged.country_context = r.data;
      } else if (gapAgent === "shelter") {
        const r = await withTimeout(runShelterAgent(tasks.shelter_task, state.shelter), AGENT_TIMEOUT_MS);
        state.shelter.interaction_id = r.interaction_id;
        state.shelter.environment_id = r.environment_id;
        verified.merged.shelters = r.data?.shelters ?? verified.merged.shelters;
      } else if (gapAgent === "alert") {
        const r = await withTimeout(runAlertAgent(tasks.alert_task, state.alert), AGENT_TIMEOUT_MS);
        state.alert.interaction_id = r.interaction_id;
        state.alert.environment_id = r.environment_id;
        verified.merged.exits_down = r.data?.exits_down ?? verified.merged.exits_down;
        verified.merged.active_alerts = r.data?.active_alerts ?? verified.merged.active_alerts;
      }
    } catch (err) {
      console.warn(`retry for ${gapAgent} also failed:`, err.message);
    }
  }

  // 5. Emit to Keeper — always emit what we have, even partial
  await emit(verified.merged);
  saveState(state);
}

if (process.argv.includes("--loop")) {
  while (true) {
    await cycle().catch(e => console.error("cycle error:", e.message));
    await new Promise(r => setTimeout(r, CYCLE_INTERVAL_MS));
  }
} else {
  await cycle();
}
```

- [ ] **Step 5: Run the integration test (requires local Keeper + real API key)**

```bash
# Terminal 1: start Keeper
cd keeper && echo 'GEMINI_API_KEY=<your_key>' > .dev.vars && npx wrangler dev &

# Terminal 2: run integration test
cd workers && GEMINI_API_KEY=<your_key> KEEPER_URL=http://localhost:8787 node ../scripts/test-scout-swarm.mjs
```

Expected: `scout swarm integration ok` with non-zero shelters or a country populated.

- [ ] **Step 6: Commit**

```bash
git add workers/scout/scout.mjs workers/scout/scout-state.json scripts/test-scout-swarm.mjs .gitignore
git commit -m "feat(scout): replace mock scout with 4-agent swarm (orchestrator + 3 Antigravity + verifier)"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|---|---|
| Orchestrator decides tasks from live Situation Object | Task 5 |
| 3 parallel Antigravity sub-agents with real web browsing | Tasks 2, 3, 4 |
| Each sub-agent resumes own sandbox via `environment_id` | Tasks 2, 3, 4 (persisted per-agent in state) |
| Verifier checks quality + flags gaps | Task 6 |
| Retry loop for gaps (1x per cycle) | Task 7, step 4 |
| 15s timeout per agent — never block the loop | Task 7 (`withTimeout`) |
| Keeper receives enriched `delta_update` with `country_context` and `active_alerts` | Tasks 1, 7 |
| Demo defaults: Tokyo/Shinjuku earthquake, French/Maria | All tasks (env var defaults) |

### Placeholder scan

No TBDs. All code blocks are complete. All test assertions use exact field names matching their producing task.

### Type consistency

- `runCountryAgent`, `runShelterAgent`, `runAlertAgent` all return `{ interaction_id, environment_id, data }` — consistent across Tasks 2-4 and consumed identically in Task 7.
- `runVerifier` consumes `PromiseSettledResult` from `Promise.allSettled` — matches Task 7's `Promise.allSettled([...])` output.
- `delta_update` payload fields (`country_context`, `active_alerts`, `shelters`, `exits_down`) match Keeper handler added in Task 1.
- `scout-state.json` shape matches what `loadState()` / `saveState()` expect in Task 7.

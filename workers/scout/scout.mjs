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

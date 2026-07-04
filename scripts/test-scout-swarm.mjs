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

#!/usr/bin/env node
// Cross-platform demo driver (Windows-friendly, no bash/curl needed).
// Drives the whole AEGIS story WITHOUT any Gemini worker — it exercises the
// Keeper, the WebSocket push, the client cache and the offline handoff in
// isolation, using the Keeper's built-in deterministic guidance.
//
//   node scripts/fake-events.mjs [keeper-url] [session]
//   node scripts/fake-events.mjs http://localhost:8787 demo
//
// Add --fast to skip the pauses (drives everything in ~1s for CI/health checks).

const KEEPER = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "http://localhost:8787";
const SESSION = process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3] : "demo";
const FAST = process.argv.includes("--fast");

const sleep = (ms) => new Promise((r) => setTimeout(r, FAST ? 60 : ms));

async function post(type, payload) {
  const body = JSON.stringify({ type, payload, src: "demo", t: new Date().toISOString() });
  const res = await fetch(`${KEEPER}/event?session=${SESSION}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body,
  });
  const ok = res.ok ? "✓" : `✗ ${res.status}`;
  console.log(`  ${ok}  ${type}`);
  if (!res.ok) console.log("       " + (await res.text()).slice(0, 160));
}

async function reset() {
  await fetch(`${KEEPER}/api/reset?session=${SESSION}`, { method: "POST" }).catch(() => {});
}

async function main() {
  console.log(`\n  AEGIS demo → ${KEEPER}  (session: ${SESSION})\n`);

  console.log("— reset —");
  await reset();
  await sleep(800);

  console.log("\n[1] Maria arrives in Shinjuku");
  await post("set_location", { lat: 35.6896, lng: 139.7006, accuracy_m: 8, place: "Shinjuku, Tokyo", source: "device_gps" });
  await sleep(1600);

  console.log("\n[2] Earthquake — the JMA Early Warning fires (in Japanese)");
  await post("quake", { magnitude: "5+" });
  await sleep(1800);

  console.log("\n[3] Listener hears the station PA and translates it");
  await post("pa_translation", { ja: "西口へ避難してください。係員の指示に従ってください。", en: "Evacuate via the west exit. Follow staff instructions.", src: "PA" });
  await sleep(1800);

  console.log("\n[4] Eyes reads a closed-exit sign");
  await post("sign_read", { ja: "この出口閉鎖", en: "This exit is closed", type: "exit_closed" });
  await sleep(1800);

  console.log("\n[5] Scout grabs the live disruption delta — exits down, shelters ranked");
  await post("delta_update", {
    exits_down: ["east", "south_stairs"],
    official_evac_direction: "west_concourse",
    environment_id: "env_demo_" + SESSION,
    shelters: [
      { name: "Shinjuku Chuo Park", lat: 35.6907, lng: 139.6917, capacity: "open", dist_m: 600, step_free: true },
      { name: "Shinjuku Elementary School", lat: 35.6938, lng: 139.7034, capacity: "open", dist_m: 450, step_free: false },
      { name: "Yoyogi Community Hall", lat: 35.6830, lng: 139.7020, capacity: "full", dist_m: 1200, step_free: true },
      { name: "Okubo Sports Center", lat: 35.7009, lng: 139.7086, capacity: "open", dist_m: 900, step_free: true },
    ],
  });
  await sleep(1200);

  const state = await fetch(`${KEEPER}/api/state?session=${SESSION}`).then((r) => r.json()).catch(() => null);
  console.log("\n— situation object —");
  if (state) {
    console.log("  guidance :", state.guidance?.action, "·", state.guidance?.headline || state.guidance?.current_instruction_en);
    console.log("  route    :", state.route ? `${state.route.target} · ${state.route.distance_m}m · ${Math.round((state.route.duration_s || 0) / 60)}min` : "—");
    console.log("  shelters :", (state.live_delta?.shelters || []).length, "· hospitals:", (state.live_delta?.hospitals || []).length);
  }
  console.log("\n  On the phone: watch the feed fill → destination appear → then hit");
  console.log("  \"Cut the network\" and ask AEGIS a question. It keeps guiding.\n");
}

main().catch((e) => { console.error(e); process.exit(1); });

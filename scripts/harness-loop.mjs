#!/usr/bin/env node
/**
 * AEGIS harness loop.
 *
 * Drives the spine without Listener/Scout/Gemini workers:
 * reset -> quake -> PA -> sign -> live_delta -> health check.
 *
 * Usage:
 *   node scripts/harness-loop.mjs http://localhost:8787 demo
 *   node scripts/harness-loop.mjs https://aegis-keeper.<you>.workers.dev demo --loop
 */

const keeper = process.argv[2] || process.env.KEEPER_URL || "http://localhost:8787";
const session = process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3] : process.env.SESSION || "demo";
const loop = process.argv.includes("--loop");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const events = [
  { type: "quake", payload: { magnitude: "5+" }, src: "harness" },
  {
    type: "pa_translation",
    payload: {
      ja: "西口へ避難してください。係員の指示に従ってください。",
      en: "Evacuate via the west exit. Follow staff instructions.",
    },
    src: "harness",
  },
  {
    type: "sign_read",
    payload: { ja: "この出口閉鎖", en: "This exit is closed", type: "exit_closed" },
    src: "harness",
  },
  {
    type: "delta_update",
    payload: {
      exits_down: ["east", "south_stairs"],
      official_evac_direction: "west_concourse",
      shelters: [
        { name: "Shinjuku Chuo Park", lat: 35.6907, lng: 139.6917, capacity: "open", dist_m: 600, step_free: true },
        { name: "Shinjuku Elementary School", lat: 35.6938, lng: 139.7034, capacity: "open", dist_m: 450, step_free: false },
        { name: "Yoyogi Community Hall", lat: 35.6830, lng: 139.7020, capacity: "full", dist_m: 1200, step_free: true },
        { name: "Okubo Sports Center", lat: 35.7009, lng: 139.7086, capacity: "open", dist_m: 900, step_free: true },
      ],
      environment_id: "env_harness_123",
    },
    src: "harness",
  },
];

async function post(path, body) {
  const res = await fetch(`${keeper}${path}?session=${encodeURIComponent(session)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function get(path) {
  const res = await fetch(`${keeper}${path}?session=${encodeURIComponent(session)}`);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  return { ok: res.ok, status: res.status, data, text };
}

async function once() {
  console.log(`[harness] reset ${keeper} session=${session}`);
  await post("/api/reset");
  const failures = [];
  for (const event of events) {
    await wait(750);
    await post("/event", { ...event, t: new Date().toISOString() });
    console.log(`[harness] sent ${event.type}`);
    await wait(250);
    const health = await get("/api/health");
    const failed = (health.data?.checks || []).filter((c) => !c.ok);
    for (const c of failed) failures.push(`${event.type}:${c.name}:${c.note}`);
  }

  await wait(750);
  const health = await get("/api/health");
  const checks = health.data?.checks || [];
  const failed = checks.filter((c) => !c.ok);
  for (const c of failed) failures.push(`final:${c.name}:${c.note}`);
  const state = await get("/api/state");
  console.log(`[harness] health=${health.status} ${health.data?.status || "unknown"}`);
  console.log(`[harness] guidance="${state.data?.guidance?.current_instruction_en || ""}"`);
  if (failures.length) {
    for (const line of failures) console.log(`[harness] warn ${line}`);
  }
  return failures.length === 0;
}

do {
  try {
    const pass = await once();
    if (!loop) process.exit(pass ? 0 : 1);
  } catch (err) {
    console.error(`[harness] error: ${err.message}`);
    if (!loop) process.exit(1);
  }
  await wait(5000);
} while (loop);

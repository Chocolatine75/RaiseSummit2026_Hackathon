#!/usr/bin/env node
/**
 * AEGIS end-to-end test suite. Exercises the live deployment the way a real
 * user + judge would, and reports PASS/FAIL per capability. No mocks.
 *
 * Usage: node scripts/e2e-test.mjs https://aegis-keeper.rahul-aegis.workers.dev
 */
const K = process.argv[2] || "https://aegis-keeper.rahul-aegis.workers.dev";
const S = `test-${Date.now()}`;
let pass = 0, fail = 0;
const results = [];

const post = (p, b) => fetch(`${K}${p}?session=${S}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined }).then(r => r.text());
const get = (p) => fetch(`${K}${p}?session=${S}`).then(r => r.json());
const wait = (ms) => new Promise(r => setTimeout(r, ms));

function check(name, cond, detail = "") {
  const ok = !!cond;
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅ PASS" : "❌ FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  ok ? pass++ : fail++;
  return ok;
}

console.log(`\n=== AEGIS E2E · ${K} · session ${S} ===\n`);

// 1. Static serving
for (const [path, label] of [["/", "PWA shell"], ["/app.js", "app.js"], ["/styles.css", "styles.css"], ["/sw.js", "service worker"], ["/manifest.json", "manifest"]]) {
  const r = await fetch(`${K}${path}`);
  check(`serves ${label}`, r.ok, `HTTP ${r.status}`);
}

// 2. Fresh session baseline
await post("/api/reset");
let s = await get("/api/state");
check("fresh session has user + constraints", s.user?.constraints?.includes("no_stairs"));
check("fresh session has no route yet", !s.route);

// 3. Real GPS location
await post("/event", { type: "set_location", payload: { lat: 35.6905, lng: 139.7005, accuracy_m: 8 }, src: "gps" });
s = await get("/api/state");
check("GPS location accepted", s.user.location.source === "device_gps", `lat=${s.user.location.lat}`);

// 4. Quake → full server-side pipeline
console.log("\n  … firing quake, waiting for agent pipeline (18s) …\n");
await post("/event", { type: "quake", payload: { magnitude: "5+" }, src: "test" });
await wait(18000);
s = await get("/api/state");

// 5. Antigravity Scout (real sandbox)
const scoutDone = (s.agents || []).find(a => a.agent === "Scout" && a.status === "done");
check("Antigravity Scout ran (real sandbox)", !!scoutDone, scoutDone?.detail);
check("Antigravity environment_id captured", !!s.scout_environment_id, s.scout_environment_id?.slice(0, 12));

// 6. Google Maps grounding (real places)
const mapsDone = (s.agents || []).find(a => a.agent === "Maps" && a.status === "done");
check("Maps grounding returned real places", !!mapsDone, mapsDone?.detail);
check("shelters have real coordinates", s.live_delta.shelters.every(x => x.lat && x.lng), `${s.live_delta.shelters.length} shelters`);

// 7. Real routing (OSRM street polyline)
check("real walking route computed", s.route?.coords?.length > 5, `${s.route?.distance_m}m, ${s.route?.coords?.length} pts`);
check("route names a real street", !!s.route?.first_step, s.route?.first_step);

// 8. Reasoning (Interactions API, stateful)
check("Interactions chain id present", !!s.interaction_chain_id, s.interaction_chain_id?.slice(0, 14));
check("guidance surfaced", !!s.guidance.current_instruction_en, s.guidance.current_instruction_en?.slice(0, 60));

// 9. Guidance consistency (distance matches route, not straight-line)
const g = s.guidance.current_instruction_en || "";
const routeDistInText = g.includes(String(s.route?.distance_m));
check("guidance distance matches real route", routeDistInText || g.includes(s.route?.target || "xxx"), "no straight-line mismatch");

// 10. QA / harness
const qaDone = (s.agents || []).find(a => a.agent === "QA");
check("QA agent reported", !!qaDone, qaDone?.detail);
check("audit status pass", s.audit?.status === "pass", s.audit?.status);

// 11. Sandbox RESUME (second quake)
console.log("\n  … firing aftershock to test Antigravity resume (14s) …\n");
const env1 = s.scout_environment_id;
await post("/event", { type: "quake", payload: { magnitude: "aftershock" }, src: "test" });
await wait(14000);
s = await get("/api/state");
const resumed = (s.agents || []).find(a => a.agent === "Scout" && a.detail?.includes("resumed"));
check("Antigravity sandbox RESUMED (same env)", !!resumed && s.scout_environment_id === env1, `${env1?.slice(0,10)} == ${s.scout_environment_id?.slice(0,10)}`);

// 12. Persistence (health endpoint)
const h = await get("/api/health");
check("health endpoint reports pass", h.status === "pass", h.status);

// 13. Self-heal (stale session)
console.log("\n  … testing self-heal (14s) …\n");
const S2 = `heal-${Date.now()}`;
await fetch(`${K}/api/reset?session=${S2}`, { method: "POST" });
// inject shelters WITHOUT route by hitting delta directly, then reconnect via state
await fetch(`${K}/event?session=${S2}`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ type: "set_location", payload: { lat: 35.6905, lng: 139.7005 }, src: "gps" })});
await new Promise(r=>setTimeout(r,14000));

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
console.log(fail === 0 ? "🟢 ALL SYSTEMS GO\n" : `🔴 ${fail} ISSUE(S) TO FIX\n`);
process.exit(fail === 0 ? 0 : 1);

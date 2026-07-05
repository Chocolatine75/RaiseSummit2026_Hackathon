// Self-contained demo situation. Loaded automatically when the app can't reach
// the Keeper AND has nothing cached, so the whole experience is explorable with
// zero backend (the on-device Gemma path still runs for real). The live
// WebSocket, when a Keeper IS running, overwrites this immediately.
export function buildDemoSituation() {
  const now = () => new Date().toISOString();
  return {
    demo: true,
    user: { name: "Maria", language: "en", location: { station: "Shinjuku", lat: 35.6896, lng: 139.7006 }, constraints: [] },
    event: { type: "earthquake", magnitude: "5+" },
    guidance: {
      action: "GO TO SHELTER",
      headline: "Head to Shinjuku Chuo Park",
      current_instruction_en: "Move to Shinjuku Chuo Park, 600 m away, about 8 min on foot. Follow wide streets, avoid glass.",
      next_question: "Are you safe and moving toward the shelter?",
      needs_tap: true, confirmed: false,
    },
    route: {
      target: "Shinjuku Chuo Park", distance_m: 600, duration_s: 480, first_step: "Ome Kaido",
      coords: [[35.6896, 139.7006], [35.6905, 139.6975], [35.6915, 139.6948], [35.6924, 139.6931]],
    },
    live_delta: {
      as_of: now(),
      shelters: [
        { name: "Shinjuku Chuo Park", dist_m: 600, step_free: true, lat: 35.6924, lng: 139.6931, why: ["step-free", "open now", "large capacity"] },
        { name: "Okubo Park", dist_m: 850, step_free: true, lat: 35.7017, lng: 139.6976, why: ["open now"] },
      ],
      hospitals: [{ name: "Tokyo Medical University Hospital", dist_m: 950, lat: 35.6889, lng: 139.6931, open: true }],
    },
    environment: [
      { src: "PA", ja: "揺れに注意してください。落ち着いて避難してください。", en: "Beware of shaking. Please evacuate calmly.", t: now() },
    ],
    agents: [
      { agent: "Listener", status: "done", detail: "Translated station PA → English" },
      { agent: "Scout", status: "done", detail: "Resumed env, fetched live disruption delta" },
      { agent: "Maps", status: "done", detail: "3 shelters, 1 hospital grounded" },
      { agent: "Router", status: "done", detail: "OSRM step-free route, 8 min" },
      { agent: "QA", status: "done", detail: "Guidance verified, no invented exits" },
    ],
    network: { online: false },
    timing: { last_reason_ms: 65 },
  };
}

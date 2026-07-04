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

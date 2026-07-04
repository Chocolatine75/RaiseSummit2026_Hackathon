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

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

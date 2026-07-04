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

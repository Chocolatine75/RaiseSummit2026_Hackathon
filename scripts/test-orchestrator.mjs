import { runOrchestrator } from "../workers/scout/orchestrator.mjs";

const result = await runOrchestrator({
  city: "Tokyo",
  country: "Japan",
  user_nationality: "French",
  crisis_type: "earthquake",
  station: "Shinjuku",
  constraints: ["child_age_6", "no_stairs"],
  existing: { has_country_context: false, shelter_count: 0, alert_freshness_s: Infinity },
  prevState: {}
});

console.assert(result.tasks?.country_task?.length > 20, "country_task too short");
console.assert(result.tasks?.shelter_task?.length > 20, "shelter_task too short");
console.assert(result.tasks?.alert_task?.length > 20, "alert_task too short");
console.assert(result.tasks.shelter_task.includes("step_free") || result.tasks.shelter_task.includes("stairs"),
  "shelter task must mention constraint");
console.log("orchestrator ok:", JSON.stringify(result.tasks, null, 2));

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
const accessibilityTerms = ["step_free", "step-free", "stairs", "wheelchair", "accessible", "ramp", "elevator", "no_stairs"];
console.assert(
  accessibilityTerms.some(term => result.tasks.shelter_task.toLowerCase().includes(term)),
  "shelter task must mention accessibility constraint"
);
console.log("orchestrator ok:", JSON.stringify(result.tasks, null, 2));

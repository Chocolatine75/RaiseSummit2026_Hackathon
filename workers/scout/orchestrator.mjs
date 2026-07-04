const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Stateful Gemini call (no web browsing) that generates precise task prompts
 * for the three Antigravity sub-agents based on the current situation.
 * @param {{ city, country, user_nationality, crisis_type, station, constraints, existing, prevState }} ctx
 * @returns {{ interaction_id: string, tasks: { country_task, shelter_task, alert_task } }}
 */
export async function runOrchestrator(ctx) {
  const { city, country, user_nationality, crisis_type, station, constraints, existing, prevState } = ctx;

  const prompt =
    `You are the intelligence coordinator for AEGIS, an emergency survival app.\n` +
    `Crisis: ${crisis_type} at ${station}, ${city}, ${country}.\n` +
    `User: ${user_nationality} national, constraints: ${constraints.join(", ")}.\n` +
    `Current data gaps:\n` +
    `- Country context: ${existing.has_country_context ? "already loaded — only refresh if stale" : "MISSING — priority 1"}\n` +
    `- Shelters: ${existing.shelter_count === 0 ? "MISSING — priority 1" : `${existing.shelter_count} loaded`}\n` +
    `- Alerts: ${existing.alert_freshness_s === Infinity ? "MISSING — priority 1" : `${existing.alert_freshness_s}s old`}\n\n` +
    `Generate three web-browsing tasks for specialized agents. Rules:\n` +
    `1. Do NOT hardcode URLs — instruct the agent to FIND the right official source for ${city}, ${country} (e.g. "find the official disaster management authority for ${city} and browse their evacuation site registry").\n` +
    `2. Use city/crisis-specific vocabulary: for Japan earthquake mention 避難場所 (hinan basho) and 指定緊急避難場所; for floods mention water level monitors; adapt to what ${city} actually uses.\n` +
    `3. The shelter task MUST ask for step-free/wheelchair access info (user constraint: no_stairs) and look for the LOCAL type of emergency gathering point (parks in dense Asian cities, schools in Europe, etc.).\n` +
    `4. The country task MUST include: ${user_nationality} embassy emergency line, local emergency numbers, political/safety context specific to ${country} right now, and 5 key survival phrases in the local language.\n` +
    `5. The alert task MUST find real-time crisis data from ${country}'s official meteorological/seismic authority AND local transit status for ${city}.\n\n` +
    `Reply ONLY with JSON — no prose:\n` +
    `{"country_task": string, "shelter_task": string, "alert_task": string}`;

  const body = {
    model: "gemini-2.5-flash",
    input: prompt,
    store: true,
    ...(prevState.interaction_id ? { previous_interaction_id: prevState.interaction_id } : {}),
  };

  const res = await fetch(`${GEMINI_BASE}/interactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`orchestrator ${res.status}: ${await res.text()}`);
  const data = await res.json();

  const fromSteps = (data.steps ?? [])
    .filter(st => st.type === "model_output")
    .flatMap(st => st.content ?? [])
    .filter(c => c.type === "text")
    .map(c => c.text)
    .join("");
  const text = fromSteps || data.output_text || "";
  if (!text) {
    data.steps?.forEach((s, i) => console.error(`step[${i}]:`, JSON.stringify(s).slice(0, 300)));
    throw new Error(`orchestrator empty output — check model name / API key`);
  }
  const tasks = parseJsonLoose(text);
  if (!tasks?.country_task) throw new Error(`orchestrator bad output: ${text.slice(0, 200)}`);

  return { interaction_id: data.id, tasks };
}

function parseJsonLoose(text) {
  try { return JSON.parse(text); } catch {}
  const m = String(text).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

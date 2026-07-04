const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Stateless quality check: merges three agent results and flags gaps.
 * Uses Gemini (non-Antigravity) for semantic checks a regex can't do.
 */
export async function runVerifier({ country, shelter, alert, constraints }) {
  const countryData = country.status === "fulfilled" ? country.value?.data : null;
  const shelterData = shelter.status === "fulfilled" ? shelter.value?.data : null;
  const alertData  = alert.status === "fulfilled"  ? alert.value?.data  : null;

  // Fast structural check — no API call needed for obvious failures
  const structuralGaps = [];
  if (!countryData?.emergency_numbers?.police)
    structuralGaps.push({ agent: "country", field: "emergency_numbers.police", reason: "missing or agent failed" });
  if (!countryData?.embassy?.phone)
    structuralGaps.push({ agent: "country", field: "embassy.phone", reason: "missing or agent failed" });
  if (!shelterData?.shelters?.length)
    structuralGaps.push({ agent: "shelter", field: "shelters", reason: "empty or agent failed" });
  if (!alertData?.exits_down)
    structuralGaps.push({ agent: "alert", field: "exits_down", reason: "missing or agent failed" });

  // If there are structural gaps, skip the LLM call and return immediately
  if (structuralGaps.length) {
    return {
      verdict: "retry",
      gaps: structuralGaps,
      merged: buildMerged(countryData, shelterData, alertData),
    };
  }

  // Semantic check via Gemini: constraint violations and cross-agent coherence
  const hasNoStairs = constraints.includes("no_stairs");
  const prompt =
    `You are a quality checker for emergency survival data. User constraints: ${constraints.join(", ")}.\n\n` +
    `Country data: ${JSON.stringify(countryData)}\n` +
    `Shelter data: ${JSON.stringify(shelterData)}\n` +
    `Alert data: ${JSON.stringify(alertData)}\n\n` +
    `Check for:\n` +
    `1. Shelters listed as step_free=true that actually have stairs (if described)\n` +
    `2. Embassy address in a different city from the crisis location\n` +
    `3. Emergency numbers that look wrong for the country\n` +
    (hasNoStairs ? `4. At least one step_free=true shelter must exist (no_stairs constraint)\n` : "") +
    `Reply ONLY with JSON: {"verdict": "ok"|"retry", "gaps": [{"agent": "country"|"shelter"|"alert", "field": string, "reason": string}]}`;

  let res;
  try {
    res = await fetch(`${GEMINI_BASE}/models/gemini-3.5-flash:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
  } catch (err) {
    // Network error — verifier failure must never crash the loop
    console.error(`verifier fetch error — skipping semantic check: ${err.message}`);
    return { verdict: "ok", gaps: [], merged: buildMerged(countryData, shelterData, alertData) };
  }

  if (!res.ok) {
    // API error — return what we have as "ok" so the loop continues
    console.error(`verifier api error ${res.status} — skipping semantic check`);
    return { verdict: "ok", gaps: [], merged: buildMerged(countryData, shelterData, alertData) };
  }

  let check = { verdict: "ok", gaps: [] };
  try {
    const raw = await res.json();
    const text = raw.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    check = parseJsonLoose(text) ?? { verdict: "ok", gaps: [] };
  } catch (err) {
    console.error(`verifier json parse error — skipping semantic check: ${err.message}`);
  }
  return {
    verdict: check.verdict || "ok",
    gaps: check.gaps || [],
    merged: buildMerged(countryData, shelterData, alertData),
  };
}

function buildMerged(countryData, shelterData, alertData) {
  return {
    exits_down: alertData?.exits_down ?? [],
    official_evac_direction: alertData?.official_evac_direction ?? null,
    shelters: shelterData?.shelters ?? [],
    country_context: countryData ?? null,
    active_alerts: alertData?.active_alerts ?? [],
  };
}

function parseJsonLoose(text) {
  try { return JSON.parse(text); } catch {}
  const m = String(text).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

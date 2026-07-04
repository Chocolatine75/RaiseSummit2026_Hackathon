import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Antigravity agent: browses live alert sources (JMA, NHK, transit) for crisis delta.
 * @param {string} task - specific instructions from the Orchestrator
 * @param {{ interaction_id?: string, environment_id?: string }} prev
 * @returns {{ interaction_id: string, environment_id: string, data: object }}
 */
export async function runAlertAgent(task, prev = {}) {
  const SYSTEM = `You are a live crisis alert agent. Browse official alert sources now.
Find the official meteorological and seismic authority for the country in the task, and the local transit authority for the city. Do not use hardcoded URLs — discover the authoritative sources for wherever the task location is.
Reply ONLY with valid JSON — no prose, no markdown fences:
{
  "exits_down": string[],
  "official_evac_direction": string | null,
  "active_alerts": [{"source": string, "severity": string, "message": string, "t": string}],
  "transit_status": {"service": string, "disrupted_lines": string[], "message": string}
}`;

  const interaction = await ai.interactions.create({
    agent: "antigravity-preview-05-2026",
    input: `${SYSTEM}\n\nTask: ${task}`,
    environment: prev.environment_id || "remote",
    ...(prev.interaction_id ? { previous_interaction_id: prev.interaction_id } : {}),
  });

  const environment_id = interaction.environment_id || prev.environment_id;
  const data = parseJsonLoose(interaction.output_text || "");

  return { interaction_id: interaction.id, environment_id, data };
}

function parseJsonLoose(text) {
  try { return JSON.parse(text); } catch {}
  const m = String(text).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

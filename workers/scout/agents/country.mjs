import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Antigravity agent: browses real web sources to fill country_context.
 * @param {string} task - specific instructions from the Orchestrator
 * @param {{ interaction_id?: string, environment_id?: string }} prev
 * @returns {{ interaction_id: string, environment_id: string, data: object }}
 */
export async function runCountryAgent(task, prev = {}) {
  const SYSTEM = `You are a country intelligence agent in a crisis. Browse the real web.
Find the official government or authoritative source for the city/country mentioned in the task.
Reply ONLY with valid JSON — no prose, no markdown fences:
{
  "country": string,
  "city": string,
  "emergency_numbers": {"police": string, "ambulance": string, "fire": string},
  "embassy": {"nationality": string, "address": string, "phone": string, "emergency_line": string},
  "key_phrases": [{"local": string, "en": string, "romanized": string}],
  "protocols": string[]
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

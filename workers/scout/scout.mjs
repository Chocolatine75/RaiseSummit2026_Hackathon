/**
 * AEGIS Scout — the Antigravity agent. Browses the staged status pages from a
 * Google-hosted Linux sandbox and emits delta_update events to the Keeper.
 *
 * Verified against ai.google.dev/gemini-api/docs/antigravity-agent:
 *   agent "antigravity-preview-05-2026" · environment:"remote" provisions a
 *   sandbox · pass back environment_id + previous_interaction_id to RESUME the
 *   same sandbox — that resume is the track's "resuming via environment ID"
 *   beat, so we persist both ids to scout-state.json and show them in the UI.
 *
 * Run one cycle:      node scout.mjs
 * Run demo loop:      node scout.mjs --loop        (a cycle every 20s)
 * Env: GEMINI_API_KEY, KEEPER_URL, STAGED_URL (defaults to KEEPER_URL/staged)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";

const KEEPER = process.env.KEEPER_URL || "http://localhost:8787";
const SESSION = process.env.SESSION || "demo";
const STAGED = process.env.STAGED_URL || `${KEEPER}/staged`;
const STATE_FILE = new URL("./scout-state.json", import.meta.url).pathname;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const TASK = `Open ${STAGED}/metro-status.html and ${STAGED}/shelters.html in your browser.
Extract the CURRENT disruption picture. Reply ONLY with JSON, no prose:
{"exits_down": string[], "official_evac_direction": string,
 "shelters": [{"name": string, "capacity": "open"|"full", "dist_m": number, "step_free": boolean}]}`;

async function cycle() {
  const prev = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : {};

  const interaction = await ai.interactions.create({
    agent: "antigravity-preview-05-2026",
    input: prev.interaction_id ? `Re-check the same pages. ${TASK}` : TASK,
    // First run: fresh sandbox. Later runs: RESUME the same one (the demo beat).
    environment: prev.environment_id || "remote",
    ...(prev.interaction_id ? { previous_interaction_id: prev.interaction_id } : {}),
  });

  const environment_id = interaction.environment_id || prev.environment_id;
  writeFileSync(STATE_FILE, JSON.stringify({ interaction_id: interaction.id, environment_id }, null, 2));
  console.log(`cycle done · interaction=${interaction.id} · env=${environment_id} (${prev.environment_id ? "RESUMED" : "fresh"})`);

  const delta = parseJsonLoose(interaction.output_text || "");
  if (!delta) return console.error("could not parse delta from:", interaction.output_text);

  await fetch(`${KEEPER}/event?session=${SESSION}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "delta_update",
      payload: { ...delta, environment_id }, // Keeper puts env id on the status strip
      src: "scout",
    }),
  });
  console.log("→ delta_update:", JSON.stringify(delta));
}

function parseJsonLoose(text) {
  try { return JSON.parse(text); } catch {}
  const m = String(text).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

if (process.argv.includes("--loop")) {
  // "Flood while the signal lasts": a cycle every 20s until Ctrl-C.
  while (true) { await cycle().catch((e) => console.error(e.message)); await new Promise((r) => setTimeout(r, 20000)); }
} else {
  await cycle();
}

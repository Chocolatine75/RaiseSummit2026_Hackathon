/**
 * AEGIS Auditor — the QA agent. An independent reviewer loop in the backend.
 *
 * Every cycle it pulls the live Situation Object, asks Gemini to judge the
 * CURRENT guidance against the user's constraints and the live data ("would
 * this instruction be safe and correct for THIS person right now?"), and files
 * an audit_report event back to the Keeper. The phone shows the verdict as a
 * QA badge — a second model checking the first, continuously.
 *
 * This complements (not replaces) the Keeper's built-in deterministic
 * invariant checks, which run on every step for free.
 *
 * Run one review:   node auditor.mjs
 * Run as a loop:    node auditor.mjs --loop     (every 15s)
 * Env: GEMINI_API_KEY, KEEPER_URL, SESSION
 */
import { GoogleGenAI } from "@google/genai";

const KEEPER = process.env.KEEPER_URL || "http://localhost:8787";
const SESSION = process.env.SESSION || "demo";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function review() {
  const s = await (await fetch(`${KEEPER}/api/state?session=${SESSION}`)).json();
  if (!s.guidance?.current_instruction_en) {
    console.log("no guidance to review yet");
    return;
  }

  const prompt = `You are a safety quality-analyst reviewing an emergency-guidance agent mid-incident.
Situation state (ground truth): ${JSON.stringify(s)}

Review ONLY the current guidance ("${s.guidance.current_instruction_en}") against the state. Judge:
1. constraint_safety — does it respect every user constraint (${(s.user.constraints || []).join(", ")})?
2. grounded — is every claim (exits, shelters, directions, distances) present in the state, nothing invented?
3. freshness_honesty — if it uses live_delta, does it acknowledge how old that data is?
4. actionable — is it ONE clear instruction a panicking person can follow right now?

Reply ONLY with JSON:
{"status": "pass"|"warn"|"fail", "checks": [{"name": string, "ok": boolean, "note": string}]}`;

  const res = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });
  const verdict = JSON.parse(res.text);
  console.log(`QA verdict: ${verdict.status}`,
    verdict.checks.filter((c) => !c.ok).map((c) => c.note).join("; ") || "(all checks green)");

  await fetch(`${KEEPER}/event?session=${SESSION}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "audit_report", payload: verdict, src: "auditor" }),
  });
}

if (process.argv.includes("--loop")) {
  while (true) { await review().catch((e) => console.error("auditor:", e.message)); await new Promise((r) => setTimeout(r, 15000)); }
} else {
  await review();
}

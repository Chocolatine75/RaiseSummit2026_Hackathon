/**
 * AEGIS Keeper — the spine.
 *
 * One Durable Object per session owns the Situation Object (the ONE law:
 * only this class ever writes it). Workers (Listener / Eyes / Scout / client)
 * emit events; the Keeper reconciles them with fixed if/then logic, asks the
 * Interactions API whether to surface guidance (stateful via
 * previous_interaction_id — the judged primitive), and pushes the FULL
 * Situation Object to every connected client over WebSocket. The client
 * caches every push, which is what makes the offline handoff a boring read.
 *
 * Routes (all take ?session=<name>, default "demo"):
 *   GET  /ws            WebSocket — receive full-state pushes; may also send events
 *   POST /event         { type, payload, src }  → reconcile → broadcast
 *   POST /api/eyes      { image_b64, mime_type } → Gemini vision reads the sign → sign_read event
 *   POST /api/reset     restore the pristine pre-demo state (rehearsal reset)
 *   GET  /api/state     current Situation Object as JSON (debugging)
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

// ---------- Worker: route to the session's Durable Object, else serve the PWA ----------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (["/ws", "/event", "/api/eyes", "/api/reset", "/api/state"].includes(url.pathname)) {
      const session = url.searchParams.get("session") || "demo";
      const stub = env.SESSION_DO.get(env.SESSION_DO.idFromName(session));
      return stub.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};

// ---------- The pristine pre-demo state (Maria set this up "yesterday") ----------
function freshState() {
  return {
    session_id: "aegis-maria-001",
    interaction_chain_id: null, // Interactions API id — shown in the UI status strip
    scout_environment_id: null, // Antigravity sandbox id — shown in the UI status strip
    user: {
      name: "Maria",
      language: "en",
      constraints: ["child_age_6", "no_stairs"],
      location: { station: "Shinjuku", level: "B2_platform_9" },
    },
    event: { type: null, magnitude_reported: null, t0: null },
    environment: [], // translated PA lines + sign readings, newest last
    live_delta: { exits_down: [], official_evac_direction: null, shelters: [], as_of: null },
    country_context: null,   // filled by Scout's country agent on first cycle
    active_alerts: [],        // filled by Scout's alert agent each cycle
    guidance: { current_instruction_en: null, next_question: null, needs_tap: false, confirmed: false },
    network: { online: true, last_serialized_to_device: null },
  };
}

export class SessionDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sockets = new Set();
  }

  async fetch(request) {
    const url = new URL(request.url);
    switch (url.pathname) {
      case "/ws": return this.handleWebSocket(request);
      case "/event": return this.handleEvent(await request.json());
      case "/api/eyes": return this.handleEyes(await request.json());
      case "/api/reset": {
        await this.state.storage.put("situation", freshState());
        await this.state.storage.delete("last_interaction_id");
        await this.broadcast();
        return json({ ok: true });
      }
      case "/api/state": return json(await this.situation());
      default: return new Response("not found", { status: 404 });
    }
  }

  async situation() {
    return (await this.state.storage.get("situation")) ?? freshState();
  }

  // ---------- WebSocket hub ----------
  handleWebSocket(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.sockets.add(server);
    server.addEventListener("close", () => this.sockets.delete(server));
    server.addEventListener("error", () => this.sockets.delete(server));
    // The client may also emit events over the socket (e.g. user_tap).
    server.addEventListener("message", async (msg) => {
      try { await this.handleEvent(JSON.parse(msg.data)); } catch { /* ignore malformed */ }
    });
    // New connection immediately gets the current full state — this is the
    // kill-the-app-reopen-it persistence beat working for free.
    this.situation().then((s) => server.send(JSON.stringify(s)));
    return new Response(null, { status: 101, webSocket: client });
  }

  async broadcast() {
    const s = await this.situation();
    const payload = JSON.stringify(s);
    for (const ws of this.sockets) {
      try { ws.send(payload); } catch { this.sockets.delete(ws); }
    }
  }

  // ---------- Event reconciliation: fixed if/then, NOT an AI call ----------
  async handleEvent(event) {
    const s = await this.situation();
    const t = event.t || new Date().toISOString();
    let needsReasoning = false;

    switch (event.type) {
      case "quake": // demo control: the earthquake begins
        s.event = { type: "earthquake", magnitude_reported: event.payload?.magnitude || "5+", t0: t };
        needsReasoning = true;
        break;
      case "pa_translation": // from Listener: { ja, en }
        s.environment.push({ src: "PA", ...event.payload, t });
        needsReasoning = true;
        break;
      case "sign_read": // from Eyes: { ja, en, type }
        s.environment.push({ src: "sign", ...event.payload, t });
        needsReasoning = true;
        break;
      case "delta_update": { // from Scout: partial live_delta fields
        const p = event.payload || {};
        if (p.exits_down) s.live_delta.exits_down = p.exits_down;
        if (p.official_evac_direction) s.live_delta.official_evac_direction = p.official_evac_direction;
        if (p.shelters) s.live_delta.shelters = p.shelters;
        s.live_delta.as_of = t;
        if (p.environment_id) s.scout_environment_id = p.environment_id;
        if (p.country_context) s.country_context = p.country_context;
        if (p.active_alerts) s.active_alerts = p.active_alerts;
        needsReasoning = true;
        break;
      }
      case "user_utterance": // Maria spoke: { text }
        s.environment.push({ src: "user", en: event.payload?.text, t });
        needsReasoning = true;
        break;
      case "user_tap": // Maria confirmed the pending guidance
        s.guidance.confirmed = true;
        s.guidance.needs_tap = false;
        break;
      default:
        return json({ ok: false, error: `unknown event type: ${event.type}` }, 400);
    }

    await this.state.storage.put("situation", s);
    if (needsReasoning) await this.reason(s); // updates guidance + persists again
    await this.broadcast();
    return json({ ok: true });
  }

  // ---------- Guidance via the Interactions API (stateful — the judged primitive) ----------
  async reason(s) {
    const prevId = await this.state.storage.get("last_interaction_id");
    const prompt =
      `You are AEGIS, guiding ${s.user.name} through a live emergency. ` +
      `Her constraints: ${s.user.constraints.join(", ")}. Location: ${JSON.stringify(s.user.location)}.\n` +
      `Current situation JSON:\n${JSON.stringify(s)}\n\n` +
      `${s.country_context ? `\nCountry context (embassy, protocols): ${JSON.stringify(s.country_context)}` : ""}` +
      `${s.active_alerts?.length ? `\nActive alerts: ${JSON.stringify(s.active_alerts)}` : ""}` +
      `Latest development is the last entry of "environment" or the "live_delta". ` +
      `Respond ONLY with JSON: {"surface_now": boolean, "plain_line_en": string, ` +
      `"next_question": string, "needs_tap": boolean}. ` +
      `plain_line_en is ONE short spoken-style instruction respecting her constraints, ` +
      `citing data freshness when using live_delta. needs_tap=true only when the ` +
      `instruction changes her route or files something on her behalf.`;

    try {
      const res = await fetch(`${GEMINI_BASE}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.env.GEMINI_API_KEY },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          input: prompt,
          store: true,
          ...(prevId ? { previous_interaction_id: prevId } : {}),
        }),
      });
      if (!res.ok) throw new Error(`interactions ${res.status}: ${await res.text()}`);
      const data = await res.json();

      // The chain id IS the persistence proof — store it and show it in the UI.
      if (data.id) {
        await this.state.storage.put("last_interaction_id", data.id);
        s.interaction_chain_id = data.id;
      }
      const text = extractText(data);
      console.log("Raw Interactions Text:", text);
      const g = parseJsonLoose(text);
      console.log("Parsed Interactions JSON:", JSON.stringify(g));
      if (g && g.surface_now) {
        s.guidance.current_instruction_en = g.plain_line_en;
        s.guidance.next_question = g.next_question;
        s.guidance.needs_tap = !!g.needs_tap;
        s.guidance.confirmed = false;
      } else {
        console.log("Condition g && g.surface_now failed. g.surface_now =", g?.surface_now);
      }
    } catch (err) {
      // Never let a flaky API kill the loop — surface the raw fact instead.
      const last = s.environment.at(-1);
      s.guidance.current_instruction_en = last?.en
        ? `Update: ${last.en}` : s.guidance.current_instruction_en;
      s.guidance.next_question = `(reasoning offline: ${String(err).slice(0, 80)})`;
    }
    await this.state.storage.put("situation", s);
  }

  // ---------- Eyes: camera photo → Gemini vision → sign_read event ----------
  async handleEyes({ image_b64, mime_type = "image/jpeg" }) {
    const res = await fetch(`${GEMINI_BASE}/models/gemini-3.5-flash:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.env.GEMINI_API_KEY },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        contents: [{
          parts: [
            { inline_data: { mime_type, data: image_b64 } },
            { text: 'Read any Japanese text in this image. Reply ONLY with JSON: {"ja": string, "en": string, "type": "exit_closed"|"direction"|"other"}' },
          ],
        }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) return json({ ok: false, error: await res.text() }, 502);
    const data = await res.json();
    const sign = parseJsonLoose(data.candidates?.[0]?.content?.parts?.[0]?.text || "");
    if (!sign?.en) return json({ ok: false, error: "no text found in image" }, 422);
    return this.handleEvent({ type: "sign_read", payload: sign, src: "eyes" });
  }
}

// ---------- Helpers ----------
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Interactions API responses expose text as output_text (SDK) or inside outputs;
// accept both shapes so a field rename in preview doesn't break the demo.
// Interactions API REST responses carry the reply in steps[] — the model_output
// step's content[].text (verified against the live API 2026-07-04). output_text
// is the SDK convenience field; keep it as fallback.
function extractText(data) {
  const fromSteps = (data.steps ?? [])
    .filter((st) => st.type === "model_output")
    .flatMap((st) => st.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");
  return fromSteps || data.output_text || "";
}

function parseJsonLoose(text) {
  try { return JSON.parse(text); } catch {}
  const m = String(text).match(/\{[\s\S]*\}/); // model wrapped JSON in prose/fences
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

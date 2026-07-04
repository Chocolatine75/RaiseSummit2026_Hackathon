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
 *   GET  /api/health    deterministic audit summary (harness/debugging)
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

// ---------- Worker: route to the session's Durable Object, else serve the PWA ----------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (["/ws", "/event", "/api/eyes", "/api/reset", "/api/state", "/api/health"].includes(url.pathname)) {
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
      location: { station: "Shinjuku", level: "B2_platform_9", lat: 35.6896, lng: 139.7006 },
    },
    event: { type: null, magnitude_reported: null, t0: null },
    environment: [], // translated PA lines + sign readings, newest last
    live_delta: { exits_down: [], official_evac_direction: null, shelters: [], as_of: null },
    route: null, // real OSRM walking route to the chosen shelter: {target, distance_m, duration_s, coords, first_step}
    guidance: { current_instruction_en: null, next_question: null, needs_tap: false, confirmed: false },
    audit: { status: "idle", checks: [], t: null }, // filled by runAudit + the Auditor agent
    network: { online: true, last_serialized_to_device: null },
  };
}

export class SessionDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sockets = new Set();
    // DOs interleave concurrent requests at await points — two rapid events
    // would read stale state and clobber each other's writes. This queue makes
    // event handling truly sequential: the one-writer rule, enforced.
    this.queue = Promise.resolve();
  }

  enqueue(fn) {
    const run = this.queue.then(fn, fn);
    this.queue = run.then(() => {}, () => {});
    return run;
  }

  async fetch(request) {
    const url = new URL(request.url);
    switch (url.pathname) {
      case "/ws": return this.handleWebSocket(request);
      case "/event": {
        const event = await request.json();
        return this.enqueue(() => this.handleEvent(event));
      }
      case "/api/eyes": return this.handleEyes(await request.json());
      case "/api/reset": {
        await this.state.storage.put("situation", freshState());
        await this.state.storage.delete("last_interaction_id");
        await this.broadcast();
        return json({ ok: true });
      }
      case "/api/state": return json(await this.situation());
      case "/api/health": {
        const s = await this.situation();
        runAudit(s, { requireStateChain: !!this.env.GEMINI_API_KEY });
        return json({
          ok: s.audit.status === "pass",
          status: s.audit.status,
          checks: s.audit.checks,
          interaction_chain_id: s.interaction_chain_id,
          scout_environment_id: s.scout_environment_id,
          guidance: s.guidance,
          live_delta_as_of: s.live_delta?.as_of,
        }, s.audit.status === "pass" ? 200 : 503);
      }
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
    server.addEventListener("message", (msg) => {
      try {
        const event = JSON.parse(msg.data);
        this.enqueue(() => this.handleEvent(event));
      } catch { /* ignore malformed */ }
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
      case "set_location": { // from the phone's real GPS: { lat, lng, accuracy_m, place }
        const p = event.payload || {};
        if (p.lat != null && p.lng != null) {
          s.user.location = {
            ...s.user.location,
            lat: p.lat, lng: p.lng,
            accuracy_m: p.accuracy_m ?? null,
            source: "device_gps",
            ...(p.place ? { station: p.place } : {}),
          };
          // Re-fetch real shelters + route for the NEW real position if a quake is active.
          if (s.event?.type === "earthquake") {
            const shelters = await this.realShelters(s).catch(() => null);
            if (shelters?.length) { s.live_delta.shelters = shelters; s.live_delta.as_of = t; }
          }
        }
        break;
      }
      case "audit_report": // from the Auditor agent: independent LLM quality check
        s.audit = { ...event.payload, t, source: "auditor-agent" };
        break;
      default:
        return json({ ok: false, error: `unknown event type: ${event.type}` }, 400);
    }

    await this.state.storage.put("situation", s);
    if (needsReasoning) {
      const t0 = Date.now();
      await this.reason(s); // updates guidance + persists again
      s.timing = { last_reason_ms: Date.now() - t0 }; // latency, shown in the UI strip
      runAudit(s, { requireStateChain: !!this.env.GEMINI_API_KEY });
      // deterministic invariant checks after every reasoning step
      await this.state.storage.put("situation", s);
    }
    await this.broadcast();

    // Quake just hit → pull REAL evacuation areas around Maria's REAL coordinates
    // via Grounding with Google Maps. Runs as a follow-up inside the same queue
    // job: the quake guidance reaches the UI immediately, real shelters ~3s later.
    if (event.type === "quake") {
      const shelters = await this.realShelters(s).catch((e) => {
        console.log("maps grounding failed:", String(e).slice(0, 300));
        return null;
      });
      if (shelters?.length) {
        await this.handleEvent({
          type: "delta_update",
          payload: { shelters },
          src: "maps-grounding",
        });
      }
    }

    // After shelters land (or the user's GPS moves), compute a REAL walking
    // route along actual streets to the best step-free shelter. This is what
    // makes the on-screen direction real, not a straight line.
    if (event.type === "delta_update" || event.type === "set_location") {
      const s2 = await this.situation();
      const route = await this.computeRoute(s2).catch((e) => { // mutates s2's target shelter dist
        console.log("routing failed:", String(e).slice(0, 200));
        return null;
      });
      if (route) {
        s2.route = route;
        await this.reason(s2); // re-guide with the REAL walking distance now on the shelter
        runAudit(s2, { requireStateChain: !!this.env.GEMINI_API_KEY });
        await this.state.storage.put("situation", s2);
        await this.broadcast();
      }
    }
    return json({ ok: true });
  }

  // ---------- Real walking route: OSRM (real streets, real polyline, no key) ----------
  async computeRoute(s) {
    const { lat, lng } = s.user.location;
    const shelters = s.live_delta?.shelters || [];
    if (lat == null || !shelters.length) return null;
    // Pick the target Maria can actually reach: open + step-free + nearest.
    const reachable = shelters.filter((x) => x.capacity === "open" && x.step_free && x.lat != null);
    const target = (reachable.length ? reachable : shelters).sort((a, b) => a.dist_m - b.dist_m)[0];
    if (!target?.lat) return null;

    const url = `https://router.project-osrm.org/route/v1/foot/${lng},${lat};${target.lng},${target.lat}` +
      `?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`osrm ${res.status}`);
    const data = await res.json();
    const r = data.routes?.[0];
    if (!r) return null;
    const routeInfo = {
      target: target.name,
      target_lat: target.lat,
      target_lng: target.lng,
      distance_m: Math.round(r.distance), // REAL walking distance along streets
      duration_s: Math.round(r.duration),
      // GeoJSON is [lng,lat]; Leaflet wants [lat,lng].
      coords: r.geometry.coordinates.map(([x, y]) => [y, x]),
      first_step: r.legs?.[0]?.steps?.find((st) => st.name)?.name || null,
      as_of: new Date().toISOString(),
    };
    // Keep the shelter's displayed distance consistent with the real route so
    // the card and the banner never disagree (they did: straight-line vs walking).
    target.dist_m = routeInfo.distance_m;
    target.walk_min = Math.max(1, Math.round(r.duration / 60));
    return routeInfo;
  }

  // ---------- Real shelters: Grounding with Google Maps (real places, not staged) ----------
  async realShelters(s) {
    const { lat, lng, station } = s.user.location;
    if (lat == null || !this.env.GEMINI_API_KEY) return null;
    const res = await fetch(`${GEMINI_BASE}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.env.GEMINI_API_KEY },
      body: JSON.stringify({
        model: "gemini-3.5-flash",
        input:
          `An earthquake just struck. Using Google Maps, find up to 6 REAL public parks, plazas, ` +
          `or large open spaces usable as evacuation areas within 1500m of latitude ${lat}, ` +
          `longitude ${lng} (near ${station}, Tokyo). Reply ONLY with JSON, no prose: ` +
          `{"shelters":[{"name":string,"lat":number,"lng":number,"dist_m":number,` +
          `"step_free":boolean,"capacity":"open"}]} — step_free=true for street-level parks/plazas. ` +
          `Only real places returned by Google Maps; do not invent any.`,
        tools: [{ type: "google_maps", latitude: lat, longitude: lng }],
        store: false, // one-shot lookup — keep it out of the guidance chain
      }),
    });
    if (!res.ok) throw new Error(`maps ${res.status}: ${await res.text()}`);
    const parsed = parseJsonLoose(extractText(await res.json()));
    return parsed?.shelters?.filter((x) => x.lat != null && x.lng != null) ?? null;
  }

  // ---------- Guidance via the Interactions API (stateful — the judged primitive) ----------
  async reason(s) {
    const prevId = await this.state.storage.get("last_interaction_id");
    const prompt =
      `You are AEGIS, guiding ${s.user.name} through a live emergency. ` +
      `Her constraints: ${s.user.constraints.join(", ")}. Location: ${JSON.stringify(s.user.location)}.\n` +
      `Current situation JSON:\n${JSON.stringify(s)}\n\n` +
      `Latest development is the last entry of "environment" or the "live_delta". ` +
      `Respond ONLY with JSON: {"surface_now": boolean, "plain_line_en": string, ` +
      `"next_question": string, "needs_tap": boolean}. ` +
      `surface_now=true whenever the newest development gives ANY new actionable ` +
      `information — including the initial quake (immediate safety posture). ` +
      `Only false for pure duplicates of guidance already given. ` +
      `plain_line_en is ONE short spoken-style instruction respecting her constraints, ` +
      `never inventing exits, elevators, escalators, shelters, distances, or staff locations not present in the JSON. ` +
      `citing data freshness when using live_delta. needs_tap=true only when the ` +
      `instruction changes her route or files something on her behalf.`;

    try {
      if (!this.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
      const res = await fetch(`${GEMINI_BASE}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.env.GEMINI_API_KEY },
        body: JSON.stringify({
          model: "gemini-3.5-flash",
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
      // Never let a flaky API kill the loop. The demo spine can still run from
      // deterministic guidance while the Interactions API/key is being fixed.
      const fallback = deterministicGuidance(s);
      s.guidance.current_instruction_en = fallback.current_instruction_en;
      s.guidance.next_question = `${fallback.next_question} (reasoning offline: ${String(err).slice(0, 70)})`;
      s.guidance.needs_tap = fallback.needs_tap;
      s.guidance.confirmed = false;
    }
    await this.state.storage.put("situation", s);
  }

  // ---------- Eyes: camera photo → Gemini vision → sign_read event ----------
  async handleEyes({ image_b64, mime_type = "image/jpeg" }) {
    const res = await fetch(`${GEMINI_BASE}/models/gemini-3.5-flash:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.env.GEMINI_API_KEY },
      body: JSON.stringify({
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

function deterministicGuidance(s) {
  const shelters = s.live_delta?.shelters || [];
  const bestShelter = shelters
    .filter((sh) => sh.capacity === "open" && sh.step_free)
    .sort((a, b) => (a.dist_m ?? Infinity) - (b.dist_m ?? Infinity))[0];
  const route = s.live_delta?.official_evac_direction;
  const last = s.environment?.at(-1);

  if (route && bestShelter) {
    const age = s.live_delta?.as_of ? `${Math.max(0, Math.round((Date.now() - new Date(s.live_delta.as_of)) / 1000))} seconds old` : "not timestamped";
    return {
      current_instruction_en:
        `Take the ${route.replaceAll("_", " ")}. Avoid stairs. ${bestShelter.name} is open, step-free, ${bestShelter.dist_m} meters away. Live data is ${age}.`,
      next_question: "Is the west concourse ramp clear where you are?",
      needs_tap: true,
    };
  }

  if (last?.src === "sign" && /closed/i.test(last.en || "")) {
    return {
      current_instruction_en: `Do not use this exit. ${last.en}. Stay with staff flow and look for the step-free west concourse.`,
      next_question: "Can you see a ramp or staff pointing to the west concourse?",
      needs_tap: true,
    };
  }

  if (last?.en) {
    return {
      current_instruction_en: `Update: ${last.en}`,
      next_question: "Are you safe and away from stairs right now?",
      needs_tap: false,
    };
  }

  if (s.event?.type === "earthquake") {
    return {
      current_instruction_en: "Earthquake detected. Stay low, protect your head, keep your child close, and do not use stairs until a safe route is confirmed.",
      next_question: "Are you away from platform edges and falling objects?",
      needs_tap: false,
    };
  }

  return {
    current_instruction_en: "Stay aware. I am watching for safe, step-free updates.",
    next_question: "Where are you standing right now?",
    needs_tap: false,
  };
}

// ---------- Built-in audit: deterministic invariants, checked on every step ----------
// (The Auditor agent does the LLM-based semantic review; these are the cheap,
// always-on checks that catch harness bugs the moment they happen.)
function runAudit(s, { requireStateChain = true } = {}) {
  const checks = [];
  const ok = (name, pass, note = "") => checks.push({ name, ok: !!pass, note });

  const hasEvents = (s.environment?.length || 0) > 0;
  ok("guidance_present", !hasEvents || !!s.guidance.current_instruction_en,
    hasEvents && !s.guidance.current_instruction_en ? "events arrived but no instruction surfaced" : "");

  if (s.user.constraints?.includes("no_stairs") && s.guidance.current_instruction_en) {
    const g = s.guidance.current_instruction_en.toLowerCase();
    const badStairs = /\bstairs?\b/.test(g) && !/(no|avoid|without|closed|cannot|can't|instead of)[^.]*\bstairs?\b|\bstairs?\b[^.]*(closed|blocked)/.test(g);
    ok("respects_no_stairs", !badStairs, badStairs ? "instruction may route via stairs" : "");
  }

  if (s.guidance.current_instruction_en) {
    const stateText = JSON.stringify(s).toLowerCase();
    const g = s.guidance.current_instruction_en.toLowerCase();
    const inventedVerticalTransport =
      /\b(elevator|lift|escalator)\b/.test(g) && !/\b(elevator|lift|escalator)\b/.test(stateText);
    ok("no_invented_access_feature", !inventedVerticalTransport,
      inventedVerticalTransport ? "instruction mentions elevator/lift/escalator not present in state" : "");
  }

  if (s.live_delta?.as_of) {
    const ageS = (Date.now() - new Date(s.live_delta.as_of)) / 1000;
    ok("delta_freshness", ageS < 300, ageS >= 300 ? `live data is ${Math.round(ageS / 60)}min old` : "");
  }

  ok("state_chain", !requireStateChain || !hasEvents || !!s.interaction_chain_id,
    requireStateChain && hasEvents && !s.interaction_chain_id ? "no Interactions chain id — persistence not proven" : "");

  const failed = checks.filter((c) => !c.ok);
  s.audit = {
    status: failed.length === 0 ? "pass" : "warn",
    checks,
    t: new Date().toISOString(),
    source: "keeper-invariants",
  };
}

// ---------- Helpers ----------
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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

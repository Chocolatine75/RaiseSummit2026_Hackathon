import { SituationObject } from '@/types/situation';

const BASE_URL = 'https://aegis-keeper.rahul-aegis.workers.dev';
// Our Keeper is kept alive solely for STT (audio → transcript)
const STT_URL = 'https://aegis-keeper.devstar7014.workers.dev';
export const SESSION_ID = 'matteo-maria-001';

export async function fetchState(): Promise<SituationObject | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/state?session=${SESSION_ID}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function postEvent(type: string, payload: object): Promise<void> {
  try {
    await fetch(`${BASE_URL}/event?session=${SESSION_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload, src: 'mobile' }),
    });
  } catch { /* fire-and-forget */ }
}

export async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
  const res = await fetch(`${STT_URL}/api/voice?session=${SESSION_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_b64: audioBase64, mime_type: mimeType }),
  });
  if (!res.ok) throw new Error('STT unavailable');
  const data = await res.json();
  return data.transcript as string;
}

export function createWebSocket(
  onMessage: (situation: SituationObject) => void,
  onStatusChange: (connected: boolean) => void
): () => void {
  let ws: WebSocket | null = null;
  let retryDelay = 5000;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  function connect() {
    if (destroyed) return;
    ws = new WebSocket(`wss://aegis-keeper.rahul-aegis.workers.dev/ws?session=${SESSION_ID}`);

    ws.onopen = () => {
      retryDelay = 5000;
      onStatusChange(true);
    };

    ws.onmessage = (e) => {
      try {
        const situation: SituationObject = JSON.parse(e.data);
        onMessage(situation);
      } catch { /* malformed message */ }
    };

    ws.onclose = () => {
      onStatusChange(false);
      if (!destroyed) {
        retryTimer = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, 60000);
          connect();
        }, retryDelay);
      }
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  connect();

  return () => {
    destroyed = true;
    if (retryTimer) clearTimeout(retryTimer);
    ws?.close();
  };
}

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { SituationObject } from '@/types/situation';
import { createWebSocket, fetchState, postEvent, queryGemma, SESSION_ID } from '@/services/keeper';
import { loadSituation, saveSituation } from '@/services/storage';
import { requestPermissions, speak, startRecording, stopRecording } from '@/services/audio';

interface SituationContextValue {
  situation: SituationObject | null;
  isConnected: boolean;
  isOfflineMode: boolean;
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  lastResponse: string;
  sessionId: string;
  onLongPressStatus: () => void;
  onMicPressIn: () => void;
  onMicPressOut: () => void;
  confirmGuidance: () => void;
}

const SituationContext = createContext<SituationContextValue | null>(null);

export function SituationProvider({ children }: { children: React.ReactNode }) {
  const [situation, setSituation] = useState<SituationObject | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const destroyWs = useRef<(() => void) | null>(null);

  // Persist situation to AsyncStorage on every update
  useEffect(() => {
    if (situation) saveSituation(situation);
  }, [situation]);

  // Boot: load cache then connect
  useEffect(() => {
    loadSituation().then((cached) => {
      if (cached) setSituation(cached);
    });

    requestPermissions();
    connectWebSocket();

    return () => destroyWs.current?.();
  }, []);

  function connectWebSocket() {
    destroyWs.current?.();
    destroyWs.current = createWebSocket(
      (sit) => setSituation(sit),
      (connected) => {
        setIsConnected(connected);
        // If WS reconnected, also pull latest state via HTTP
        if (connected) fetchState().then((sit) => { if (sit) setSituation(sit); });
      }
    );
  }

  function toggleOfflineMode() {
    setIsOfflineMode((prev) => {
      if (prev) {
        // Going back online
        connectWebSocket();
      } else {
        // Going offline — disconnect WS
        destroyWs.current?.();
        setIsConnected(false);
      }
      return !prev;
    });
  }

  async function onMicPressIn() {
    if (isListening || isProcessing) return;
    setTranscript('');
    setIsListening(true);
    await startRecording();
  }

  async function onMicPressOut() {
    if (!isListening) return;
    setIsListening(false);
    setIsProcessing(true);

    try {
      const audioBase64 = await stopRecording();
      if (!audioBase64) { setIsProcessing(false); return; }

      if (isOfflineMode) {
        // Offline: send audio + vault context to /api/gemma
        const vaultContext = buildVaultContext(situation);
        const response = await queryGemma('', vaultContext);
        setLastResponse(response);
        speak(response, situation?.user.language === 'fr' ? 'fr-FR' : 'en-US');
        // Update guidance locally
        if (situation) {
          setSituation({
            ...situation,
            guidance: { ...situation.guidance, current_instruction_en: response },
          });
        }
      } else {
        // Online: send audio to Keeper /api/voice
        const res = await fetch(`https://aegis-keeper.devstar7014.workers.dev/api/voice?session=${SESSION_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio_b64: audioBase64, mime_type: 'audio/m4a' }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.transcript) setTranscript(data.transcript);
          if (data.response) {
            setLastResponse(data.response);
            speak(data.response, situation?.user.language === 'fr' ? 'fr-FR' : 'en-US');
          }
          // WS will push updated situation automatically
        }
      }
    } finally {
      setIsProcessing(false);
    }
  }

  async function confirmGuidance() {
    await postEvent('confirm_guidance', {});
  }

  return (
    <SituationContext.Provider value={{
      situation,
      isConnected,
      isOfflineMode,
      isListening,
      isProcessing,
      transcript,
      lastResponse,
      sessionId: SESSION_ID,
      onLongPressStatus: toggleOfflineMode,
      onMicPressIn,
      onMicPressOut,
      confirmGuidance,
    }}>
      {children}
    </SituationContext.Provider>
  );
}

export function useSituation() {
  const ctx = useContext(SituationContext);
  if (!ctx) throw new Error('useSituation must be used inside SituationProvider');
  return ctx;
}

function buildVaultContext(situation: SituationObject | null): string {
  if (!situation) return '';
  const lines: string[] = [];

  situation.live_delta.shelters.slice(0, 3).forEach((s) => {
    lines.push(`Shelter: ${s.name}, ${s.dist_m}m, ${s.step_free ? 'step-free' : ''}, capacity: ${s.capacity}`);
  });

  if (situation.country_context?.embassy) {
    const e = situation.country_context.embassy;
    lines.push(`Embassy ${e.nationality}: ${e.address}, emergency: ${e.emergency_line}`);
  }

  Object.entries(situation.country_context?.emergency_numbers ?? {}).forEach(([k, v]) => {
    lines.push(`${k}: ${v}`);
  });

  situation.active_alerts.slice(0, 2).forEach((a) => {
    lines.push(`Alert ${a.source}: ${a.message}`);
  });

  situation.country_context?.key_phrases.slice(0, 5).forEach((p) => {
    lines.push(`Phrase: "${p.local}" = "${p.en}" (${p.romanized})`);
  });

  if (situation.guidance.current_instruction_en) {
    lines.push(`Current instruction: ${situation.guidance.current_instruction_en}`);
  }

  return lines.join('\n');
}

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { SituationObject } from '@/types/situation';
import { createWebSocket, fetchState, postEvent, transcribeAudio, SESSION_ID } from '@/services/keeper';
import { loadSituation, saveSituation } from '@/services/storage';
import { requestPermissions, speak, startRecording, stopRecording, stopSpeaking } from '@/services/audio';

interface SituationContextValue {
  situation: SituationObject | null;
  isConnected: boolean;
  isListening: boolean;
  isProcessing: boolean;
  isConversationActive: boolean;
  transcript: string;
  sessionId: string;
  onMicTap: () => void;
  confirmGuidance: () => void;
}

const SituationContext = createContext<SituationContextValue | null>(null);

export function SituationProvider({ children }: { children: React.ReactNode }) {
  const [situation, setSituation] = useState<SituationObject | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [transcript, setTranscript] = useState('');

  const destroyWs = useRef<(() => void) | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref so silence/speak callbacks can read latest value without stale closure
  const conversationRef = useRef(false);
  const listeningRef = useRef(false);
  const prevGuidanceRef = useRef<string | null>(null);

  useEffect(() => {
    if (situation) saveSituation(situation);
  }, [situation]);

  useEffect(() => {
    loadSituation().then((cached) => { if (cached) setSituation(cached); });
    fetchState().then((sit) => { if (sit) setSituation(sit); });
    requestPermissions();
    connectWebSocket();

    pollRef.current = setInterval(() => {
      fetchState().then((sit) => { if (sit) setSituation(sit); });
    }, 2000);

    let locationSub: Location.LocationSubscription | null = null;
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') return;
      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 15 },
        (loc) => {
          const { latitude: lat, longitude: lng, accuracy } = loc.coords;
          postEvent('set_location', { lat, lng, accuracy_m: Math.round(accuracy ?? 0) });
        }
      ).then((sub) => { locationSub = sub; });
    });

    return () => {
      destroyWs.current?.();
      locationSub?.remove();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // When guidance changes during active conversation → speak it → reopen mic
  useEffect(() => {
    const current = situation?.guidance.current_instruction_en;
    if (!current || current === prevGuidanceRef.current) return;
    prevGuidanceRef.current = current;
    if (!conversationRef.current) return;

    setIsProcessing(false);

    // Estimate TTS duration then reopen mic (iOS uses onDone, Android uses timer)
    const estimatedMs = Math.max(3000, (current.split(' ').length / 2.5) * 1000);
    speak(current, () => {
      if (conversationRef.current) openMicTurn();
    });
    setTimeout(() => {
      if (conversationRef.current && !listeningRef.current) openMicTurn();
    }, estimatedMs + 600);
  }, [situation?.guidance.current_instruction_en]);

  function connectWebSocket() {
    destroyWs.current?.();
    destroyWs.current = createWebSocket(
      (sit) => setSituation(sit),
      (connected) => {
        setIsConnected(connected);
        if (connected) fetchState().then((sit) => { if (sit) setSituation(sit); });
      }
    );
  }

  async function openMicTurn() {
    if (!conversationRef.current) return;
    listeningRef.current = true;
    setIsListening(true);
    setTranscript('');
    await startRecording();
  }

  async function sendAndWait() {
    if (!listeningRef.current) return;
    listeningRef.current = false;
    setIsListening(false);
    setIsProcessing(true);
    try {
      const audioBase64 = await stopRecording();
      if (!audioBase64) { setIsProcessing(false); return; }
      const text = await transcribeAudio(audioBase64, 'audio/m4a');
      console.log('[AEGIS] transcript:', text);
      setTranscript(text);
      await postEvent('user_utterance', { text });
      // AI response arrives via poll → guidance effect speaks it → reopens mic
    } catch (err) {
      console.warn('[AEGIS] voice error:', err);
      setIsProcessing(false);
    }
  }

  async function onMicTap() {
    if (isProcessing) return;

    if (!conversationRef.current) {
      // Start conversation — first tap opens mic
      conversationRef.current = true;
      setIsConversationActive(true);
      await openMicTurn();
    } else if (listeningRef.current) {
      // Second tap while listening → send what was recorded
      await sendAndWait();
    } else {
      // Tap while AI is speaking / waiting → end conversation
      conversationRef.current = false;
      setIsConversationActive(false);
      setIsListening(false);
      stopSpeaking();
    }
  }

  async function confirmGuidance() {
    await postEvent('user_tap', {});
  }

  return (
    <SituationContext.Provider value={{
      situation,
      isConnected,
      isListening,
      isProcessing,
      isConversationActive,
      transcript,
      sessionId: SESSION_ID,
      onMicTap,
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

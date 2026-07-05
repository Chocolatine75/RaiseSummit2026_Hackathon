import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system/legacy';

let recording: Audio.Recording | null = null;

export async function requestPermissions(): Promise<boolean> {
  const { granted } = await Audio.requestPermissionsAsync();
  return granted;
}

export async function startRecording(): Promise<void> {
  try {
    if (recording) {
      await recording.stopAndUnloadAsync().catch(() => {});
      recording = null;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording: rec } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    recording = rec;
  } catch (e) {
    console.warn('[AEGIS] startRecording error:', e);
  }
}

export async function stopRecording(): Promise<string | null> {
  if (!recording) return null;
  const rec = recording;
  recording = null;
  try {
    await rec.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    const uri = rec.getURI();
    if (!uri) return null;
    return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  } catch (e) {
    console.warn('[AEGIS] stopRecording error:', e);
    return null;
  }
}

export function speak(text: string, onDone?: () => void): void {
  Speech.stop();
  Speech.speak(text, { language: 'en-US', rate: 0.9, onDone });
}

export function stopSpeaking(): void {
  Speech.stop();
}

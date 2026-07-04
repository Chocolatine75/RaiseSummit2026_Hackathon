import AsyncStorage from '@react-native-async-storage/async-storage';
import { SituationObject } from '@/types/situation';

const SITUATION_KEY = 'aegis_situation';

export async function saveSituation(situation: SituationObject): Promise<void> {
  await AsyncStorage.setItem(SITUATION_KEY, JSON.stringify(situation));
}

export async function loadSituation(): Promise<SituationObject | null> {
  const raw = await AsyncStorage.getItem(SITUATION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SituationObject;
  } catch {
    return null;
  }
}

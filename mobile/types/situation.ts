export interface UserLocation {
  station: string;
  level: string;
}

export interface UserProfile {
  name: string;
  language: string;
  constraints: string[];
  location?: UserLocation;
}

export interface CrisisEvent {
  type: string | null;
  magnitude_reported: number | null;
  t0: string | null;
}

export interface EnvironmentEntry {
  src: string;
  ja: string;
  en: string;
  t: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Shelter {
  name: string;
  type: string;
  address: string;
  dist_m: number;
  step_free: boolean;
  capacity: string;
  coordinates?: Coordinates;
  source: string;
}

export interface LiveDelta {
  exits_down: string[];
  official_evac_direction: string | null;
  shelters: Shelter[];
  as_of: string | null;
}

export interface KeyPhrase {
  local: string;
  en: string;
  romanized: string;
}

export interface EmbassyInfo {
  nationality: string;
  address: string;
  phone: string;
  emergency_line: string;
}

export interface CountryContext {
  country: string;
  city: string;
  emergency_numbers: Record<string, string>;
  embassy?: EmbassyInfo;
  key_phrases: KeyPhrase[];
  protocols: string[];
}

export interface Alert {
  source: string;
  severity: string;
  message: string;
  t: string;
}

export interface Guidance {
  current_instruction_en: string | null;
  next_question: string | null;
  needs_tap: boolean;
  confirmed: boolean;
}

export interface NetworkState {
  online: boolean;
  last_serialized_to_device: string | null;
}

export interface SituationObject {
  session_id: string;
  interaction_chain_id: string | null;
  scout_environment_id: string | null;
  user: UserProfile;
  event: CrisisEvent;
  environment: EnvironmentEntry[];
  live_delta: LiveDelta;
  country_context: CountryContext | null;
  active_alerts: Alert[];
  guidance: Guidance;
  network: NetworkState;
}

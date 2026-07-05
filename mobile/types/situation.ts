export interface UserLocation {
  station: string;
  level?: string;
  lat?: number;
  lng?: number;
  accuracy_m?: number;
  source?: string;
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
  en: string;
  ja?: string;
  t: string;
}

export interface Shelter {
  name: string;
  lat?: number;
  lng?: number;
  dist_m: number;
  step_free: boolean;
  capacity: string;
}

export interface LiveDelta {
  exits_down: string[];
  official_evac_direction: string | null;
  shelters: Shelter[];
  as_of: string | null;
}

export interface Route {
  target: string;
  distance_m: number;
  duration_s: number;
  first_step: string | null;
  coords?: [number, number][];
}

export interface AgentOp {
  agent: string;
  status: 'active' | 'done' | 'error';
  detail: string;
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
  route: Route | null;
  guidance: Guidance;
  agents: AgentOp[];
  network: NetworkState;
}

export type DataStatus = 'verified' | 'estimated' | 'unavailable';
export type EngineMode = 'jev' | 'local';

export interface Source {
  label: string;
  url: string;
  accessedAt: string;
}

export interface Metric {
  label: string;
  value: string;
  status: DataStatus;
  detail: string;
  asOf: string;
  sourceUrl?: string;
}

export interface ProjectProfile {
  name: string;
  platform: string;
  stack: string;
}

export interface Project extends ProjectProfile {
  input: string;
  description: string;
  sourceUrl?: string;
}

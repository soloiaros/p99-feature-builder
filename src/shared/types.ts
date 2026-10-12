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

export interface Feature {
  id: string;
  name: string;
  description: string;
}

export interface AppSummary {
  id: string;
  name: string;
  iconUrl: string;
  category: string;
  description: string;
  appStoreUrl: string;
  rating: number | null;
  ratingCount: number | null;
  stats: Metric[];
  sources: Source[];
}

export interface Evidence {
  statement: string;
  sourceUrl: string;
  sourceLabel: string;
  confidence: 'high' | 'medium' | 'low';
  kind: 'publisher-description' | 'market-signal' | 'inference';
  asOf: string;
}

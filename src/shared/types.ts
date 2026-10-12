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

export interface FeatureMatch {
  id: string;
  feature: Feature;
  app: AppSummary;
  reason: string;
  evidence: Evidence[];
  confidence: 'high' | 'medium' | 'low';
  confidenceDetail: string;
  stats: Metric[];
}

export interface AnalyzeRequest { input: string; profile?: Partial<ProjectProfile>; features?: Feature[] }
export interface AnalyzeResponse {
  project: Project;
  features: Feature[];
  candidates?: AppSummary[];
  mode: EngineMode;
  notice: string;
  source: 'landing-page' | 'description';
  suggested: boolean;
  durationMs: number;
}
export interface MatchRequest { project: Project; features: Feature[] }
export interface MatchResponse {
  matches: FeatureMatch[];
  unmatchedFeatures?: Feature[];
  mode: EngineMode;
  notice: string;
  searchedCount: number;
  catalogUpdatedAt: string;
  durationMs: number;
}

export interface BriefSection { id: string; title: string; content: string }
export interface BundleFile { name: string; content: string; mimeType: string }
export interface BriefResponse {
  matchId: string;
  title: string;
  markdown: string;
  sections: BriefSection[];
  wireframeSvg: string;
  flowMermaid: string;
  sources: Source[];
  files: BundleFile[];
  mode: 'template';
  notice: string;
  generatedAt: string;
  cached: boolean;
}
export interface BriefRequest { project: Project; match: FeatureMatch }

import snapshot from '../data/catalog.json';
import type { AppSummary, Evidence, Feature, FeatureMatch, Metric } from '../src/shared/types';
import { featureDefinition } from './features';

export interface CatalogApp {
  trackId: number; name: string; description: string; iconUrl: string; storeUrl: string;
  primaryGenre: string; primaryGenreId: number; genres: string[]; price: number; currency: string; formattedPrice: string;
  rating: number | null; ratingCount: number | null; releaseDate: string; metadataFetchedAt: string; metadataSource: string;
  charts: { rank: number; chart: string; category: string; country: string; sourceUrl: string; capturedAt: string }[];
  features: { id: string; evidence: string; confidence: string; sourceUrl: string; method: string; tier: string }[];
}
export const apps = snapshot.apps as CatalogApp[];
export const capturedAt = snapshot.capturedAt;
export const appById = new Map(apps.map((app) => [String(app.trackId), app]));
export const enrichedCount = apps.filter((app) => app.features.length > 0).length;
const searchable = new Map(apps.map((app) => [app.trackId, { description: app.description.toLowerCase(), name: app.name.toLowerCase(), context: `${app.name} ${app.primaryGenre} ${app.description.slice(0, 2200)}`.toLowerCase() }]));

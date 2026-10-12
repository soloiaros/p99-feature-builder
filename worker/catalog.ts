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
const featureIndex = new Map<string, CatalogApp[]>();
for (const app of apps) for (const feature of app.features) {
  const list = featureIndex.get(feature.id) ?? [];
  list.push(app);
  featureIndex.set(feature.id, list);
}

export function appMetrics(app: CatalogApp): Metric[] {
  const common = { asOf: app.metadataFetchedAt, sourceUrl: app.metadataSource };
  const best = [...app.charts].filter((chart) => chart.chart !== 'top-grossing').sort((a, b) => a.rank - b.rank)[0] ?? app.charts[0];
  const years = (new Date(app.metadataFetchedAt).getTime() - new Date(app.releaseDate).getTime()) / (365.2425 * 86400000);
  const subscription = /subscription|subscribe|monthly|annually|premium/i.test(app.description);
  return [
    { label: 'Chart rank', value: best ? `#${best.rank}` : 'Unavailable', status: best ? 'verified' : 'unavailable', detail: best ? `US ${best.category} · ${best.chart.replace('top-', 'Top ')}. Snapshot, not a live rank.` : 'Not present in the collected category chart snapshots.', ...common, ...(best ? { asOf: best.capturedAt, sourceUrl: best.sourceUrl } : {}) },
    { label: 'App Store rating', value: app.rating === null ? 'Unavailable' : `${app.rating.toFixed(1)} / 5`, status: app.rating === null ? 'unavailable' : 'verified', detail: 'US App Store aggregate rating from Apple’s lookup API.', ...common },
    { label: 'Ratings', value: app.ratingCount === null ? 'Unavailable' : new Intl.NumberFormat('en-US', { notation: app.ratingCount >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(app.ratingCount), status: app.ratingCount === null ? 'unavailable' : 'verified', detail: app.ratingCount === null ? 'Apple did not provide a rating count.' : `${app.ratingCount.toLocaleString('en-US')} user ratings; this is not a count of written reviews.`, ...common },
    { label: 'Monthly revenue', value: 'Unavailable', status: 'unavailable', detail: 'Apple does not publish revenue. No paid intelligence source is connected; chart rank is not converted into a revenue estimate.', asOf: capturedAt },
    { label: 'Pricing model', value: app.price > 0 ? app.formattedPrice : subscription ? 'Free + premium' : 'Free download', status: subscription && app.price === 0 ? 'estimated' : 'verified', detail: app.price > 0 ? `US upfront price in ${app.currency}; additional purchases may apply.` : subscription ? 'Free download verified by Apple; premium model inferred from subscription language in the publisher description. Check the listing for current terms.' : 'Apple lists a free download. Additional purchases may apply.', ...common },
    { label: 'App age', value: Number.isFinite(years) ? years < 1 ? `${Math.max(1, Math.floor(years * 12))} mo` : `${Math.floor(years)} ${Math.floor(years) === 1 ? 'year' : 'years'}` : 'Unavailable', status: Number.isFinite(years) ? 'verified' : 'unavailable', detail: `Elapsed time since Apple’s release date (${app.releaseDate.slice(0, 10)}), measured at this snapshot.`, ...common },
  ];
}

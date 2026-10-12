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
export function summarizeApp(app: CatalogApp): AppSummary {
  const sentences = app.description.split(/\n|(?<=[.!?])\s+/).map((line) => line.replace(/^[*•\-\s]+|[*\s]+$/g, '').trim());
  const substantive = sentences.filter((line) => line.length >= 45 && !/award|featured by|winner|app of the|users are saying|what people|^https?:|^terms|^privacy|^[“"«]|join [\d+]|million (?:users|people)|#1|best .* app|world.s most|downloaded/i.test(line));
  const functional = substantive.findIndex((line) => /\b(?:helps?|track|plan|learn|record|log|create|organize|manage|build|remind|water|habit|fitness|workout|journal|meditation|sleep|notes|tasks)\b/i.test(line));
  const firstParagraph = (functional >= 0 ? substantive.slice(functional, functional + 2) : substantive.slice(0, 2)).join(' ') || `An app in ${app.primaryGenre}. Open its App Store listing for the publisher’s full description.`;
  return {
    id: String(app.trackId), name: app.name, iconUrl: app.iconUrl, category: app.primaryGenre,
    description: firstParagraph.length > 330 ? `${firstParagraph.slice(0, 327)}…` : firstParagraph,
    appStoreUrl: app.storeUrl, rating: app.rating, ratingCount: app.ratingCount,
    stats: appMetrics(app),
    sources: [{ label: 'Apple App Store metadata', url: app.metadataSource, accessedAt: app.metadataFetchedAt }, { label: 'Publisher’s App Store listing', url: app.storeUrl, accessedAt: app.metadataFetchedAt }],
  };
}
const stopwords = new Set(['a', 'an', 'the', 'my', 'app', 'with', 'and', 'for', 'that', 'this', 'our', 'your', 'from', 'into', 'their', 'have', 'users', 'user', 'feature', 'features', 'helps', 'help', 'build', 'make', 'people', 'use', 'using', 'ios', 'web']);
export function keywords(text: string): string[] { return [...new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length >= 3 && !stopwords.has(term)))].slice(0, 50); }
export interface Candidate { app: CatalogApp; localScore: number; excerpt: string; explicit: boolean }
const evidenceTerms: Record<string, RegExp> = {
  streaks: /\bstreaks?\b|consecutive days|days in a row/i, widgets: /\bwidgets?\b|home screen/i, onboarding: /onboarding|assessment|personalized plan|initial quiz/i,
  reminders: /remind|notifications?|alerts/i, progress: /progress|goal track|milestone/i, social: /friends?|communit|share|social|leaderboard/i,
  gamification: /badge|reward|achievement|points/i, insights: /insight|analytic|statistic|graphs|trends/i, focus: /timer|focus|meditat/i,
  logging: /\blog\b|logging|journal|diary|record/i, personalization: /personali|customiz|recommend|tailor/i,
  offline: /offline|without internet/i, search: /search|filter/i, sync: /sync|icloud|across.*devices/i, subscriptions: /subscription|premium|membership/i,
};
// Parse the immutable listing snapshot once, rather than re-splitting every app per selected tag.
const evidenceLines = new Map(apps.map((app) => {
  const brand = app.name.split(':')[0].trim();
  const brandPattern = brand.length >= 3 ? new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g') : null;
  const lines = app.description.split(/\n|(?<=[.!?])\s+/).map((line) => line.trim()).filter((line) => line.length >= 24 && line.length <= 500).map((line) => ({
    line,
    // Exact proper-name mentions are not feature evidence (e.g. "other Streaks users").
    featureText: brandPattern ? line.replace(brandPattern, '') : line,
    quality: (/^[•*\-]/.test(line) ? 3 : 0) + (line.length >= 45 && line.length < 240 ? 2 : 0) + (/\byour?\b/.test(line) ? 1 : 0) - (/privacy|terms|copyright|trademark|subscription.*renew|policy|reviews|said|saying/i.test(line) ? 6 : 0),
  }));
  return [app.trackId, lines];
}));
function featureEvidenceStrength(id: string, text: string): number {
  if (id !== 'streaks') return 0;
  if (/consecutive days|days in a row/i.test(text)) return 30;
  return /\b(?:current|best|longest|daily|build|keep|maintain|extend|break|repair)\b.{0,35}\bstreaks?\b|\bstreak\s+(?:count|length|repair|freeze)\b/i.test(text) ? 12 : 0;
}
const genericCustomTerms = new Set(['custom', 'capability', 'smart', 'intelligent', 'advanced', 'simple', 'easy', 'fast', 'quick', 'seamless', 'personalized', 'personalised', 'powered', 'based', 'track', 'tracking', 'progress', 'daily']);
function normalizedTerms(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length >= 2 && !stopwords.has(term)).map((term) => {
    if (/ing$/.test(term) && term.length > 5) return term.slice(0, -3).replace(/([a-z])\1$/, '$1');
    if (/ies$/.test(term) && term.length > 4) return `${term.slice(0, -3)}y`;
    if (/s$/.test(term) && !/ss$/.test(term) && term.length > 3) return term.slice(0, -1);
    return term;
  });
}
function customEvidenceTerms(feature: Feature): string[] {
  const terms = [...new Set(normalizedTerms(feature.name))];
  const distinctive = terms.filter((term) => !genericCustomTerms.has(term));
  return distinctive.length ? distinctive : terms;
}
function supportsCustomFeature(line: string, terms: string[]): boolean {
  if (!terms.length) return false;
  const present = new Set(normalizedTerms(line));
  // Context can rank candidates, but cannot qualify an unrelated custom feature.
  return terms.every((term) => present.has(term));
}
function evidenceExcerpt(app: CatalogApp, feature: Feature): string {
  const pattern = Object.hasOwn(evidenceTerms, feature.id) ? evidenceTerms[feature.id] : undefined;
  const terms = customEvidenceTerms(feature);
  let best = '';
  let bestScore = -Infinity;
  for (const { line, featureText, quality } of evidenceLines.get(app.trackId) ?? []) {
    if (!(pattern ? pattern.test(featureText) : supportsCustomFeature(featureText, terms))) continue;
    const score = quality + featureEvidenceStrength(feature.id, featureText);
    if (score > bestScore) { best = line; bestScore = score; }
  }
  // Unreviewed keyword hints can contain only a heading or app name; never use them as fallback quotes.
  return best.slice(0, 330);
}
export function shortlist(feature: Feature, description: string, limit = 4): Candidate[] {
  const canonical = Object.hasOwn(evidenceTerms, feature.id);
  const definition = featureDefinition(feature);
  const indexed = featureIndex.get(feature.id);
  const textTokens = keywords(`${feature.name} ${feature.description}`);
  const projectTokens = keywords(description);
  const domainGroups = [
    ['journal', 'journaling', 'diary', 'mood', 'reflection'],
    ['strength', 'workout', 'fitness', 'training', 'exercise', 'gym'],
    ['habit', 'habits', 'routine', 'streak'],
    ['meditation', 'mindfulness', 'meditate', 'breathing', 'sleep'],
    ['language', 'vocabulary', 'lesson', 'learning'],
    ['budget', 'finance', 'expense', 'money', 'spending'],
    ['recipe', 'meal', 'nutrition', 'calorie', 'food'],
    ['task', 'todo', 'calendar', 'planning', 'planner'],
  ];
  const lowerProject = description.toLowerCase();
  const domain = domainGroups.map((terms) => ({ terms, hits: terms.filter((term) => new RegExp(`\\b${term}\\b`).test(lowerProject)).length })).sort((a, b) => b.hits - a.hits)[0];
  const pool = indexed?.length ? indexed : apps;
  return pool.map((app) => {
    const hint = app.features.find((item) => item.id === feature.id);
    const normalized = searchable.get(app.trackId)!;
    const lower = normalized.description;
    const featureHits = textTokens.filter((term) => lower.includes(term)).length;
    const keywordHits = canonical ? definition.keywords.filter((term) => lower.includes(term)).length : 0;
    const contextHits = projectTokens.filter((term) => normalized.context.includes(term)).length;
    const domainScore = domain.hits ? domain.terms.reduce((score, term) => score + (normalized.name.includes(term) ? 12 : 0) + (normalized.context.includes(term) ? 5 : 0), 0) : 0;
    const line = evidenceExcerpt(app, feature);
    const fit = canonical ? (hint ? 25 : 0) + Math.min(featureHits, 5) * 3 + Math.min(keywordHits, 5) * 2 : line ? 25 + Math.min(featureHits, 5) * 3 : 0;
    return { app, localScore: fit + domainScore + Math.min(contextHits, 10) * 1.5 + Math.min(Math.log10((app.ratingCount ?? 0) + 1), 7) * 0.8 + (app.rating ?? 0) * 0.5, excerpt: line.slice(0, 330), explicit: !!hint, fit };
  }).filter((item) => item.fit > 0 && item.excerpt).sort((a, b) => b.localScore - a.localScore).slice(0, limit);
}

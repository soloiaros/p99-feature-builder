import type { AnalyzeResponse, Feature, MatchResponse, Project } from '../src/shared/types';
import { apps, capturedAt, createMatch, shortlist, summarizeApp } from './catalog';
import { FEATURE_DEFINITIONS, FEATURES, lexicalFeatures } from './features';
import { decide, modeNotice, providerInfo, type Env } from './jev';
import { parseFeatures, readLandingPage, record, textField } from './security';

function preloadCandidates(features: Feature[], description: string) {
  const candidates = new Map(features.flatMap((feature) => shortlist(feature, description, 4)).map(({ app }) => [app.trackId, app]));
  return [...candidates.values()].slice(0, 28).map(summarizeApp);
}

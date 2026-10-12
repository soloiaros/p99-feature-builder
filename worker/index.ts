import type { CatalogResponse, HealthResponse } from '../src/shared/types';
import { appById, apps, capturedAt, createMatch, enrichedCount, galleryApps, shortlist } from './catalog';
import { cachedBrief } from './brief';
import { analyze, matchFeatures } from './engine';
import { FEATURES } from './features';
import { providerInfo, type Env } from './jev';
import { ApiError, parseFeature, parseFeatures, parseProject, readJson, record, textField } from './security';

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...securityHeaders, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; frame-ancestors 'none'" } });
}

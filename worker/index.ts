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
export async function handleRequest(request: Request, env: Env, fetcher: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url);
  try {
    if (!url.pathname.startsWith('/api/')) {
      if (!env.ASSETS) return new Response('Not found', { status: 404, headers: securityHeaders });
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);
      for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }
    if (request.method === 'GET' && url.pathname === '/api/health') {
      const provider = providerInfo(env);
      return json({ status: 'ok', mode: provider.key ? 'jev' : 'local', provider: provider.provider, catalogCount: apps.length, enrichedCount, catalogUpdatedAt: capturedAt, briefMode: 'template' } satisfies HealthResponse);
    }
    if (request.method === 'GET' && url.pathname === '/api/catalog') {
      return json({ apps: galleryApps(), total: apps.length, enrichedCount, updatedAt: capturedAt, categories: [...new Set(apps.map((app) => app.primaryGenre))].sort(), features: FEATURES } satisfies CatalogResponse);
    }
    if (!['/api/analyze', '/api/match', '/api/brief'].includes(url.pathname)) return json({ error: 'Endpoint not found.' }, 404);
    if (request.method !== 'POST') return json({ error: 'Use POST for this endpoint.' }, 405);
    const origin = request.headers.get('origin');
    if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new ApiError(403, 'Use the app from its own website.');
    if (env.API_RATE_LIMITER) {
      const client = request.headers.get('cf-connecting-ip') || 'unknown';
      const { success } = await env.API_RATE_LIMITER.limit({ key: `${client}:${url.pathname}` });
      if (!success) return new Response(JSON.stringify({ error: 'Too many requests. Try again in a minute.' }), { status: 429, headers: { ...securityHeaders, 'content-type': 'application/json', 'retry-after': '60' } });
    }
    const body = await readJson(request);
    if (url.pathname === '/api/analyze') {
      if (typeof body.input !== 'string' || body.input.trim().length < 12) throw new ApiError(422, 'Add a little more detail about your app, or paste a full HTTPS URL.');
      return json(await analyze(body, env, fetcher));
    }
    const project = parseProject(body.project);
    if (url.pathname === '/api/match') return json(await matchFeatures(project, parseFeatures(body.features), env, fetcher));
    const requested = record(body.match);
    const feature = parseFeature(requested.feature);
    const appId = textField(record(requested.app).id, 'App id', 30);
    const app = appById.get(appId);
    if (!app) throw new ApiError(422, 'That reference app is not in this catalog.');
    // Rebuild trusted evidence and metrics: never accept client-supplied claims or source URLs.
    const candidate = shortlist(feature, project.description, apps.length).find((item) => item.app.trackId === app.trackId);
    if (!candidate) throw new ApiError(422, 'This reference has no supporting feature evidence. Choose another match.');
    const match = createMatch(feature, candidate);
    return json(await cachedBrief(project, match, url.origin));
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    // No provider bodies, input text, credentials or stack traces reach the response or logs.
    return json({ error: 'We could not finish that request. Please try again, or use a short app description.' }, 503);
  }
}

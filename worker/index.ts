import { createCheckout, fulfillCheckout, processStripeEvent, verifyStripeEvent } from './billing';
import { accountContext, accountsConfigured, accountState, availableProviders, fingerprint, reserveSearch, releaseSearch, signGrant, verifyGrant, type AccountContext } from './accounts';
import type { CatalogResponse, HealthResponse } from '../src/shared/types';
import { appById, apps, capturedAt, createMatch, enrichedCount, galleryApps, shortlist } from './catalog';
import { cachedBrief } from './brief';
import { analyze, matchFeatures } from './engine';
import { FEATURES } from './features';
import { providerInfo, type Env } from './jev';
import { ApiError, parseFeature, parseFeatures, parseProject, limitedText, readJson, record, textField } from './security';

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
  const sessionHeaders = new Headers();
  let context: AccountContext | undefined;
  const reply = (data: unknown, status = 200) => { const response = json(data, status); sessionHeaders.forEach((value, name) => { if (name !== 'set-cookie') response.headers.append(name, value); }); for (const cookie of sessionHeaders.getSetCookie()) response.headers.append('set-cookie', cookie); return response; };
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
    if (url.pathname === '/api/billing/webhook' && request.method === 'POST') {
      if (!accountsConfigured(env)) throw new ApiError(503, 'Accounts are not configured.');
      const event = await verifyStripeEvent(await limitedText(request.body, 250000), request.headers.get('stripe-signature') || '', env);
      await processStripeEvent(event, env, fetcher);
      return reply({ received: true });
    }
    if (['/api/billing/checkout', '/api/billing/restore'].includes(url.pathname) && request.method === 'POST') {
      if (request.headers.get('origin') !== url.origin) throw new ApiError(403, 'Use the app from its own website.');
      context = await accountContext(request, env, sessionHeaders, fetcher);
      if (!context.user) throw new ApiError(401, 'Sign in to manage Premium.');
      if (env.API_RATE_LIMITER && !(await env.API_RATE_LIMITER.limit({ key: `billing:${context.user.id}` })).success) throw new ApiError(429, 'Try again in a minute.');
      if (url.pathname.endsWith('/checkout')) return reply(await createCheckout(context, url.origin, env, fetcher));
      const body = await readJson(request);
      if (typeof body.sessionId === 'string') {
        if (!/^cs_[a-zA-Z0-9_]{1,220}$/.test(body.sessionId)) throw new ApiError(422, 'Invalid checkout reference.');
        await fulfillCheckout(body.sessionId, env, fetcher, context.user.id);
      }
      return reply(await accountState(await accountContext(request, env, sessionHeaders, fetcher), env, fetcher));
    }
    if (url.pathname === '/api/account' && request.method === 'GET') {
      if (!accountsConfigured(env)) return reply({ providers: [], configured: false, user: null, premium: false, expiresAt: null, remaining: 1, limit: 1, checkoutEnabled: false, priceLabel: env.PREMIUM_PRICE_LABEL || '$9' });
      return reply(await accountState(await accountContext(request, env, sessionHeaders, fetcher), env, fetcher));
    }
    if (url.pathname.startsWith('/api/auth/')) {
      context = await accountContext(request, env, sessionHeaders, fetcher);
      if (url.pathname === '/api/auth/start' && request.method === 'GET') {
        const provider = url.searchParams.get('provider');
        if (provider !== 'google' && provider !== 'github') throw new ApiError(422, 'Choose Google or GitHub.');
        if (!(await availableProviders(env, fetcher)).includes(provider)) throw new ApiError(503, 'This sign-in option is being set up. Please try again shortly.');
        const { data, error } = await context.client.auth.signInWithOAuth({ provider, options: { redirectTo: `${url.origin}/api/auth/callback`, skipBrowserRedirect: true } });
        if (error || !data.url) throw new ApiError(503, 'Sign-in could not start. Try again.');
        sessionHeaders.set('location', data.url); sessionHeaders.set('cache-control', 'no-store');
        return new Response(null, { status: 302, headers: sessionHeaders });
      }
      if (url.pathname === '/api/auth/callback' && request.method === 'GET') {
        const code = url.searchParams.get('code');
        const result = code ? await context.client.auth.exchangeCodeForSession(code) : null;
        sessionHeaders.set('location', `${url.origin}/?auth=${result && !result.error ? 'success' : 'error'}`); sessionHeaders.set('cache-control', 'no-store');
        return new Response(null, { status: 302, headers: sessionHeaders });
      }
      if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
        if (request.headers.get('origin') !== url.origin) throw new ApiError(403, 'Use the app from its own website.');
        const { error } = await context.client.auth.signOut({ scope: 'local' });
        if (error) throw new ApiError(503, 'Sign-out failed. Please try again.');
        return reply({ ok: true });
      }
      return reply({ error: 'Endpoint not found.' }, 404);
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
    if (env.REQUIRE_ACCOUNTS === 'true' && !accountsConfigured(env) && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new ApiError(503, 'Accounts are being set up. Please try again shortly.');
    const body = await readJson(request);
    if (accountsConfigured(env)) context = await accountContext(request, env, sessionHeaders, fetcher);
    if (url.pathname === '/api/analyze') {
      if (typeof body.input !== 'string' || body.input.trim().length < 12) throw new ApiError(422, 'Add a little more detail about your app, or paste a full HTTPS URL.');
      const reservation = context ? await reserveSearch(context) : null;
      try {
        const analysis = await analyze(body, env, fetcher);
        const searchToken = context ? await signGrant({ kind: 'search', subject: context.subject, project: await fingerprint(analysis.project), features: await fingerprint(analysis.features), exp: Date.now() + 30 * 86400000 }, env) : undefined;
        return reply({ ...analysis, searchToken });
      } catch (error) { if (context && reservation) await releaseSearch(context, reservation); throw error; }
    }
    const project = parseProject(body.project);
    if (url.pathname === '/api/match') {
      const features = parseFeatures(body.features);
      if (context) {
        const grant = await verifyGrant(typeof body.searchToken === 'string' ? body.searchToken : undefined, env);
        if (!grant || grant.kind !== 'search' || grant.subject !== context.subject || grant.project !== await fingerprint(project) || grant.features !== await fingerprint(features)) throw new ApiError(401, 'Start a new search to compare these features.');
      }
      return reply(await matchFeatures(project, features, env, fetcher));
    }
    const requested = record(body.match);
    const feature = parseFeature(requested.feature);
    const appId = textField(record(requested.app).id, 'App id', 30);
    const app = appById.get(appId);
    if (!app) throw new ApiError(422, 'That reference app is not in this catalog.');
    // Rebuild trusted evidence and metrics: never accept client-supplied claims or source URLs.
    const candidate = shortlist(feature, project.description, apps.length).find((item) => item.app.trackId === app.trackId);
    if (!candidate) throw new ApiError(422, 'This reference has no supporting feature evidence. Choose another match.');
    const match = createMatch(feature, candidate);
    const brief = await cachedBrief(project, match, url.origin);
    if (!context?.premium) return reply({ ...brief, wireframeSvg: '', flowMermaid: '', files: brief.files.filter(file => file.name === 'feature-brief.md'), premiumRequired: true });
    return reply({ ...brief, premiumRequired: false });
  } catch (error) {
    if (error instanceof ApiError) return reply({ error: error.message }, error.status);
    // No provider bodies, input text, credentials or stack traces reach the response or logs.
    return reply({ error: 'We could not finish that request. Please try again, or use a short app description.' }, 503);
  }
}

export default { fetch: (request: Request, env: Env) => handleRequest(request, env) } satisfies ExportedHandler<Env>;

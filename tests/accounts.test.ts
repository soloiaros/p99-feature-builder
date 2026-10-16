import { describe, expect, it } from 'vitest';
import { availableProviders, cookieJar, fingerprint, signGrant, verifyGrant } from '../worker/accounts';
import { handleRequest } from '../worker';
import type { AnalyzeResponse } from '../src/shared/types';

const env = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_ANON_KEY: 'public-test', SUPABASE_SERVICE_ROLE_KEY: 'server-test' };
const origin = 'https://p99.example.com';
const post = (path: string, body: unknown, cookie = '') => new Request(origin + path, { method: 'POST', headers: { origin, 'content-type': 'application/json', cookie }, body: JSON.stringify(body) });
const cookieHeader = (response: Response) => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');

describe('server account and usage boundaries', () => {
  it('uses secure HttpOnly cookies and can round-trip large sessions without truncation', () => {
    const headers = new Headers(); const jar = cookieJar(new Request(origin), headers);
    const session = JSON.stringify({ token: 'x'.repeat(7000) });
    jar.storage.setItem('p99-auth', session);
    expect(headers.getSetCookie().every(cookie => cookie.includes('HttpOnly; SameSite=Lax') && cookie.includes('Secure'))).toBe(true);
    const next = cookieJar(new Request(origin, { headers: { cookie: headers.getSetCookie().map(value => value.split(';')[0]).join('; ') } }), new Headers());
    expect(next.storage.getItem('p99-auth')).toBe(session);
    next.storage.removeItem('p99-auth'); expect(next.storage.getItem('p99-auth')).toBeNull();
  });
  it('bounds attacker-supplied cookie chunk counts', () => {
    const headers = new Headers();
    const jar = cookieJar(new Request(origin, { headers: { cookie: 'p99-auth-count=Infinity' } }), headers);
    expect(jar.storage.getItem('p99-auth')).toBeNull();
    jar.storage.setItem('p99-auth', 'new session');
    expect(headers.getSetCookie()).toHaveLength(2);
  });
  it.each(['google', 'github', 'notion', 'x'])('keeps unavailable OAuth provider %s disabled', async (provider) => {
    const response = await handleRequest(new Request(`${origin}/api/auth/start?provider=${provider}`), env, (async () => Response.json({ external: { google: true, github: true, notion: true, x: true, [provider]: false } })) as typeof fetch);
    expect(response.status).toBe(503);
    expect(response.headers.get('location')).toBeNull();
  });
  it('exposes only enabled supported providers and uses OAuth 2.0 for Twitter', async () => {
    const fetcher = (async () => Response.json({ external: { google: false, github: false, notion: true, x: true, twitter: true, discord: true } })) as typeof fetch;
    expect(await availableProviders(env, fetcher)).toEqual(['notion', 'x']);
    const legacyOnly = (async () => Response.json({ external: { twitter: true } })) as typeof fetch;
    expect(await availableProviders(env, legacyOnly)).toEqual([]);
    expect((await handleRequest(new Request(`${origin}/api/auth/start?provider=twitter`), env, legacyOnly)).status).toBe(422);
  });
  it('rejects tampered and expired grants and canonicalizes object key order', async () => {
    const grant = await signGrant({ kind: 'search', exp: Date.now() + 10000 }, env);
    expect((await verifyGrant(grant, env))?.kind).toBe('search');
    expect(await verifyGrant(grant + 'x', env)).toBeNull();
    expect(await verifyGrant(await signGrant({ exp: 1 }, env), env)).toBeNull();
    expect(await fingerprint({ a: 1, b: { x: 2, z: 3 } })).toBe(await fingerprint({ b: { z: 3, x: 2 }, a: 1 }));
  });
  it('allows one guest search, binds matching to it, and denies a second even after reload', async () => {
    let used = false;
    const fetcher = (async (url: string | Request, init?: RequestInit) => {
      const address = String(url);
      if (address.includes('/auth/v1/settings')) return Response.json({ external: { google: true, github: true, notion: true, x: true } });
      if (address.includes('/rpc/reserve_search')) { if (used) return Response.json(null); used = true; return Response.json('reservation-1'); }
      if (address.includes('/search_usage')) return new Response(null, { headers: { 'content-range': `0-0/${used ? 1 : 0}` } });
      throw new Error(`Unexpected network call ${address} ${init?.method}`);
    }) as typeof fetch;
    const initial = await handleRequest(new Request(origin + '/api/account'), env, fetcher);
    const cookie = cookieHeader(initial);
    const body = { input: 'A journal for daily reflections and thoughtful reminders.', features: [{ id: 'logging', name: 'Quick logging', description: 'Record journal entries' }] };
    const first = await handleRequest(post('/api/analyze', body, cookie), env, fetcher);
    expect(first.status).toBe(200);
    const analysis = await first.json() as AnalyzeResponse;
    const matched = await handleRequest(post('/api/match', { project: analysis.project, features: analysis.features, searchToken: analysis.searchToken }, cookie), env, fetcher);
    expect(matched.status).toBe(200);
    expect((await handleRequest(post('/api/match', { project: analysis.project, features: analysis.features }, cookie), env, fetcher)).status).toBe(401);
    expect((await handleRequest(post('/api/match', { project: { ...analysis.project, name: 'Different project' }, features: analysis.features, searchToken: analysis.searchToken }, cookie), env, fetcher)).status).toBe(401);
    expect((await (await handleRequest(new Request(origin + '/api/account', { headers: { cookie } }), env, fetcher)).json() as { remaining: number }).remaining).toBe(0);
    expect((await handleRequest(post('/api/analyze', body, cookie), env, fetcher)).status).toBe(401);
  });
  it('builds PKCE OAuth redirects for all four allowed providers without exposing a session', async () => {
    for (const provider of ['google', 'github', 'notion', 'x']) {
      const response = await handleRequest(new Request(`${origin}/api/auth/start?provider=${provider}`), env, (async () => Response.json({ external: { google: true, github: true, notion: true, x: true } })) as typeof fetch);
      expect(response.status).toBe(302);
      const target = new URL(response.headers.get('location')!);
      expect(target.origin).toBe(env.SUPABASE_URL);
      expect(target.searchParams.get('provider')).toBe(provider);
      expect(target.searchParams.get('redirect_to')).toBe(`${origin}/api/auth/callback`);
      expect(target.searchParams.has('access_token')).toBe(false);
      expect(target.searchParams.get('code_challenge_method')).toBe('s256');
      expect(response.headers.getSetCookie().some(value => value.includes('code-verifier') && value.includes('HttpOnly'))).toBe(true);
    }
    expect((await handleRequest(new Request(origin + '/api/auth/start?provider=evil'), env)).status).toBe(422);
  });
  it('fails closed when account enforcement is enabled without credentials', async () => {
    const response = await handleRequest(post('/api/analyze', { input: 'A daily journal for thoughtful reflection.' }), { REQUIRE_ACCOUNTS: 'true' });
    expect(response.status).toBe(503);
  });
});

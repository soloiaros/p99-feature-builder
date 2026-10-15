import { describe, expect, it, vi } from 'vitest';
import type { AnalyzeResponse, BriefResponse, HealthResponse, MatchResponse } from '../src/shared/types';
import { handleRequest } from '../worker';
import { analyze, matchFeatures } from '../worker/engine';
import { apps } from '../worker/catalog';
import { cachedBrief } from '../worker/brief';
import { lexicalFeatures } from '../worker/features';
import { decide, parseNoulAnswers, providerInfo } from '../worker/jev';
import { assertPublicDns, isPublicAddress, pageText, readLandingPage, validatePublicUrl } from '../worker/security';

const origin = 'https://borrow.example.com';
function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${origin}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', origin, ...headers }, body: JSON.stringify(body) });
}
const profile = { name: 'Fieldnote', platform: 'iOS', stack: 'SwiftUI' };
const input = 'A private daily journal with mood tracking, guided reflection prompts, reminders and a searchable timeline of memories.';

describe('end-to-end API without a provider key', () => {
  it('returns actual snapshot counts, editable features, evidence, and a complete original bundle', async () => {
    const health = await (await handleRequest(new Request(`${origin}/api/health`), {})).json() as HealthResponse;
    expect(health.catalogCount).toBe(apps.length);
    expect(health.mode).toBe('local');
    const analysis = await (await handleRequest(post('/api/analyze', { input, profile }), {})).json() as AnalyzeResponse;
    expect(analysis.features.map((feature: { id: string }) => feature.id)).toEqual(expect.arrayContaining(['logging', 'search', 'reminders']));
    expect(analysis.notice).toContain('No Jev key');
    const response = await handleRequest(post('/api/match', { project: analysis.project, features: analysis.features }), {});
    expect(response.status).toBe(200);
    const matched = await response.json() as MatchResponse;
    expect(matched.matches.length).toBeGreaterThanOrEqual(3);
    const logging = matched.matches.find((match: { feature: { id: string } }) => match.feature.id === 'logging')!;
    expect(logging.app.name.toLowerCase()).toMatch(/journal|diary|mood|finch/);
    for (const match of matched.matches) {
      expect(match.stats.find((stat: { label: string }) => stat.label === 'Monthly revenue')!.status).toBe('unavailable');
      expect(match.evidence.length).toBeGreaterThan(0);
      expect(match.confidenceDetail).toContain('Local keyword match');
    }
    const request = { project: analysis.project, match: logging };
    const brief = await (await handleRequest(post('/api/brief', request), {})).json() as BriefResponse;
    expect(brief.mode).toBe('template');
    expect(brief.sections.length).toBeGreaterThanOrEqual(8);
    expect(brief.markdown.length).toBeGreaterThan(9000);
    expect(brief.markdown).toContain('SwiftUI');
    expect(brief.markdown).toContain('idempotency');
    expect(brief.wireframeSvg).toContain('<svg');
    expect(brief.wireframeSvg).not.toContain('<script');
    expect(brief.flowMermaid).toContain('flowchart TD');
    expect(brief.files.map((file: { name: string }) => file.name)).toEqual(['feature-brief.md', 'wireframe.svg', 'flow.mmd', 'implementation-contract.json', 'sources.json']);
    const repeated = await (await handleRequest(post('/api/brief', request), {})).json() as BriefResponse;
    expect(repeated.cached).toBe(true);
  });
  it('rejects oversized bodies, invalid features and cross-origin mutation requests', async () => {
    expect((await handleRequest(post('/api/analyze', { input, profile }, { origin: 'https://attacker.example' }), {})).status).toBe(403);
    expect((await handleRequest(post('/api/analyze', { input: 'x'.repeat(110000) }), {})).status).toBe(413);
    expect((await handleRequest(post('/api/analyze', { input: 'x' }), {})).status).toBe(422);
    const malformed = new Request(`${origin}/api/analyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{broken' });
    expect((await handleRequest(malformed, {})).status).toBe(400);
  });
  it('does not trust forged client evidence or app references in bundles', async () => {
    const analysis = await analyze({ input, profile }, {});
    const matched = await matchFeatures(analysis.project, analysis.features, {});
    const match = matched.matches[0];
    const forged = { ...match, reason: 'HACKED', evidence: [{ statement: 'HACKED' }], stats: [{ value: '$999m' }], app: { ...match.app, sources: [{ label: 'Bad source', url: 'http://localhost:1234', accessedAt: '2026' }] } };
    const brief = await (await handleRequest(post('/api/brief', { project: analysis.project, match: forged }), {})).json() as BriefResponse;
    expect(brief.markdown).not.toContain('HACKED');
    expect(brief.files.find((file: { name: string }) => file.name === 'sources.json')!.content).not.toContain('$999m');
    expect((await handleRequest(post('/api/brief', { project: analysis.project, match: { ...match, app: { id: '999999999999' } } }), {})).status).toBe(422);
  });
  it('invalidates cached briefs when server-side evidence changes for the same app and feature', async () => {
    const analysis = await analyze({ input, profile: { ...profile, name: 'Evidence cache regression' } }, {});
    const matched = await matchFeatures(analysis.project, analysis.features, {});
    const original = matched.matches[0];
    const first = await cachedBrief(analysis.project, original, origin);
    expect(first.cached).toBe(false);
    const updated = { ...original, evidence: original.evidence.map((item, index) => index === 0 ? { ...item, statement: 'Corrected publisher excerpt for the same feature.' } : item) };
    const changed = await cachedBrief(analysis.project, updated, origin);
    expect(changed.cached).toBe(false);
    expect(changed.files.find((file) => file.name === 'sources.json')!.content).toContain('Corrected publisher excerpt');
    expect((await cachedBrief(analysis.project, updated, origin)).cached).toBe(true);
  });
  it('honors the edge rate-limit binding', async () => {
    const response = await handleRequest(post('/api/analyze', { input }), { API_RATE_LIMITER: { limit: async () => ({ success: false }) } });
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
  });
});

describe('matching relevance', () => {
  it('provides unique preload candidates covering eventual matches without an extra Jev call', async () => {
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ answers: Object.fromEntries(Object.keys(body.questions).map((id) => [id, { type: 'noul', noul: 0.9 }])) }));
    }) as unknown as typeof fetch;
    const env = { JEV_API_KEY: 'candidate-preload-test-key' };
    const analysis = await analyze({ input, profile }, env, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(analysis.candidates?.length).toBeGreaterThan(0);
    expect(analysis.candidates!.length).toBeLessThanOrEqual(28);
    const ids = analysis.candidates!.map((app) => app.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(analysis.candidates!.every((app) => app.iconUrl.startsWith('https://') && app.appStoreUrl.startsWith('https://apps.apple.com/'))).toBe(true);
    const matched = await matchFeatures(analysis.project, analysis.features, env, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(matched.matches.every((match) => ids.includes(match.app.id))).toBe(true);
  });
  it('keeps explicit fitness features ahead of generic inferred ones', async () => {
    const fitness = 'A strength training app with personalized workout plans, workout logging, progress charts, and shared challenges with friends.';
    const { features } = lexicalFeatures(fitness);
    expect(features.map((feature) => feature.id)).toEqual(expect.arrayContaining(['logging', 'progress', 'insights', 'social', 'personalization']));
    const result = await analyze({ input: fitness, profile }, {});
    const matched = await matchFeatures(result.project, result.features, {});
    expect(matched.matches.filter((match) => !/workout|fitness|hevy|strong|fitbod|strength|training|gym|strava/i.test(`${match.app.name} ${match.app.description}`)).map((match) => `${match.feature.id}: ${match.app.name}`)).toEqual([]);
  });
  it('handles a custom feature through evidence instead of returning an invented app', async () => {
    const analysis = await analyze({ input, profile }, {});
    const matched = await matchFeatures(analysis.project, [{ id: 'voice-capture', name: 'Voice recording', description: 'Record a voice note in a journal' }], {});
    expect(matched.matches.length).toBeGreaterThan(0);
    expect(apps.some((app) => String(app.trackId) === matched.matches[0].app.id)).toBe(true);
  });
});

describe('Jev contract and fallback', () => {
  it('only accepts complete bounded numeric Noul answers', () => {
    expect(parseNoulAnswers({ answers: { a: { noul: 0.7 } } }, ['a'])).toEqual({ a: 0.7 });
    expect(parseNoulAnswers({ answers: { a: { noul: 0.7 } } }, ['a', 'b'])).toBeNull();
    for (const bad of ['0.9', 1.1, -1, null, NaN]) expect(parseNoulAnswers({ answers: { a: { noul: bad } } }, ['a'])).toBeNull();
  });
  it('routes OpenRouter credentials correctly and never exposes them', async () => {
    expect(providerInfo({ JEV_API_KEY: 'sk-or-test', JEV_BASE_URL: 'https://api.typesafe.ai/v1' }).endpoint).toBe('https://openrouter.ai/api/v1/systemone');
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect(init?.redirect).toBe('manual'); // Workerd does not implement redirect: error.
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe('jev-latest');
      expect(body.questions.a.type).toBe('noul');
      return new Response(JSON.stringify({ answers: { a: { noul: 0.9 } } }));
    }) as unknown as typeof fetch;
    const decision = await decide({ JEV_API_KEY: 'secret-value' }, 'a record', { a: { type: 'noul', instructions: 'Does it fit?' } }, fetcher);
    expect(decision.scores?.a).toBe(0.9);
    expect(JSON.stringify(decision)).not.toContain('secret-value');
  });
  it('uses honest fallback on rejection or malformed provider responses', async () => {
    const rejected = await decide({ JEV_API_KEY: 'secret' }, '', { a: { type: 'noul', instructions: '?' } }, (async () => new Response('no', { status: 401 })) as typeof fetch);
    expect(rejected.reason).toBe('rejected');
    const malformed = await decide({ JEV_API_KEY: 'secret' }, '', { a: { type: 'noul', instructions: '?' } }, (async () => new Response('{}')) as typeof fetch);
    expect(malformed.scores).toBeNull();
    const missing = await decide({}, '', {}, vi.fn() as unknown as typeof fetch);
    expect(missing.reason).toBe('missing-key');
  });
  it('rejects provider redirects without forwarding the bearer token', async () => {
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect(init?.redirect).toBe('manual');
      return new Response(null, { status: 307, headers: { location: 'https://attacker.example' } });
    }) as unknown as typeof fetch;
    const result = await decide({ JEV_API_KEY: 'secret' }, '', { a: { type: 'noul', instructions: '?' } }, fetcher);
    expect(result.scores).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('landing-page safety', () => {
  it('blocks private, credentialed, local, literal and alternate-IP URLs', () => {
    for (const url of ['http://example.com', 'https://127.0.0.1', 'https://2130706433', 'https://0x7f000001', 'https://[::1]', 'https://metadata.google.internal', 'https://app.local', 'https://user:pass@example.com', 'https://example.com:8080']) expect(() => validatePublicUrl(url)).toThrow();
    expect(validatePublicUrl('https://duolingo.com/learn').hostname).toBe('duolingo.com');
    for (const ip of ['10.0.0.1', '127.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.1.1', '100.64.0.1', '::1', 'fe80::1', 'fc00::1', '2001:db8::1', '2002:7f00:1::']) expect(isPublicAddress(ip)).toBe(false);
    expect(isPublicAddress('8.8.8.8')).toBe(true);
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
  });
  it('rejects a hostname if any DNS record points at a private address', async () => {
    const fetcher = (async (url: unknown) => new Response(JSON.stringify({ Status: 0, Answer: [{ type: String(url).includes('AAAA') ? 28 : 1, data: String(url).includes('AAAA') ? 'fe80::1' : '8.8.8.8' }] }))) as typeof fetch;
    await expect(assertPublicDns('public.example.com', fetcher)).rejects.toThrow('public addresses');
  });
  it('does not follow redirects and discards executable page content', async () => {
    const fetcher = vi.fn(async (url: unknown) => String(url).includes('cloudflare-dns.com') ? new Response(JSON.stringify({ Status: 0, Answer: [{ type: 1, data: '8.8.8.8' }] })) : new Response(null, { status: 302, headers: { location: 'https://127.0.0.1' } })) as unknown as typeof fetch;
    await expect(readLandingPage('https://public.example.com', fetcher)).rejects.toThrow('redirects');
    expect(fetcher).toHaveBeenCalledTimes(3);
    const content = pageText('<title>My &amp; App</title><script>secret javascript</script><style>hidden css</style><p>A real journaling app.</p>');
    expect(content.title).toBe('My & App');
    expect(content.description).not.toContain('secret javascript');
    expect(content.description).toContain('A real journaling app.');
  });
});

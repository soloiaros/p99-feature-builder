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
    expect(health.catalogCount).toBe(1000);
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
    expect(brief.files.map((file: { name: string }) => file.name)).toEqual(['feature-brief.md', 'wireframe.svg', 'flow.mmd', 'sources.json']);
    const repeated = await (await handleRequest(post('/api/brief', request), {})).json() as BriefResponse;
    expect(repeated.cached).toBe(true);
  });

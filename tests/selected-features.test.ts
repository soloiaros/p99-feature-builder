import { describe, expect, it, vi } from 'vitest';
import type { AnalyzeResponse, Feature, MatchResponse, Project } from '../src/shared/types';
import { handleRequest } from '../worker';
import { shortlist } from '../worker/catalog';
import { analyze, matchFeatures } from '../worker/engine';

const input = 'A gentle habit tracking app for busy people, with daily reminders and progress charts.';
const project: Project = { input, description: input, name: 'Small steps', platform: 'iOS', stack: 'SwiftUI' };
const widgets: Feature = { id: 'widgets', name: 'My chosen widgets', description: 'Home screen widgets' };
const customWidgets: Feature = { id: 'custom-home-widgets', name: 'Home screen widgets', description: 'Keep habits visible on the home screen.' };
const impossible: Feature = { id: 'quantum-progress', name: 'Quantum teleportation progress', description: 'Daily habit progress with insights and notifications for teleportation.' };
const origin = 'https://p99.example.com';
function request(features: unknown, description = input) {
  return new Request(`${origin}/api/analyze`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ input: description, features }) });
}

describe('explicit feature selection', () => {
  it('preserves selected ids, names, descriptions and order without inferring replacements', async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    const features = [customWidgets, widgets];
    const response = await handleRequest(request(features), { JEV_API_KEY: 'selection-no-inference' }, fetcher);
    expect(response.status).toBe(200);
    const result = await response.json() as AnalyzeResponse;
    expect(result.features).toEqual(features);
    expect(result.suggested).toBe(false);
    expect(result.project.description).toBe(input);
    expect(result.notice).toContain('selected features');
    expect(result.mode).toBe('local');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('still extracts landing-page context while preserving explicit selections', async () => {
    const fetcher = vi.fn(async (url: unknown) => String(url).includes('cloudflare-dns.com')
      ? new Response(JSON.stringify({ Status: 0, Answer: [{ type: 1, data: '8.8.8.8' }] }))
      : new Response('<title>Small steps</title><p>Organize your habits, reminders, and progress in one calm place.</p>', { headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch;
    const result = await analyze({ input: 'https://public.example.com', features: [customWidgets] }, { JEV_API_KEY: 'selected-url-context' }, fetcher);
    expect(result.features).toEqual([customWidgets]);
    expect(result.project.description).toContain('Organize your habits');
    expect(result.source).toBe('landing-page');
    expect(result.project.sourceUrl).toBe('https://public.example.com/');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it.each([
    [], null, [widgets, widgets],
    Array.from({ length: 8 }, (_, index) => ({ ...widgets, id: `feature-${index}` })),
    [{ ...widgets, id: '../invalid' }], [{ ...widgets, name: 'x'.repeat(91) }],
  ].map((features) => ({ features })))('rejects malformed selections before any network operation: $features', async ({ features }) => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    const response = await handleRequest(request(features, 'https://public.example.com'), { JEV_API_KEY: 'validation-only' }, fetcher);
    expect(response.status).toBe(422);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('independent feature matching', () => {
  it('quotes streak mechanics rather than social copy mentioning the Streaks app name', () => {
    const feature = { id: 'streaks', name: 'Daily streaks', description: 'Build a habit over consecutive days.' };
    const streaks = shortlist(feature, project.description, 1000).find((candidate) => candidate.app.trackId === 963034692);
    expect(streaks?.excerpt).toBe('Your goal is to build a streak of consecutive days.');
    expect(streaks?.app.description).toContain(streaks!.excerpt);
    const social = shortlist({ id: 'social', name: 'Social sharing', description: 'Share tasks with friends.' }, project.description, 1000).find((candidate) => candidate.app.trackId === 963034692);
    expect(social?.excerpt).toContain('Share your tasks');
  });

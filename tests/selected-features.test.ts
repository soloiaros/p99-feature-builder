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

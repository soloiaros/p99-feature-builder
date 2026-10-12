import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const questions = { a: { type: 'noul' as const, instructions: 'Does this fit?' } };
const success = () => new Response(JSON.stringify({ answers: { a: { type: 'noul', noul: 0.92 } } }));
beforeEach(() => vi.resetModules());
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('successful Jev decision caching', () => {
  it('replays a real decision without another provider call', async () => {
    const { decide } = await import('../worker/jev');
    const fetcher = vi.fn(async () => success()) as unknown as typeof fetch;
    const first = await decide({ JEV_API_KEY: 'cache-test-secret' }, 'a habit app', questions, fetcher);
    const second = await decide({ JEV_API_KEY: 'cache-test-secret' }, 'a habit app', questions, fetcher);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.scores).toEqual(first.scores);
    expect(second.reason).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('isolates full state, questions, model, endpoint and credential', async () => {
    const { decide } = await import('../worker/jev');
    const fetcher = vi.fn(async () => success()) as unknown as typeof fetch;
    await decide({ JEV_API_KEY: 'key-a' }, 'state one', questions, fetcher);
    await decide({ JEV_API_KEY: 'key-a' }, 'state two', questions, fetcher);
    await decide({ JEV_API_KEY: 'key-a' }, 'state one', { a: { type: 'noul', instructions: 'Different question' } }, fetcher);
    await decide({ JEV_API_KEY: 'key-a', JEV_MODEL: 'another-model' }, 'state one', questions, fetcher);
    await decide({ JEV_API_KEY: 'key-a', JEV_BASE_URL: 'https://openrouter.ai/api/v1' }, 'state one', questions, fetcher);
    await decide({ JEV_API_KEY: 'key-b' }, 'state one', questions, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(6);
  });

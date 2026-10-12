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
  it('never caches failures or incomplete provider answers', async () => {
    const { decide } = await import('../worker/jev');
    const responses = [new Response('rejected', { status: 401 }), new Response('{}'), success()];
    const fetcher = vi.fn(async () => responses.shift()!) as unknown as typeof fetch;
    expect((await decide({ JEV_API_KEY: 'key' }, 'state', questions, fetcher)).scores).toBeNull();
    expect((await decide({ JEV_API_KEY: 'key' }, 'state', questions, fetcher)).scores).toBeNull();
    expect((await decide({ JEV_API_KEY: 'key' }, 'state', questions, fetcher)).scores?.a).toBe(0.92);
    expect((await decide({ JEV_API_KEY: 'key' }, 'state', questions, fetcher)).cached).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('persists only scores under an opaque key and recovers after an isolate restart', async () => {
    const stored = new Map<string, Response>();
    const cache = {
      match: vi.fn(async (key: Request) => stored.get(key.url)?.clone()),
      put: vi.fn(async (key: Request, response: Response) => { stored.set(key.url, response.clone()); }),
    };
    vi.stubGlobal('caches', { default: cache });
    const fetcher = vi.fn(async () => success()) as unknown as typeof fetch;
    const env = { JEV_API_KEY: 'never-store-this-secret' };
    await (await import('../worker/jev')).decide(env, 'private-project-description', questions, fetcher);
    const [url, response] = [...stored.entries()][0];
    const body = await response.clone().text();
    expect(url).toMatch(/\/v1\/[a-f0-9]{64}$/);
    expect(`${url}${body}`).not.toMatch(/never-store-this-secret|private-project-description|Does this fit/);
    expect(response.headers.get('cache-control')).toBe('max-age=21600');
    vi.resetModules();
    const replay = await (await import('../worker/jev')).decide(env, 'private-project-description', questions, fetcher);
    expect(replay.cached).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

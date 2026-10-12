import { limitedText } from './security';

export interface Env {
  ASSETS?: Fetcher;
  JEV_API_KEY?: string;
  TYPESAFE_API_KEY?: string;
  TYPE_SAFE_KEY?: string;
  OPENROUTER_API_KEY?: string;
  JEV_BASE_URL?: string;
  JEV_MODEL?: string;
  API_RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}
export function providerInfo(env: Env): { key?: string; endpoint: string; provider: 'TypeSafe' | 'OpenRouter' | 'Local feature engine' } {
  const key = env.JEV_API_KEY || env.TYPESAFE_API_KEY || env.TYPE_SAFE_KEY || env.OPENROUTER_API_KEY;
  const openRouter = key?.startsWith('sk-or-') || env.JEV_BASE_URL?.startsWith('https://openrouter.ai/') || (!env.JEV_API_KEY && !env.TYPESAFE_API_KEY && !env.TYPE_SAFE_KEY && !!env.OPENROUTER_API_KEY);
  return { key, endpoint: openRouter ? 'https://openrouter.ai/api/v1/systemone' : 'https://api.typesafe.ai/v1/systemone', provider: key ? openRouter ? 'OpenRouter' : 'TypeSafe' : 'Local feature engine' };
}

export function parseNoulAnswers(data: unknown, ids: string[]): Record<string, number> | null {
  if (!data || typeof data !== 'object' || !('answers' in data) || !data.answers || typeof data.answers !== 'object') return null;
  const answers = data.answers as Record<string, unknown>;
  const result: Record<string, number> = {};
  for (const id of ids) {
    const answer = answers[id];
    if (!answer || typeof answer !== 'object' || !('noul' in answer) || typeof answer.noul !== 'number' || !Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1) return null;
    result[id] = answer.noul;
  }
  return result;
}
export interface DecisionResult { scores: Record<string, number> | null; reason: 'missing-key' | 'unavailable' | 'rejected' | null; durationMs: number; cached?: boolean }
const MEMORY_TTL = 60 * 60 * 1000;
const EDGE_TTL = 6 * 60 * 60 * 1000;
const MEMORY_LIMIT = 128;
interface CachedDecision { answers: Record<string, { noul: number }>; expiresAt: number }
const decisions = new Map<string, CachedDecision>();

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (part) => part.toString(16).padStart(2, '0')).join('');
}
function edgeCache(): Cache | undefined {
  return typeof caches !== 'undefined' && 'default' in caches ? (caches as unknown as { default: Cache }).default : undefined;
}
function remember(key: string, answers: CachedDecision['answers'], expiresAt = Date.now() + MEMORY_TTL): void {
  // FIFO eviction keeps memory bounded even when all visitors submit unique projects.
  decisions.delete(key);
  if (decisions.size >= MEMORY_LIMIT) decisions.delete(decisions.keys().next().value!);
  decisions.set(key, { answers, expiresAt: Math.min(expiresAt, Date.now() + MEMORY_TTL) });
}
async function readDecision(key: string, ids: string[]): Promise<Record<string, number> | null> {
  const hit = decisions.get(key);
  if (hit && hit.expiresAt > Date.now()) return parseNoulAnswers(hit, ids);
  decisions.delete(key);
  const cache = edgeCache();
  if (!cache) return null;
  try {
    const response = await cache.match(new Request(`https://borrow-decision-cache.invalid/v1/${key}`));
    if (!response) return null;
    const value: unknown = JSON.parse(await limitedText(response.body, 160000));
    if (!value || typeof value !== 'object' || !('expiresAt' in value) || typeof value.expiresAt !== 'number' || value.expiresAt <= Date.now()) return null;
    const scores = parseNoulAnswers(value, ids);
    if (!scores) return null;
    remember(key, (value as CachedDecision).answers, value.expiresAt);
    return scores;
  } catch { return null; }
}
async function storeDecision(key: string, scores: Record<string, number>): Promise<void> {
  const answers = Object.fromEntries(Object.entries(scores).map(([id, noul]) => [id, { noul }]));
  remember(key, answers);
  const cache = edgeCache();
  if (!cache) return;
  try {
    // Store scores only: neither project text, prompts nor credentials enter the cached response.
    await cache.put(new Request(`https://borrow-decision-cache.invalid/v1/${key}`), new Response(JSON.stringify({ answers, expiresAt: Date.now() + EDGE_TTL }), {
      headers: { 'content-type': 'application/json', 'cache-control': `max-age=${EDGE_TTL / 1000}` },
    }));
  } catch { /* Cache failure must never turn a valid Jev result into fallback. */ }
}

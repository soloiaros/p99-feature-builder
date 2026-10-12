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

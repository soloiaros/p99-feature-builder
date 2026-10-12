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

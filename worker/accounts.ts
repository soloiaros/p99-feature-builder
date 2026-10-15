import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Env } from './jev';
import { ApiError, limitedText } from './security';

import type { AccountState } from '../src/shared/types';
export function accountsConfigured(env: Env) { return Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY); }
export function adminClient(env: Env, fetcher: typeof fetch = fetch) {
  return createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetcher } });
}
export function cookieJar(request: Request, headers: Headers) {
  const values = new Map((request.headers.get('cookie') || '').split(';').map(item => { const index = item.indexOf('='); return [item.slice(0, index).trim(), item.slice(index + 1)] as const; }));
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  const chunkCount = (key: string) => { const count = Number(values.get(`${key}-count`)); return Number.isInteger(count) && count > 0 && count <= 8 ? count : 0; };
  const set = (name: string, value: string, age: number) => {
    values.set(name, value);
    headers.append('set-cookie', `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure}`);
  };
  return {
    get: (name: string) => values.get(name), set,
    storage: {
      getItem: (key: string) => {
        try { const count = chunkCount(key); if (!count || count > 8) return null;
          return decodeURIComponent(Array.from({ length: count }, (_, i) => values.get(`${key}-${i}`) || '').join(''));
        } catch { return null; }
      },
      setItem: (key: string, value: string) => {
        const encoded = encodeURIComponent(value); const count = Math.ceil(encoded.length / 3000);
        if (count > 8) throw new ApiError(503, 'Your session could not be saved. Please try again.');
        const old = chunkCount(key);
        const age = key.includes('code-verifier') ? 600 : 60 * 60 * 24 * 30;
        set(`${key}-count`, String(count), age);
        for (let i = 0; i < Math.max(count, old); i++) set(`${key}-${i}`, encoded.slice(i * 3000, (i + 1) * 3000), i < count ? age : 0);
      },
      removeItem: (key: string) => { const count = chunkCount(key); for (let i = 0; i < count; i++) set(`${key}-${i}`, '', 0); set(`${key}-count`, '', 0); },
    },
  };
}
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const decode = (value: string) => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0));
async function signingKey(env: Env) { return crypto.subtle.importKey('raw', new TextEncoder().encode(`p99-grants:${env.SUPABASE_SERVICE_ROLE_KEY}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']); }
export async function signGrant(data: Record<string, unknown>, env: Env): Promise<string> {
  const payload = encode(new TextEncoder().encode(JSON.stringify(data)));
  return `${payload}.${encode(new Uint8Array(await crypto.subtle.sign('HMAC', await signingKey(env), new TextEncoder().encode(payload))))}`;
}
export async function verifyGrant(value: string | undefined, env: Env): Promise<Record<string, unknown> | null> {
  if (!value || value.length > 8000) return null;
  try {
    const [payload, signature, extra] = value.split('.');
    if (extra || !await crypto.subtle.verify('HMAC', await signingKey(env), decode(signature), new TextEncoder().encode(payload))) return null;
    const data = JSON.parse(new TextDecoder().decode(decode(payload)));
    return typeof data.exp === 'number' && data.exp > Date.now() ? data : null;
  } catch { return null; }
}
export async function fingerprint(value: unknown) {
  return encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)))));
}
export interface AccountContext {
  client: SupabaseClient; admin: SupabaseClient; user: User | null; subject: string;
  premium: boolean; expiresAt: string | null; period: string; limit: number;
}
export async function accountContext(request: Request, env: Env, headers: Headers, fetcher: typeof fetch = fetch): Promise<AccountContext> {
  if (!accountsConfigured(env)) throw new ApiError(503, 'Accounts are being set up. Please try again shortly.');
  const jar = cookieJar(request, headers);
  const client = createClient(env.SUPABASE_URL!, env.SUPABASE_ANON_KEY!, { auth: { storageKey: 'p99-auth', storage: jar.storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'pkce' }, global: { fetch: fetcher } });
  const { data: { user }, error } = await client.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError' && error.status !== 401 && error.status !== 403 && error.status !== 400) throw new ApiError(503, 'Your account could not be checked. Try again.');
  const admin = adminClient(env, fetcher);
  let guest = await verifyGrant(jar.get('p99-guest'), env);
  if (!guest || guest.kind !== 'guest' || typeof guest.id !== 'string') {
    guest = { kind: 'guest', id: crypto.randomUUID(), exp: Date.now() + 365 * 86400000 };
    jar.set('p99-guest', await signGrant(guest, env), 365 * 86400);
  }
  let expiresAt: string | null = null;
  if (user) {
    const { data, error } = await admin.from('premium_entitlements').select('expires_at').eq('user_id', user.id).maybeSingle();
    if (error) throw new ApiError(503, 'Your plan could not be checked. Try again.');
    expiresAt = data?.expires_at || null;
  }
  const premium = Boolean(expiresAt && Date.parse(expiresAt) > Date.now());
  const period = !user ? 'guest' : premium ? `premium:${expiresAt}` : `free:${new Date().toISOString().slice(0, 7)}`;
  const configuredLimit = Number(premium ? env.PREMIUM_SEARCH_LIMIT || 100 : env.FREE_SEARCH_LIMIT || 5);
  const limit = user ? Number.isSafeInteger(configuredLimit) && configuredLimit > 0 ? configuredLimit : premium ? 100 : 5 : 1;
  return { client, admin, user, subject: user ? `user:${user.id}` : `guest:${guest.id}`, premium, expiresAt, period, limit };
}
export async function availableProviders(env: Env, fetcher: typeof fetch = fetch): Promise<('google' | 'github')[]> {
  const response = await fetcher(`${env.SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: env.SUPABASE_ANON_KEY! }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new ApiError(503, 'Sign-in options could not be checked. Try again.');
  const settings = JSON.parse(await limitedText(response.body, 20000));
  return (['google', 'github'] as const).filter(provider => settings.external?.[provider] === true);
}
export async function accountState(context: AccountContext, env: Env, fetcher: typeof fetch = fetch): Promise<AccountState> {
  const { count, error } = await context.admin.from('search_usage').select('id', { count: 'exact', head: true }).eq('subject', context.subject).eq('period', context.period);
  if (error) throw new ApiError(503, 'Your search allowance could not be checked. Try again.');
  return { providers: await availableProviders(env, fetcher), configured: true, user: context.user ? { id: context.user.id, email: context.user.email || '' } : null, premium: context.premium, expiresAt: context.expiresAt, remaining: Math.max(0, context.limit - (count || 0)), limit: context.limit, checkoutEnabled: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID && env.STRIPE_WEBHOOK_SECRET), priceLabel: env.PREMIUM_PRICE_LABEL || '$9' };
}
export async function reserveSearch(context: AccountContext): Promise<string> {
  const { data, error } = await context.admin.rpc('reserve_search', { p_subject: context.subject, p_period: context.period, p_limit: context.limit });
  if (error) throw new ApiError(503, 'Your search could not be started. Try again.');
  if (!data) throw new ApiError(context.user ? 429 : 401, context.user ? 'You have used your searches for this period. Explore Premium for more.' : 'Your free search is used. Sign in with Google or GitHub to keep exploring.');
  return data as string;
}
export async function releaseSearch(context: AccountContext, id: string) {
  await context.admin.from('search_usage').delete().eq('id', id).eq('subject', context.subject);
}

// Keep provider IDs aligned with Supabase; product labels are independent.
export const AUTH_PROVIDERS = [
  { id: 'google', label: 'Google' },
  { id: 'github', label: 'GitHub' },
  { id: 'notion', label: 'Notion' },
  { id: 'x', label: 'Twitter' },
] as const;

export type AuthProvider = typeof AUTH_PROVIDERS[number]['id'];

export function isAuthProvider(value: unknown): value is AuthProvider {
  return AUTH_PROVIDERS.some(provider => provider.id === value);
}

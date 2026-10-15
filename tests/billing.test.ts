import { describe, expect, it, vi } from 'vitest';
import { fulfillCheckout, processStripeEvent, verifyStripeEvent } from '../worker/billing';
import { handleRequest } from '../worker';
import type Stripe from 'stripe';
const env = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service-test', STRIPE_SECRET_KEY: 'sk_test_example', STRIPE_PRICE_ID: 'price_test', STRIPE_WEBHOOK_SECRET: 'whsec_test' };
const user = '11111111-1111-4111-8111-111111111111';
const session = { id: 'cs_test_abc', mode: 'payment', payment_status: 'paid', client_reference_id: user, metadata: { product: 'p99-premium', user_id: user }, line_items: { data: [{ price: { id: 'price_test' }, quantity: 1 }] }, amount_total: 900, payment_intent: 'pi_test' };
async function signature(body: string, timestamp = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`)));
  return `t=${timestamp},v1=${[...bytes].map(value => value.toString(16).padStart(2, '0')).join('')}`;
}
describe('Premium verification', () => {
  it('rejects tampered and stale Stripe notifications', async () => {
    const raw = JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed', data: { object: session } });
    expect((await verifyStripeEvent(raw, await signature(raw), env)).id).toBe('evt_test');
    await expect(verifyStripeEvent(raw + ' ', await signature(raw), env)).rejects.toMatchObject({ status: 400 });
    await expect(verifyStripeEvent(raw, await signature(raw, 1), env)).rejects.toMatchObject({ status: 400 });
  });
  it('grants only a paid, correctly priced session belonging to the signed-in user', async () => {
    const rpc = vi.fn();
    let returned = session;
    const fetcher = (async (url: string | Request, init?: RequestInit) => {
      if (String(url).startsWith('https://api.stripe.com/')) return Response.json(returned);
      rpc(JSON.parse(String(init?.body))); return Response.json(null);
    }) as typeof fetch;
    expect(await fulfillCheckout(session.id, env, fetcher, user)).toBe(true);
    expect(rpc).toHaveBeenCalledWith({ p_user: user, p_session: session.id, p_payment: 'pi_test' });
    rpc.mockClear();
    await expect(fulfillCheckout(session.id, env, fetcher, '22222222-2222-4222-8222-222222222222')).rejects.toMatchObject({ status: 403 });
    returned = { ...session, payment_status: 'unpaid' }; expect(await fulfillCheckout(session.id, env, fetcher, user)).toBe(false);
    returned = { ...session, line_items: { data: [{ price: { id: 'wrong_price' }, quantity: 1 }] } }; expect(await fulfillCheckout(session.id, env, fetcher, user)).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('revokes refunds and disputes by payment identity', async () => {
    const requests: unknown[] = [];
    const fetcher = (async (_url: unknown, init?: RequestInit) => { requests.push(JSON.parse(String(init?.body))); return Response.json(null); }) as typeof fetch;
    for (const type of ['charge.refunded', 'charge.dispute.created']) await processStripeEvent({ type, data: { object: { payment_intent: 'pi_refunded' } } } as Stripe.Event, env, fetcher);
    expect(requests).toEqual([{ p_payment: 'pi_refunded' }, { p_payment: 'pi_refunded' }]);
  });
  it('does not accept a checkout return parameter or anonymous caller as an entitlement', async () => {
    const response = await handleRequest(new Request('https://p99.example/api/billing/checkout?checkout=success', { method: 'POST', headers: { origin: 'https://p99.example' } }), env);
    expect(response.status).toBe(401);
  });
});

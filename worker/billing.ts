import Stripe from 'stripe';
import type { Env } from './jev';
import { adminClient, type AccountContext } from './accounts';
import { ApiError } from './security';

export function stripeClient(env: Env, fetcher: typeof fetch = fetch) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID || !env.STRIPE_WEBHOOK_SECRET) throw new ApiError(503, 'Premium checkout is being set up. Please check back shortly.');
  return new Stripe(env.STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient(fetcher), timeout: 10000, maxNetworkRetries: 1 });
}
export async function createCheckout(context: AccountContext, origin: string, env: Env, fetcher: typeof fetch = fetch) {
  if (!context.user) throw new ApiError(401, 'Sign in before getting Premium so your purchase stays with your account.');
  if (context.premium) throw new ApiError(409, 'Your Premium pass is already active.');
  const stripe = stripeClient(env, fetcher);
  const price = await stripe.prices.retrieve(env.STRIPE_PRICE_ID!);
  if (!price.active || price.type !== 'one_time' || !price.unit_amount || price.unit_amount <= 0) throw new ApiError(503, 'The Premium price is unavailable. Please check back shortly.');
  const session = await stripe.checkout.sessions.create({
    mode: 'payment', line_items: [{ price: price.id, quantity: 1 }], client_reference_id: context.user.id,
    metadata: { product: 'p99-premium', user_id: context.user.id },
    payment_intent_data: { metadata: { product: 'p99-premium', user_id: context.user.id } },
    success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/?checkout=canceled`,
  }, { idempotencyKey: `p99-pass:${context.user.id}:${Math.floor(Date.now() / 300000)}` });
  if (!session.url || new URL(session.url).hostname !== 'checkout.stripe.com') throw new ApiError(503, 'Checkout could not be opened. Try again.');
  return { url: session.url };
}
export async function fulfillCheckout(sessionId: string, env: Env, fetcher: typeof fetch = fetch, expectedUser?: string) {
  const stripe = stripeClient(env, fetcher);
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items'] });
  const userId = session.client_reference_id;
  if (expectedUser && userId !== expectedUser) throw new ApiError(403, 'Sign in with the account that made this purchase.');
  if (session.mode !== 'payment' || session.payment_status !== 'paid' || session.metadata?.product !== 'p99-premium' || session.metadata?.user_id !== userId || !userId || !/^[0-9a-f-]{36}$/i.test(userId)) return false;
  const lines = session.line_items?.data;
  if (lines?.length !== 1 || lines[0].price?.id !== env.STRIPE_PRICE_ID || lines[0].quantity !== 1 || !session.amount_total || session.amount_total <= 0) return false;
  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
  if (!paymentIntent) return false;
  const { error } = await adminClient(env, fetcher).rpc('grant_premium', { p_user: userId, p_session: session.id, p_payment: paymentIntent });
  if (error) throw new ApiError(503, 'Payment verification is pending. Please try Restore purchase shortly.');
  return true;
}
export async function verifyStripeEvent(raw: string, signature: string, env: Env): Promise<Stripe.Event> {
  try { return await stripeClient(env).webhooks.constructEventAsync(raw, signature, env.STRIPE_WEBHOOK_SECRET!, undefined, Stripe.createSubtleCryptoProvider()); }
  catch { throw new ApiError(400, 'Invalid payment notification.'); }
}
export async function processStripeEvent(event: Stripe.Event, env: Env, fetcher: typeof fetch = fetch) {
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    await fulfillCheckout(event.data.object.id, env, fetcher);
  } else if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
    const object = event.data.object;
    const payment = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id;
    if (payment) {
      const { error } = await adminClient(env, fetcher).rpc('revoke_premium_payment', { p_payment: payment });
      if (error) throw new ApiError(503, 'Payment update will be retried.');
    }
  }
}

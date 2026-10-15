// Opt-in verification against the new p99 Supabase project. Creates only disposable test identities.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const config = Object.fromEntries(readFileSync('.dev.vars', 'utf8').split('\n').filter(line => /^[A-Z_]+=/.test(line)).map(line => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1).replace(/^"|"$/g, '')]; }));
if (config.SUPABASE_URL !== 'https://byykgulviqoumyedwnmn.supabase.co') throw new Error('This verifier is restricted to the dedicated p99 project.');
const admin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const testId = crypto.randomUUID();
const subject = `guest:verification-${testId}`;
const payment = `pi_verification_${testId}`;
const refundFirst = `${payment}_refund_first`;
let userId;
try {
  const reservations = await Promise.all(Array.from({ length: 8 }, () => admin.rpc('reserve_search', { p_subject: subject, p_period: 'guest', p_limit: 1 })));
  assert(reservations.every(result => !result.error));
  assert.equal(reservations.filter(result => result.data).length, 1, 'Only one concurrent reservation may succeed');
  const unauthorized = await anon.rpc('reserve_search', { p_subject: subject, p_period: 'guest', p_limit: 100 });
  assert(unauthorized.error, 'Anonymous clients must not grant allowance');
  const inaccessible = await anon.from('premium_entitlements').select('*');
  assert(inaccessible.error, 'Anonymous clients must not read entitlements');
  const created = await admin.auth.admin.createUser({ email: `p99-verification-${testId}@example.invalid`, email_confirm: true });
  assert.ifError(created.error); userId = created.data.user.id;
  const grant = { p_user: userId, p_session: `cs_verification_${testId}`, p_payment: payment };
  assert.ifError((await admin.rpc('grant_premium', grant)).error);
  const first = await admin.from('premium_entitlements').select('expires_at').eq('user_id', userId).single(); assert.ifError(first.error);
  assert(Date.parse(first.data.expires_at) > Date.now() + 29 * 86400000);
  assert.ifError((await admin.rpc('grant_premium', grant)).error);
  const repeated = await admin.from('premium_entitlements').select('expires_at').eq('user_id', userId).single();
  assert.equal(first.data.expires_at, repeated.data.expires_at, 'Duplicate delivery must not extend access');
  assert.ifError((await admin.rpc('revoke_premium_payment', { p_payment: payment })).error);
  const refunded = await admin.from('premium_entitlements').select('expires_at').eq('user_id', userId).maybeSingle();
  assert.ifError(refunded.error);
  assert.equal(refunded.data, null, 'The last refunded purchase must remove its entitlement immediately');
  assert.ifError((await admin.rpc('revoke_premium_payment', { p_payment: refundFirst })).error);
  assert.ifError((await admin.rpc('grant_premium', { ...grant, p_session: `${grant.p_session}_late`, p_payment: refundFirst })).error);
  const late = await admin.from('premium_purchases').select('*').eq('payment_intent', refundFirst);
  assert.ifError(late.error);
  assert.equal(late.data.length, 0, 'A late checkout must not reinstate a refunded purchase');
  console.log('PASS: atomic guest allowance, anonymous access denial, 30-day grant, duplicate delivery, refund and out-of-order payment handling.');
} finally {
  if (userId) { const result = await admin.auth.admin.deleteUser(userId); assert.ifError(result.error); }
  assert.ifError((await admin.from('search_usage').delete().eq('subject', subject)).error);
  assert.ifError((await admin.from('revoked_payments').delete().in('payment_intent', [payment, refundFirst])).error);
  console.log('Disposable verification records removed.');
}

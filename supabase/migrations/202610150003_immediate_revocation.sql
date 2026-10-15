create or replace function public.revoke_premium_payment(p_payment text)
returns void language plpgsql security definer set search_path = public as $$
declare owner_id uuid; expiry timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('payment:' || p_payment, 0));
  insert into revoked_payments(payment_intent) values(p_payment) on conflict do nothing;
  select user_id into owner_id from premium_purchases where payment_intent = p_payment;
  if owner_id is null then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('premium:' || owner_id::text, 0));
  update premium_purchases set revoked = true where payment_intent = p_payment;
  select max(expires_at) into expiry from premium_purchases where user_id = owner_id and not revoked;
  -- Removing the entitlement avoids clock-skew windows between Postgres and Workers.
  if expiry is null then
    delete from premium_entitlements where user_id = owner_id;
  else
    update premium_entitlements set expires_at = expiry where user_id = owner_id;
  end if;
end;
$$;

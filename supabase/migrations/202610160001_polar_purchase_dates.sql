-- Polar orders retain their original purchase date during delayed delivery/restore.
-- Existing payment columns are opaque identifiers, namespaced by provider/environment.
create function public.grant_premium_order(p_user uuid, p_session text, p_payment text, p_purchased_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare expiry timestamptz;
begin
  if p_purchased_at is null or p_purchased_at > now() + interval '5 minutes' then
    raise exception 'Invalid purchase date';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('payment:' || p_payment, 0));
  perform pg_advisory_xact_lock(hashtextextended('premium:' || p_user::text, 0));
  if exists(select 1 from premium_purchases where session_id = p_session or payment_intent = p_payment) then return; end if;
  if exists(select 1 from revoked_payments where payment_intent = p_payment) then return; end if;
  select greatest(p_purchased_at, expires_at) + interval '30 days' into expiry
    from premium_entitlements where user_id = p_user;
  expiry := coalesce(expiry, p_purchased_at + interval '30 days');
  insert into premium_purchases(session_id, payment_intent, user_id, expires_at)
    values(p_session, p_payment, p_user, expiry);
  if expiry > now() then
    insert into premium_entitlements(user_id, expires_at) values(p_user, expiry)
      on conflict(user_id) do update set expires_at = excluded.expires_at;
  end if;
end;
$$;
revoke all on function public.grant_premium_order(uuid,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.grant_premium_order(uuid,text,text,timestamptz) to service_role;

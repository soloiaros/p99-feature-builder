create table public.premium_purchases (
  session_id text primary key,
  payment_intent text unique not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  revoked boolean not null default false
);
-- Tombstones handle refunds arriving before checkout webhooks.
create table public.revoked_payments (payment_intent text primary key, created_at timestamptz not null default now());
alter table public.premium_purchases enable row level security;
alter table public.revoked_payments enable row level security;
revoke all on public.premium_purchases, public.revoked_payments from anon, authenticated;
grant all on public.premium_purchases, public.revoked_payments to service_role;

create function public.grant_premium(p_user uuid, p_session text, p_payment text)
returns void language plpgsql security definer set search_path = public as $$
declare expiry timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('payment:' || p_payment, 0));
  perform pg_advisory_xact_lock(hashtextextended('premium:' || p_user::text, 0));
  if exists(select 1 from premium_purchases where session_id = p_session or payment_intent = p_payment) then return; end if;
  if exists(select 1 from revoked_payments where payment_intent = p_payment) then return; end if;
  select greatest(now(), coalesce(expires_at, now())) + interval '30 days' into expiry from premium_entitlements where user_id = p_user;
  expiry := coalesce(expiry, now() + interval '30 days');
  insert into premium_purchases(session_id, payment_intent, user_id, expires_at) values(p_session, p_payment, p_user, expiry);
  insert into premium_entitlements(user_id, expires_at) values(p_user, expiry)
    on conflict(user_id) do update set expires_at = excluded.expires_at;
end;
$$;
create function public.revoke_premium_payment(p_payment text)
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
  update premium_entitlements set expires_at = coalesce(expiry, now()) where user_id = owner_id;
end;
$$;
revoke all on function public.grant_premium(uuid,text,text), public.revoke_premium_payment(text) from public, anon, authenticated;
grant execute on function public.grant_premium(uuid,text,text), public.revoke_premium_payment(text) to service_role;

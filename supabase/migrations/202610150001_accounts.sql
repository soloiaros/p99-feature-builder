-- Run with the Supabase SQL editor or migration CLI. Only the trusted Worker uses these tables.
create table public.premium_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);
create table public.search_usage (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  period text not null,
  created_at timestamptz not null default now()
);
create index search_usage_subject_period on public.search_usage(subject, period);
alter table public.premium_entitlements enable row level security;
alter table public.search_usage enable row level security;
revoke all on public.premium_entitlements, public.search_usage from anon, authenticated;
grant all on public.premium_entitlements, public.search_usage to service_role;

create function public.reserve_search(p_subject text, p_period text, p_limit integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare reservation uuid;
begin
  if p_limit < 1 or p_limit > 10000 then raise exception 'Invalid allowance'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_subject || ':' || p_period, 0));
  if (select count(*) from search_usage where subject = p_subject and period = p_period) >= p_limit then return null; end if;
  insert into search_usage(subject, period) values (p_subject, p_period) returning id into reservation;
  return reservation;
end;
$$;
revoke all on function public.reserve_search(text, text, integer) from public, anon, authenticated;
grant execute on function public.reserve_search(text, text, integer) to service_role;

-- Erase account usage along with the Supabase account.
create function public.erase_account_usage() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from search_usage where subject = 'user:' || old.id::text;
  return old;
end;
$$;
create trigger erase_account_usage before delete on auth.users for each row execute function public.erase_account_usage();
revoke all on function public.erase_account_usage() from public;

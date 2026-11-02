-- MESITA-3123 — a daily budget on the Business Claim search.
--
-- business-web-find-place runs Google Autocomplete + Text Search for every
-- search (MESITA-3112). Any Google account can sign in to the Business app,
-- so without a budget one account could run up the Places bill. Each search
-- takes one slot here before any Google spend; past the cap in a rolling
-- 24 hours the search answers "try again tomorrow".

create table public.business_search_attempts (
  id bigint generated always as identity primary key,
  account_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);

create index business_search_attempts_account_idx on public.business_search_attempts (account_id, at);

alter table public.business_search_attempts enable row level security;
revoke all on table public.business_search_attempts from public, anon, authenticated;
grant all on table public.business_search_attempts to service_role;

comment on table public.business_search_attempts is
  'MESITA-3123 One row per Business Claim search, taken by business_search_take before any Google spend. Rows older than a day are pruned by the same call. EF-only.';

-- Takes one search slot for this account; false when the rolling 24 h budget
-- is spent (the rejected attempt leaves no row, so retries don't extend it).
create or replace function public.business_search_take(p_account_id uuid, p_cap integer)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_used integer;
begin
  if p_cap is null or p_cap < 1 then
    raise exception 'business_search_take: cap must be positive (%)', p_cap;
  end if;
  perform pg_advisory_xact_lock(hashtext('business_search:' || p_account_id::text));
  delete from public.business_search_attempts
   where account_id = p_account_id and at < now() - interval '1 day';
  select count(*) into v_used from public.business_search_attempts where account_id = p_account_id;
  if v_used >= p_cap then
    return false;
  end if;
  insert into public.business_search_attempts (account_id) values (p_account_id);
  return true;
end;
$function$;

revoke all on function public.business_search_take(uuid, integer) from public;
revoke execute on function public.business_search_take(uuid, integer) from anon, authenticated;
grant execute on function public.business_search_take(uuid, integer) to service_role;

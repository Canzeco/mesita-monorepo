-- MESITA-4460: how often a Premier ad reached a screen, and how often a
-- guest opened it. Two counters, not a row per view. Only service_role
-- writes them, and only for a place that is on a paid plan.

create table public.premier_ad_counts (
  place_id uuid primary key references public.places (id) on delete cascade,
  impressions bigint not null default 0,
  taps bigint not null default 0,
  constraint premier_ad_counts_nonneg check (impressions >= 0 and taps >= 0)
);

alter table public.premier_ad_counts enable row level security;
revoke all on table public.premier_ad_counts from public, anon, authenticated;
grant select, insert, update on table public.premier_ad_counts to service_role;

create or replace function public.record_premier_ad(p_place uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind not in ('impression', 'tap') then
    return;
  end if;
  if not exists (
    select 1 from public.places
    where id = p_place and coalesce(boost_tier, 0) > 0
  ) then
    return;
  end if;
  insert into public.premier_ad_counts (place_id, impressions, taps)
  values (
    p_place,
    case when p_kind = 'impression' then 1 else 0 end,
    case when p_kind = 'tap' then 1 else 0 end
  )
  on conflict (place_id) do update set
    impressions = public.premier_ad_counts.impressions + excluded.impressions,
    taps = public.premier_ad_counts.taps + excluded.taps;
end;
$$;

revoke all on function public.record_premier_ad(uuid, text) from public, anon, authenticated;
grant execute on function public.record_premier_ad(uuid, text) to service_role;

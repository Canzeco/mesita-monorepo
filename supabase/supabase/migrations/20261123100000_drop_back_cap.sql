-- MESITA-4729 — THE BACK CAP IS GONE FOR GOOD. MESITA-4728 stopped every
-- reader and writer of the per-bill cap (Pato, 2026-11-23: "there is no
-- ceiling for the cashback amount"); its columns are zombies (Pato: "IS OKEY
-- IF YOU DELETE ZOMBIE ... COLUMNS"). place_cashback_rates returns the lines
-- and the story reward only.

drop function if exists public.place_cashback_rates(uuid);
create function public.place_cashback_rates(p_place_id uuid)
 returns table (welcome_bps integer, returning_bps integer, story_reward_cents integer)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select coalesce(s.welcome_bps, d.welcome_bps, 1000), coalesce(s.returning_bps, d.returning_bps, 500),
         coalesce(s.story_reward_cents, d.story_reward_cents, 2000)
    from (select 1) one
    left join public.cashback_defaults d on d.id
    left join public.place_cashback_settings s on s.place_id = p_place_id;
$function$;
revoke all on function public.place_cashback_rates(uuid) from public, anon, authenticated;
grant execute on function public.place_cashback_rates(uuid) to service_role;
comment on function public.place_cashback_rates(uuid) is
  'MESITA-4698, MESITA-4700, MESITA-4709, MESITA-4714, MESITA-4729: what binds a place now (Welcome, Returning, story reward): its own row, else cashback_defaults, else 10/5 %, MX$20. No cap. Internal.';

alter table public.place_cashback_settings drop column if exists cap_cents;
alter table public.cashback_defaults drop column if exists cap_cents;

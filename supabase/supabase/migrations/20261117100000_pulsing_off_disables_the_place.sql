-- MESITA-4233 — Pulsing off hides the place (Pato, 2026-11-17: "if place
-- state pulsing is off, then automatically put that place as disabled in
-- mesita too. hide it.").
--
-- Pulsing is Google's business status (`place_profiles.business_state`).
-- When Google says CLOSED_TEMPORARILY or CLOSED_PERMANENTLY the place is
-- Disabled: `places.state` active → paused, the state the Disable button
-- writes (admin-web-set-place-listed). The rule lives in the database so
-- every writer obeys it: Fast Update, Create, Enrich's Google spine and the
-- wrong-number refetch all set business_state.
--
-- This reverses MESITA-1239's "a flag, never a gate" by Pato's call.
--
-- One way only (decision, MESITA-4233): Google saying OPERATIONAL again does
-- not re-enable. An operator's own Disable looks the same as this one, and
-- Enable is one button. Only an active place is touched; archived stays
-- archived.

create or replace function public.pulsing_off_disables_the_place()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.business_state in ('CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY')
     and (tg_op = 'INSERT' or old.business_state is distinct from new.business_state) then
    update public.places set state = 'paused' where id = new.id and state = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists pulsing_off_disables_the_place on public.place_profiles;
create trigger pulsing_off_disables_the_place
  after insert or update of business_state on public.place_profiles
  for each row execute function public.pulsing_off_disables_the_place();

-- The same rule when the places row lands after its profile already says
-- closed (the profile can be written first).
create or replace function public.new_place_starts_disabled_when_closed()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.state = 'active' and exists (
    select 1 from public.place_profiles pp
     where pp.id = new.id
       and pp.business_state in ('CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY')
  ) then
    new.state := 'paused';
  end if;
  return new;
end;
$$;

drop trigger if exists new_place_starts_disabled_when_closed on public.places;
create trigger new_place_starts_disabled_when_closed
  before insert on public.places
  for each row execute function public.new_place_starts_disabled_when_closed();

revoke execute on function public.pulsing_off_disables_the_place() from public, anon, authenticated;
revoke execute on function public.new_place_starts_disabled_when_closed() from public, anon, authenticated;

-- Every place already closed on Google, once (live 2026-11-17: 3 active
-- places CLOSED_TEMPORARILY).
update public.places p
   set state = 'paused'
  from public.place_profiles pp
 where pp.id = p.id
   and p.state = 'active'
   and pp.business_state in ('CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY');

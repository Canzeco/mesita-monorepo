-- MESITA-2400 — saved locations move to the server (guest-owned).
--
-- A guest's saved pins (Home, Office…; MESITA-2380, confirmed pins since
-- MESITA-2501) lived in one browser. This row follows the guest to every
-- device. The browser keeps its list as the cache that paints first; the
-- server is the source of truth once signed in.
--
-- EF-only, like place_activity: RLS on, no policies, client roles hold
-- nothing. consumer-web-list-saved-locations reads a guest's own rows and
-- consumer-web-save-location writes them, both keyed by the JWT's user id.
--
-- The field map is MESITA-2501's, one-to-one. `id` is the browser's own id
-- (text) so the Home's active pin keeps pointing at the same entry when this
-- browser's list is pushed up once.
--
-- GOOGLE'S NAMES EXPIRE (its terms allow only temporary caching):
-- `suggested_name` and `formatted_address` come from Google Geocoding and
-- are kept at most 30 days after `named_at`. The daily job below clears
-- them and marks the row `needs_name`; the consumer's backfill fetches them
-- again the next time the guest opens Home. `custom_name` is the guest's own
-- and never expires, and an edited name (`name_edited`) is the guest's too.

create table public.saved_locations (
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  id text not null check (length(id) between 1 and 64),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  suggested_name text check (suggested_name is null or length(suggested_name) <= 200),
  custom_name text check (custom_name is null or length(custom_name) <= 200),
  formatted_address text check (formatted_address is null or length(formatted_address) <= 400),
  location_kind text not null default 'point' check (location_kind = 'point'),
  name_edited boolean not null default false,
  named_at timestamptz,
  needs_name boolean not null default false,
  unconfirmed boolean not null default false,
  legacy_name text check (legacy_name is null or length(legacy_name) <= 200),
  -- The list's order, newest first: a save or a move to the front stamps
  -- it; a backfill (written in place) does not.
  ordered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (consumer_id, id)
);

comment on table public.saved_locations is
  'MESITA-2400: a guest''s saved pins (MESITA-2501 field map), at most 8 per guest. EF-only (RLS, no policies; client privileges revoked). Google-made names expire after 30 days (expire-saved-location-names).';

create index saved_locations_named_at_idx
  on public.saved_locations (named_at)
  where named_at is not null;

alter table public.saved_locations enable row level security;
revoke all on table public.saved_locations from public, anon, authenticated;
grant all on table public.saved_locations to service_role;

-- The 30-day rule, in one place: Google's names on rows named more than 30
-- days ago are cleared and the row asks to be named again.
create or replace function public.expire_saved_location_names()
returns integer
language sql
security definer
set search_path = public
as $$
  with expired as (
    update public.saved_locations
       set suggested_name = case when name_edited then suggested_name else null end,
           formatted_address = null,
           named_at = null,
           needs_name = true,
           updated_at = now()
     where named_at < now() - interval '30 days'
    returning 1
  )
  select count(*)::integer from expired
$$;

revoke all on function public.expire_saved_location_names() from public, anon, authenticated;
grant execute on function public.expire_saved_location_names() to service_role;

select cron.unschedule('expire-saved-location-names')
where exists (select 1 from cron.job where jobname = 'expire-saved-location-names');

select cron.schedule(
  'expire-saved-location-names',
  '23 4 * * *',
  $$ select public.expire_saved_location_names() $$
);

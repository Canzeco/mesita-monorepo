-- MESITA-1051: retain prior Google names for search recall.
-- google_name is a cache of Google's current label. When Details refreshes
-- it, yesterday's string disappears from the two-leg ILIKE
-- (name | google_name). Identity is still google_place_id; this table is
-- recall only.
--
-- ON DELETE RESTRICT: a place with name history is not history-free, so
-- the deletion law forbids a silent cascade (Atlas §C). Admin reset
-- truncates operational tables; this one is not in admin_reset_preserve.

create table if not exists public.place_name_history (
  place_id uuid not null references public.places (id) on delete restrict,
  google_name text not null,
  retired_at timestamptz not null default now(),
  primary key (place_id, google_name)
);

comment on table public.place_name_history is
  'MESITA-1051: prior Google labels for a place. Search ILIKE third leg. Not identity.';

create index if not exists place_name_history_name_idx
  on public.place_name_history (google_name);

alter table public.place_name_history enable row level security;
revoke all on table public.place_name_history from public, anon, authenticated;
grant select, insert, update, delete on table public.place_name_history to service_role;

create or replace function public.place_name_history_capture()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and new.google_name is distinct from old.google_name
     and nullif(btrim(old.google_name), '') is not null then
    insert into public.place_name_history (place_id, google_name)
    values (old.id, btrim(old.google_name))
    on conflict (place_id, google_name) do update
      set retired_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists place_name_history_capture_trg on public.places;
create trigger place_name_history_capture_trg
  before update of google_name on public.places
  for each row
  execute function public.place_name_history_capture();

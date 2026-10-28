-- MESITA-2556: who granted a VIP, and until when — the schema before any
-- partner rate ships. NO rate, discount or eligibility rule lives here: those
-- are Pato's open product decisions, and nothing reads these columns for a
-- rule. VIP stays an operator's choice (admin_set_guest_standing).
--
--   vip_partners             the partners VIP comes through (an agency, a
--                            creator deal, a venue). place_id marks a partner
--                            that IS a Mesita venue: the partner-venue list.
--   consumers.vip_partner_id which partner this guest's VIP came through.
--   consumers.vip_until      the last day the VIP runs, or null for no end
--                            date. Recorded and shown, never enforced: no job
--                            demotes a VIP when it passes (whether VIP expires
--                            is undecided). An operator flips the class.
--
-- Both guest columns are VIP-only: a Regular guest holds neither (CHECK).
-- guest_class_note stays the operator-only free text beside them.

-- (a) The partners. EF-only: RLS on, no policy, no client grant.
create table if not exists public.vip_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  place_id uuid unique references public.places (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint vip_partners_name_check
    check (name = btrim(name) and char_length(name) between 1 and 80)
);
create unique index if not exists vip_partners_name_key
  on public.vip_partners (lower(name));

alter table public.vip_partners enable row level security;
revoke all on table public.vip_partners from public, anon, authenticated;
grant select, insert, update, delete on table public.vip_partners to service_role;

comment on table public.vip_partners is
  'MESITA-2556: the partners VIP comes through (agency, creator deal, venue). place_id set = a partner venue. Names no rate. EF-only (admin-web-save-vip-partner writes, admin-web-list-guests reads).';
comment on column public.vip_partners.place_id is
  'MESITA-2556: the Mesita place this partner is, when it is a venue. At most one partner per place.';

-- (b) The guest side.
alter table public.consumers
  add column if not exists vip_partner_id uuid
    references public.vip_partners (id) on delete set null,
  add column if not exists vip_until date;

alter table public.consumers drop constraint if exists consumers_vip_fields_check;
alter table public.consumers
  add constraint consumers_vip_fields_check
  check (guest_class = 'vip' or (vip_partner_id is null and vip_until is null));

create index if not exists consumers_vip_partner_id_idx
  on public.consumers (vip_partner_id) where vip_partner_id is not null;

comment on column public.consumers.vip_partner_id is
  'MESITA-2556: the partner this VIP came through. VIP only (consumers_vip_fields_check). Shown to the guest on their own Class sheet, never to other members. Written only by admin_set_guest_standing.';
comment on column public.consumers.vip_until is
  'MESITA-2556: last day of this VIP, or null for no end date. Recorded and shown, never enforced (no job demotes). VIP only. Written only by admin_set_guest_standing.';

-- (c) The one writer grows the two fields. Going Regular clears both unless
-- the same call sets them (which the CHECK then refuses: a Regular guest has
-- no partner). The old six-argument signature goes; admin-web-set-guest-standing
-- is the only caller and ships in the same PR.
drop function if exists public.admin_set_guest_standing(uuid, text, text, text, boolean, uuid);

create or replace function public.admin_set_guest_standing(
  p_consumer uuid,
  p_guest_class text,
  p_plan text,
  p_note text,
  p_note_set boolean,
  p_partner uuid,
  p_partner_set boolean,
  p_vip_until date,
  p_vip_until_set boolean,
  p_actor uuid
) returns setof public.consumers
language sql
volatile
security definer
set search_path = public
as $$
  update public.consumers c
     set guest_class = coalesce(p_guest_class, c.guest_class),
         plan = coalesce(p_plan, c.plan),
         guest_class_note = case when p_note_set then p_note else c.guest_class_note end,
         vip_partner_id = case
           when p_partner_set then p_partner
           when coalesce(p_guest_class, c.guest_class) = 'regular' then null
           else c.vip_partner_id end,
         vip_until = case
           when p_vip_until_set then p_vip_until
           when coalesce(p_guest_class, c.guest_class) = 'regular' then null
           else c.vip_until end,
         guest_class_set_at = case
           when p_guest_class is not null and p_guest_class is distinct from c.guest_class
             then now() else c.guest_class_set_at end,
         guest_class_set_by = case
           when p_guest_class is not null and p_guest_class is distinct from c.guest_class
             then p_actor else c.guest_class_set_by end
   where c.id = p_consumer
     and c.deleted_at is null
  returning c.*
$$;

revoke execute on function public.admin_set_guest_standing(uuid, text, text, text, boolean, uuid, boolean, date, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_set_guest_standing(uuid, text, text, text, boolean, uuid, boolean, date, boolean, uuid)
  to service_role;

-- MESITA-3850 — VIP is automatic: a verified Instagram with more than 5,000
-- followers. Pato, 2026-11-14: "more than 5K followers. you are VIP. easy
-- peasy." … "Not manual for the moment. Only automatic."
--
-- consumers.guest_class becomes a STORED GENERATED column, so it can never
-- drift from the rule: it follows instagram_verified_at and
-- instagram_followers_count (written only by consumer_instagram_verify and
-- consumer_instagram_sync, from a server scrape; the app never sends a
-- count). Disconnecting Instagram, or a sync at 5,000 or below, makes the
-- guest Regular again. Every reader (the VIP voucher's gate, the identity
-- card, owner activity) reads the same column as before.
--
-- The manual doors close: the invitation code's redeem function goes, and
-- admin_set_guest_standing refuses a class (Plan, the note, the partner and
-- the last day stay). vip_partners, vip_invitation_codes and their attempts
-- stay as records "for the moment".
--
-- Live on 2026-11-14: 6 guests, 4 verified, none over 5,000, none VIP, no
-- code ever issued, so nobody changes class at deploy.

drop function if exists public.consumer_redeem_vip_invitation(uuid, text);

-- A VIP who falls back to Regular may keep a recorded partner or last day,
-- so the VIP-only check would refuse the follower sync itself.
alter table public.consumers drop constraint if exists consumers_vip_fields_check;
alter table public.consumers drop constraint if exists consumers_guest_class_check;
alter table public.consumers drop column guest_class;

alter table public.consumers
  add column guest_class text
  generated always as (
    case
      when instagram_verified_at is not null
       and coalesce(instagram_followers_count, 0) > 5000
        then 'vip'
      else 'regular'
    end
  ) stored;

alter table public.consumers
  add constraint consumers_guest_class_check
  check (guest_class in ('regular', 'vip'));

comment on column public.consumers.guest_class is
  'Class (MESITA-3850): vip exactly when Instagram is verified and has more than 5,000 followers, else regular. Generated; nothing writes it.';

-- Same signature, so admin-web-set-guest-standing keeps its call; a class is
-- refused loudly instead of being ignored.
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
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if p_guest_class is not null then
    raise exception 'guest_class is automatic (MESITA-3850)' using errcode = '22023';
  end if;
  return query
  update public.consumers c
     set plan = coalesce(p_plan, c.plan),
         guest_class_note = case when p_note_set then p_note else c.guest_class_note end,
         vip_partner_id = case when p_partner_set then p_partner else c.vip_partner_id end,
         vip_until = case when p_vip_until_set then p_vip_until else c.vip_until end
   where c.id = p_consumer
     and c.deleted_at is null
  returning c.*;
end;
$$;
revoke execute on function public.admin_set_guest_standing(uuid, text, text, text, boolean, uuid, boolean, date, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_set_guest_standing(uuid, text, text, text, boolean, uuid, boolean, date, boolean, uuid)
  to service_role;

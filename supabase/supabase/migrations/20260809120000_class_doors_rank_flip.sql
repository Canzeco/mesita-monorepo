-- MESITA-972 — Classes as doors.
--
-- 1) Canonical ladder rank flip: standard(0) < influencer(1) < premium(2)
--    < aura(3). Shipped ranks had premium(1) < influencer(2) — backwards vs
--    the money ladder (class steps: influencer +5, premium +10), so a paying
--    subscriber who claimed ≥2,000 followers was flipped onto the LOWER-paying
--    Influencer class by the rank guard in consumer-web-claim-instagram while
--    Stripe kept billing. rank is UNIQUE, so the swap parks influencer on a
--    temp rank first.
--
-- 2) Invitation-door fact columns. A consumer can hold several open doors at
--    once (reach / subscription / invitation); the slot columns
--    (class_key/class_origin/...) become a CACHE of the highest-ranked open
--    door. Reach (consumer_instagram_followers_count) and the paid door
--    (consumer_subscriptions) already have fact storage; the invitation door
--    lived only inside the slot. Give it its own columns and backfill from
--    slots that currently carry it.

update public.classes set rank = 100 where key = 'influencer';
update public.classes set rank = 2   where key = 'premium';
update public.classes set rank = 1   where key = 'influencer';

alter table public.consumers
  add column if not exists invitation_class_key text references public.classes(key),
  add column if not exists invitation_granted_at timestamptz;

comment on column public.consumers.invitation_class_key is
  'Invitation door fact (admin-web-grant-class). The class slot is the computed max over open doors — never treat it as the door itself.';

update public.consumers
   set invitation_class_key  = class_key,
       invitation_granted_at = coalesce(class_granted_at, now())
 where class_origin = 'invitation'
   and invitation_class_key is null;

notify pgrst, 'reload schema';

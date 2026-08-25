-- Wave 1 identity. Class and plan are two axes. metals live on classes.key.
-- consumers.plan is what the guest pays. identityForClassKey keeps mapping
-- leftover legacy keys (standard/influencer/premium/aura) on the way in.

alter table public.consumers
  add column if not exists plan text;

update public.consumers
   set plan = case when class_key = 'premium' then 'premium' else 'free' end
 where plan is null;

alter table public.consumers
  alter column plan set default 'free';

update public.consumers set plan = 'free' where plan is null;

alter table public.consumers
  alter column plan set not null;

alter table public.consumers drop constraint if exists consumers_plan_check;
alter table public.consumers
  add constraint consumers_plan_check
  check (plan in ('free', 'premium'));

comment on column public.consumers.plan is
  'What the guest pays: free | premium. Independent of class_key (metals).';

insert into public.classes (
  key, label, rank, follower_threshold, monthly_reservation_limit
) values
  ('bronze',  'Bronze',  10, null,  2),
  ('silver',  'Silver',  11, 1000, 10),
  ('gold',    'Gold',    12, null, 10),
  ('diamond', 'Diamond', 13, 20000, 10)
on conflict (key) do nothing;

update public.consumers
   set class_key = case class_key
     when 'standard'   then 'bronze'
     when 'influencer' then 'silver'
     when 'premium'    then 'bronze'
     when 'aura'       then 'diamond'
     else class_key
   end;

update public.consumers
   set invitation_class_key = case invitation_class_key
     when 'standard'   then 'bronze'
     when 'influencer' then 'silver'
     when 'premium'    then 'bronze'
     when 'aura'       then 'diamond'
     else invitation_class_key
   end
 where invitation_class_key is not null;

update public.consumer_invite_codes
   set class_key = case class_key
     when 'standard'   then 'bronze'
     when 'influencer' then 'silver'
     when 'premium'    then 'bronze'
     when 'aura'       then 'diamond'
     else class_key
   end
 where class_key in ('standard', 'influencer', 'premium', 'aura');

update public.consumers
   set sex = null
 where sex is not null and sex not in ('male', 'female');

-- Subscription is a PLAN, not a class origin. Remap before the CHECK shrinks.
update public.consumers
   set class_origin = 'default',
       class_expires_at = null
 where class_origin = 'subscription';

alter table public.consumers
  alter column class_key set default 'bronze';

delete from public.classes
 where key in ('standard', 'influencer', 'premium', 'aura');

update public.classes
   set rank = case key
     when 'bronze'  then 0
     when 'silver'  then 1
     when 'gold'    then 2
     when 'diamond' then 3
     else rank
   end;

alter table public.classes drop column if exists recommendation_weight;

update public.project_plans
   set label = 'Partner'
 where key = 'pro';

alter table public.consumers drop constraint if exists consumers_tier_origin_check;
alter table public.consumers drop constraint if exists consumers_class_origin_check;
alter table public.consumers
  add constraint consumers_class_origin_check
  check (class_origin = any (array['default'::text, 'instagram'::text, 'invitation'::text]));

alter table public.consumers drop constraint if exists consumers_sex_check;
alter table public.consumers
  add constraint consumers_sex_check
  check (sex is null or sex = any (array['male'::text, 'female'::text]));

alter table public.consumers drop constraint if exists consumers_tier_key_fkey;
alter table public.consumers drop constraint if exists consumers_class_key_fkey;
alter table public.consumers
  add constraint consumers_class_key_fkey
  foreign key (class_key) references public.classes(key);

-- Ghost names from membership_tiers. Do NOT drop the pkey — ON CONFLICT (key)
-- and every class_key FK need it. Rename only.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.classes'::regclass
      and conname = 'membership_tiers_pkey'
  ) then
    alter table public.classes rename constraint membership_tiers_pkey to classes_pkey;
  end if;
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.classes'::regclass
      and conname = 'membership_tiers_rank_key'
  ) then
    alter table public.classes rename constraint membership_tiers_rank_key to classes_rank_key;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from public.classes where key = 'bronze' and rank = 0) then
    raise exception 'bronze class missing after metal cutover';
  end if;
  if exists (
    select 1 from public.classes
    where key in ('standard', 'influencer', 'premium', 'aura')
  ) then
    raise exception 'legacy class keys still present';
  end if;
  if exists (
    select 1 from public.consumers
    where class_key not in ('bronze', 'silver', 'gold', 'diamond')
  ) then
    raise exception 'consumer class_key is not a metal';
  end if;
end $$;

-- FIRST STAGE SCHEMA CUT (Pato, 2026-10-10 · MESITA-2091 · P-MESITA-29).
--
-- "kill the unused supabase tables / kill the unused supabase columns".
-- First Stage is Citywide Catalog · Discovery Engines · Reservations Agent,
-- served by web-admin, web-consumer and web-landing. Everything the Second
-- Stage needed (claims and members, verification, plans and memberships,
-- visit tickets, Credits, Mesita Pay, Stripe, classes, promos, orders) goes:
-- 30 tables, 66 columns (consumer_notifications.ticket_id included), 19
-- functions, 9 enums, 1 cron job, 2 storage policies, and the
-- `is_place_member` half of 9 more.
--
-- ══ MERGE ORDER — READ BEFORE MERGING ═════════════════════════════════════
--
-- Migrations auto-apply on merge to main; Edge Functions deploy separately.
-- This file therefore merges LAST:
--   1. MESITA-2090 (Edge Functions cut) has landed and deployed, so no
--      deleted EF is left in the cloud calling a dropped table.
--   2. MESITA-2120 has landed and deployed. It removes every surviving EF
--      read of what this file drops — the column lists in
--      _shared/place-columns.ts, reservation-places.ts, consumer-search-lane.ts,
--      memo-place-card.ts, save-place.ts (verification_config, listing_type),
--      the class/plan/subscription reads in get-profile, claim-instagram,
--      create-reservation (the per-class cap) and delete-account, the
--      ticket_reviews read in get-place, the visit_tickets join in
--      list-pay-notifications, place_members/place_verifications in the
--      admin-web place EFs, and the orders_enabled write in the contents
--      stage. Several columns below are dropped ONLY because 2120 removes
--      their last reader; merging this before 2120 deploys 42703s and 42P01s
--      the consumer place screen, Search, reservations and the enricher.
--
-- ══ DATA AT APPLY TIME (verified live on yjalywfzdelacdzccpgb, 2026-10-10) ═
--
-- Every dropped table holds 0 rows except four vocabularies: classes (4),
-- place_plans (3), consumer_plans (2), membership_plans (1). No money has
-- ever moved. Step 0 re-checks that at apply time and REFUSES if a money
-- table has gained a row since — dropping a real balance is irreversible.
--
-- ══ DECISIONS (logged on MESITA-2091) ═════════════════════════════════════
--
--   consumer_notifications  KEPT, minus its visit_tickets coupling. Me ›
--                           Notifications renders kinds 'reservation' and
--                           'booking' (web-consumer notification-row.tsx
--                           RESERVATION_KINDS); MESITA-2120 adds the writer.
--   place_field_proposals   DROPPED. The keep condition was "admin-web-update-
--                           place still writes it". It does not: it calls only
--                           persistBusinessFieldPins, which writes
--                           place_profiles.enrichment_sources; the only writer
--                           of the table, submitFieldProposal, has no caller.
--   favorites               DROPPED. No surviving EF or app reads or writes it;
--                           web-consumer keeps saves in the browser
--                           (lib/saved-places.ts).
--   consumer_connectors     DROPPED (no caller after MESITA-2090).
--   place_requests,
--   consumer_code_counter   KEPT.
--   places.currency         KEPT. It still formats the consumer price range.
--   trigger_key CHECK       place_enrichment_runs_trigger_key_check still lists
--                           'on_visit' and 'on_order'. LEFT ALONE: the same
--                           vocabulary is live in _shared/enrich-triggers.ts and
--                           app_config.enrichment_triggers, so it narrows with
--                           that code, not here.
--
-- ══ ORDER ═════════════════════════════════════════════════════════════════
--
-- Every object goes after what depends on it, and nothing uses CASCADE: a
-- dependency this file did not name fails the migration instead of silently
-- taking a policy or a trigger with it.
--
--   0. refuse if a money table holds rows
--   1. unschedule the Second Stage cron job (before its function goes)
--   2. storage: ticket-proofs policies go; the 9 place-bucket write policies
--      lose is_place_member (before is_place_member goes)
--   3. drop the profiles view (its columns cannot drop while it exists, 2BP01)
--   4. consumer_notifications loses ticket_id (before visit_tickets goes)
--   5. tables, children before parents; the consumers and places FK columns
--      to classes and managers go before those two tables
--   6. the remaining columns
--   7. functions (trigger functions after their tables)
--   8. enums (after every column and the view)
--   9. profiles_insert / profiles_update rewritten
--  10. profiles recreated WITH (security_invoker = true), re-granted, its
--      INSTEAD OF triggers rebound
--  11. admin_reset_database: a whole new body, and its registry pruned
--  12. post-flight assertions
--
-- The ticket-proofs BUCKET itself is not deleted here: storage.protect_buckets_delete
-- refuses a SQL delete. Empty and delete it through the Storage API after merge.

-- ══════════════════════════════════════════════════════════════════════════
-- 0. REFUSE TO DROP MONEY
-- ══════════════════════════════════════════════════════════════════════════

do $money_guard$
declare
  t text;
  n bigint;
  holding text[] := '{}';
begin
  foreach t in array array[
    'credit_lots', 'credit_ledger', 'credit_gifts', 'credit_gift_redeem_events',
    'visit_tickets', 'visit_ticket_payments', 'place_payment_accounts',
    'place_guest_customers', 'consumer_subscriptions', 'place_subscriptions',
    'partner_memberships', 'stripe_events'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('select count(*) from public.%I', t) into n;
      if n > 0 then
        holding := holding || format('%s (%s rows)', t, n);
      end if;
    end if;
  end loop;

  if cardinality(holding) > 0 then
    raise exception
      'First Stage cut refused: % now hold rows. These tables carried no money when MESITA-2091 was written; a human decides before they are dropped.',
      array_to_string(holding, ', ');
  end if;
end $money_guard$;

-- Every hot table this file rewrites, locked once, up front, in one fixed
-- order: a live EF holding one of them makes this wait at most 20s and fail
-- cleanly instead of deadlocking halfway through the cut. Inside a DO block
-- because a top-level LOCK TABLE errors when the runner does not open an
-- explicit transaction; the lock still lasts until this file commits.
do $lock_hot_tables$
begin
  perform set_config('lock_timeout', '20s', true);
  lock table public.place_profiles, public.places, public.consumers,
    public.consumer_notifications in access exclusive mode;
end $lock_hot_tables$;

-- ══════════════════════════════════════════════════════════════════════════
-- 1. CRON
-- ══════════════════════════════════════════════════════════════════════════
--
-- The only Second Stage job. The other six (prune-cron-run-details,
-- run-reservation-retries, close-stale-place-enrichment-runs,
-- prune-place-enrichment-runs, run-place-enrichment-stages,
-- queue-due-place-enrichments) all serve First Stage and stay. Guarded so a
-- replay where the job was never scheduled does not fail.

select cron.unschedule('sweep-expired-credit-lots')
where exists (select 1 from cron.job where jobname = 'sweep-expired-credit-lots');

-- ══════════════════════════════════════════════════════════════════════════
-- 2. STORAGE POLICIES
-- ══════════════════════════════════════════════════════════════════════════
--
-- ticket-proofs held visit-story screenshots (0 objects live). Only its
-- policies go here; the bucket is a Storage API follow-up.

drop policy if exists "ticket_proofs_owner_insert" on storage.objects;
drop policy if exists "ticket_proofs_public_read" on storage.objects;

-- place-images, menu-images and menu-pdfs stay: web-admin uploads to them
-- straight from the browser (lib/place-upload-utils.ts), as a super admin.
-- Their write policies read `is_super_admin() OR is_place_member(...)`, and
-- place members no longer exist, so each one is recreated with the
-- super-admin half alone and named for what it now allows. The bucket,
-- 'business' prefix and place-uuid folder checks are unchanged. The two
-- public-read policies (menu-images, menu-pdfs) are untouched.

drop policy if exists "place_images_member_or_admin_insert" on storage.objects;
drop policy if exists "place_images_member_or_admin_update" on storage.objects;
drop policy if exists "place_images_member_or_admin_delete" on storage.objects;
drop policy if exists "menu_images_member_or_admin_insert" on storage.objects;
drop policy if exists "menu_images_member_or_admin_update" on storage.objects;
drop policy if exists "menu_images_member_or_admin_delete" on storage.objects;
drop policy if exists "menu_pdfs_member_or_admin_insert" on storage.objects;
drop policy if exists "menu_pdfs_member_or_admin_update" on storage.objects;
drop policy if exists "menu_pdfs_member_or_admin_delete" on storage.objects;

drop policy if exists "place_images_admin_insert" on storage.objects;
create policy "place_images_admin_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'place-images'
    and (storage.foldername(name))[1] = 'business'
    and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_super_admin()
  );

drop policy if exists "place_images_admin_update" on storage.objects;
create policy "place_images_admin_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'place-images'
    and (storage.foldername(name))[1] = 'business'
    and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_super_admin()
  )
  with check (
    bucket_id = 'place-images'
    and (storage.foldername(name))[1] = 'business'
    and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_super_admin()
  );

drop policy if exists "place_images_admin_delete" on storage.objects;
create policy "place_images_admin_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'place-images'
    and (storage.foldername(name))[1] = 'business'
    and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_super_admin()
  );

drop policy if exists "menu_images_admin_insert" on storage.objects;
create policy "menu_images_admin_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = 'business'
    and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_super_admin()
  );

drop policy if exists "menu_images_admin_update" on storage.objects;
create policy "menu_images_admin_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = 'business'
    and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_super_admin()
  )
  with check (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = 'business'
    and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_super_admin()
  );

drop policy if exists "menu_images_admin_delete" on storage.objects;
create policy "menu_images_admin_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = 'business'
    and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_super_admin()
  );

drop policy if exists "menu_pdfs_admin_insert" on storage.objects;
create policy "menu_pdfs_admin_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'menu-pdfs'
    and (storage.foldername(name))[1] = 'business'
    and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_super_admin()
  );

drop policy if exists "menu_pdfs_admin_update" on storage.objects;
create policy "menu_pdfs_admin_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'menu-pdfs'
    and (storage.foldername(name))[1] = 'business'
    and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_super_admin()
  )
  with check (
    bucket_id = 'menu-pdfs'
    and (storage.foldername(name))[1] = 'business'
    and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_super_admin()
  );

drop policy if exists "menu_pdfs_admin_delete" on storage.objects;
create policy "menu_pdfs_admin_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'menu-pdfs'
    and (storage.foldername(name))[1] = 'business'
    and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_super_admin()
  );

-- ══════════════════════════════════════════════════════════════════════════
-- 3. THE VIEW COMES DOWN FIRST
-- ══════════════════════════════════════════════════════════════════════════
--
-- `profiles` projects 34 of the columns below plus four NULL/false dummies,
-- and DROP COLUMN refuses (2BP01) while a view reads the column. Nothing
-- depends on the view except its two INSTEAD OF triggers, which go with it
-- and are rebound in step 10. Its grants go too and are restated there.

drop view public.profiles;

-- ══════════════════════════════════════════════════════════════════════════
-- 4. consumer_notifications LOSES ITS TICKET
-- ══════════════════════════════════════════════════════════════════════════
--
-- Every row today is a 'bill' or 'review' about a visit ticket (the old
-- CHECK allowed nothing else, ticket_id was NOT NULL), and none survives
-- the tickets. Delete them, drop the ticket FK column (its FK and its index
-- go with it), and let the CHECK admit only what Me › Notifications renders.

delete from public.consumer_notifications
 where kind not in ('reservation', 'booking');

alter table public.consumer_notifications
  drop column if exists ticket_id;

-- Found by definition rather than by name: the constraint was renamed once
-- already (consumer_pay_notifications_kind_check, 20260818094000).
do $kind_check$
declare
  r record;
begin
  for r in
    select c.conname
      from pg_constraint c
     where c.conrelid = 'public.consumer_notifications'::regclass
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ~ '\ykind\y'
  loop
    execute format(
      'alter table public.consumer_notifications drop constraint %I',
      r.conname
    );
  end loop;
end $kind_check$;

alter table public.consumer_notifications
  add constraint consumer_notifications_kind_check
  check (kind in ('reservation', 'booking'));

comment on table public.consumer_notifications is
  'Me › Notifications. First Stage rows are reservation updates only (kind reservation | booking; payload carries place_name / place_photo_url). EF-only (RLS, no policies). Client roles: no privileges. MESITA-942, MESITA-2091.';

-- ══════════════════════════════════════════════════════════════════════════
-- 5. TABLES, CHILDREN BEFORE PARENTS
-- ══════════════════════════════════════════════════════════════════════════
--
-- No CASCADE anywhere. DROP TABLE takes the table's own indexes,
-- constraints, triggers, policies and row type; anything ELSE that still
-- depends on it stops the migration.

-- The six children of visit_tickets (consumer_notifications was step 4).
drop table if exists public.visit_ticket_payments;
drop table if exists public.ticket_check_events;
drop table if exists public.ticket_reports;
drop table if exists public.ticket_reviews;          -- + trigger ticket_reviews_refresh_place
drop table if exists public.consumer_review_claims;
drop table if exists public.place_strikes;

-- References places, consumers, managers (story_verified_by), auth.users.
-- Takes visit_tickets_set_updated_at and visit_tickets_tender_sum_on_reveal.
drop table if exists public.visit_tickets;

-- Credits: the three children of credit_lots, then the lots
-- (credit_lots_place_immutable goes with them).
drop table if exists public.credit_ledger;
drop table if exists public.credit_gifts;
drop table if exists public.credit_gift_redeem_events;
drop table if exists public.credit_lots;

-- Membership billing, then its plan vocabulary.
drop table if exists public.partner_memberships;
drop table if exists public.membership_plans;

-- Place plan subscriptions, then the plan vocabulary.
drop table if exists public.place_subscriptions;
drop table if exists public.place_plans;

-- Classes: the two consumers FK columns and the invite codes point at it.
alter table public.consumers
  drop column if exists class_key,            -- consumers_class_key_fkey, consumers_tier_idx
  drop column if exists invitation_class_key; -- consumers_invitation_class_key_fkey
drop table if exists public.consumer_invite_codes;
drop table if exists public.classes;            -- + policy classes_select_all

-- Leaves: nothing references any of these.
drop table if exists public.consumer_subscriptions;
drop table if exists public.consumer_plans;
drop table if exists public.consumer_connectors;
drop table if exists public.stripe_events;
drop table if exists public.place_payment_accounts;
drop table if exists public.place_guest_customers;
drop table if exists public.place_api_keys;
drop table if exists public.place_verifications;
drop table if exists public.place_invites;
drop table if exists public.place_field_proposals;
drop table if exists public.favorites;

-- Managers: place_members and places.claimed_by point at it.
drop table if exists public.place_members;
alter table public.places
  drop column if exists claimed_by;             -- places_claimed_by_fkey
drop table if exists public.managers;

-- ══════════════════════════════════════════════════════════════════════════
-- 6. COLUMNS
-- ══════════════════════════════════════════════════════════════════════════
--
-- Each column's own CHECKs, indexes, defaults and column grants go with it:
-- places_check_pin_format, places_monthly_promo_cap_legal_values,
-- places_promo_rate_legal_values, places_reward_cap_cents_check,
-- places_strike_count_range, places_rfc_shape, places_rfc_unique,
-- places_stripe_billing_customer_id_key, places_unreviewed_claims_idx,
-- places_claim_reviewed_by_fkey, consumers_class_origin_check,
-- consumers_plan_check, consumers_stripe_customer_id_key,
-- place_profiles_order_channel_check, and the place_profiles
-- google_visitor_count / mesita_* range checks.

-- places keeps id, created_at, updated_at, slug, state, content_state, currency.
alter table public.places
  drop column if exists listing_type,
  drop column if exists plan,
  drop column if exists fiscal_type,
  drop column if exists segmentation_basic_enabled,
  drop column if exists segmentation_advanced_enabled,
  drop column if exists welcome_free_rate,
  drop column if exists welcome_premium_rate,
  drop column if exists free_rate,
  drop column if exists premium_rate,
  drop column if exists monthly_promo_cap,
  drop column if exists discount_cap_cents,
  drop column if exists staff_channel_pinged_at,
  drop column if exists first_ticket_honored_at,
  drop column if exists plan_live_at,
  drop column if exists strike_count,
  drop column if exists last_strike_at,
  drop column if exists promo_paused_until,
  drop column if exists plan_forfeited_at,
  drop column if exists check_pin,
  drop column if exists reward_lane_pending_review_at,
  drop column if exists claimed_at,
  drop column if exists claim_reviewed_at,
  drop column if exists claim_reviewed_by,
  drop column if exists partnered,
  drop column if exists legal_name,
  drop column if exists rfc,
  drop column if exists stripe_billing_customer_id;

alter table public.place_profiles
  drop column if exists whatsapp_pr_urls,
  drop column if exists instagram_pr_urls,
  drop column if exists google_business_url,
  drop column if exists google_visitor_count,
  drop column if exists mesita_stars_overall,
  drop column if exists mesita_stars_food,
  drop column if exists mesita_stars_service,
  drop column if exists mesita_stars_ambience,
  drop column if exists mesita_stars_value,
  drop column if exists mesita_review_count,
  drop column if exists mesita_visitor_count,
  drop column if exists description_es,
  drop column if exists order_channel,
  drop column if exists order_target,
  drop column if exists orders_enabled,
  drop column if exists mesita_pay_enabled,
  drop column if exists credits_enabled,
  drop column if exists pickup_orders_enabled,
  drop column if exists delivery_orders_enabled;

alter table public.consumers
  drop column if exists class_origin,
  drop column if exists class_granted_at,
  drop column if exists class_expires_at,
  drop column if exists invitation_granted_at,
  drop column if exists plan,
  drop column if exists stripe_customer_id,
  drop column if exists privacy_public,
  drop column if exists privacy_show_saves,
  drop column if exists privacy_show_visits,
  drop column if exists privacy_show_stories;

alter table public.app_config
  drop column if exists promos_config,
  drop column if exists ojo_config,
  drop column if exists orders_config,
  drop column if exists visits_config,
  drop column if exists controls_config,
  drop column if exists verification_config;

-- ══════════════════════════════════════════════════════════════════════════
-- 7. FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════
--
-- Postgres does not track string bodies, so every one of these survived its
-- tables and would 42P01 on its next call. Dropped by NAME, every overload,
-- so a signature that drifted between the repo and the cloud cannot leave
-- one behind; no CASCADE, so a dependency nobody named still stops it. The
-- three trigger functions come after their tables (step 5) and
-- is_place_member after the storage policies that called it (step 2).

do $drop_functions$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.prokind = 'f'
       and p.proname = any (array[
         -- Credits
         'apply_ticket_credits', 'spend_credits', 'create_credit_lot',
         'create_credit_gift', 'cancel_credit_gift', 'redeem_credit_gift',
         'reverse_credit_lot', 'get_credit_liability', 'get_credit_spend_report',
         'sweep_expired_credit_lots', 'credit_lots_place_immutable',
         -- Visit tickets and Mesita reviews
         'record_visit_tenders', 'visit_tickets_enforce_tender_sum_on_reveal',
         'refresh_place_mesita_reviews', 'tg_ticket_reviews_refresh_place',
         -- Claims and members
         'claim_place', 'release_place', 'mark_place_claim_reviewed',
         'is_place_member'
       ])
  loop
    execute format('drop function %s', r.sig);
  end loop;
end $drop_functions$;

-- ══════════════════════════════════════════════════════════════════════════
-- 8. ENUMS
-- ══════════════════════════════════════════════════════════════════════════
--
-- Each was used only by a column or table dropped above (and, for the first
-- three, by the view). content_state, place_state and reservation_state stay.

drop type if exists public.ticket_state;
drop type if exists public.story_state;
drop type if exists public.member_role;
drop type if exists public.verification_method;
drop type if exists public.verification_state;
drop type if exists public.field_proposal_status;
drop type if exists public.plan;
drop type if exists public.listing_type;
drop type if exists public.place_fiscal_type;

-- ══════════════════════════════════════════════════════════════════════════
-- 9. THE VIEW'S WRITERS
-- ══════════════════════════════════════════════════════════════════════════
--
-- Same bodies as 20260908053644 minus the dropped columns. Without this the
-- first write through the view fails 42703 (and casts to enums that no
-- longer exist). CREATE OR REPLACE keeps their EXECUTE grants.

create or replace function public.profiles_insert()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_id uuid;
begin
  insert into public.place_profiles (
    id, created_at, updated_at, google_place_id, category, category_label,
    vibe, price_level, lat, lng, address, timezone, closes_at, phone, pitch, story,
    photos, website_url, instagram_url, facebook_url, whatsapp_url,
    opentable_url, resy_url, uber_eats_url, x_url, threads_url, reddit_url,
    google_maps_url, didi_food_url, email, hours, embedding,
    embedding_source_hash, embedding_source_text, country, description, menu_pdf_url, tags,
    google_stars_overall, google_review_count, instagram_followers_count,
    menu_pdf_name, enriched_at, enrichment_sources, editorial_summary, zone, city,
    established_year, executive_chef, facebook_rating, facebook_followers,
    details, google_reviews, menus, popular_times, products,
    google_name, mesita_name,
    reservation_channel, reservation_target,
    business_state, business_state_at,
    name_embedding, name_embedding_hash,
    family_keys
  ) values (
    coalesce(new.id, gen_random_uuid()), coalesce(new.created_at, now()),
    coalesce(new.updated_at, now()), new.google_place_id, new.category,
    new.category_label, new.vibe, new.price_level, new.lat, new.lng, new.address,
    new.timezone, new.closes_at, new.phone, new.pitch, new.story,
    coalesce(new.photos, '{}'), new.website_url, new.instagram_url,
    new.facebook_url, new.whatsapp_url, new.opentable_url, new.resy_url,
    new.uber_eats_url, new.x_url, new.threads_url, new.reddit_url,
    new.google_maps_url, new.didi_food_url, new.email,
    new.hours, new.embedding, new.embedding_source_hash, new.embedding_source_text, new.country,
    new.description, new.menu_pdf_url, coalesce(new.tags, '{}'),
    new.google_stars_overall, new.google_review_count, new.instagram_followers_count,
    new.menu_pdf_name, new.enriched_at, new.enrichment_sources, new.editorial_summary,
    new.zone, new.city, new.established_year, new.executive_chef,
    new.facebook_rating, new.facebook_followers,
    new.details, new.google_reviews, new.menus, new.popular_times, new.products,
    new.google_name,
    coalesce(new.mesita_name, new.name),
    new.reservation_channel, new.reservation_target,
    new.business_state, new.business_state_at,
    new.name_embedding, new.name_embedding_hash,
    new.family_keys
  ) returning id into v_id;

  insert into public.places (
    id, created_at, updated_at, slug, state, content_state, currency
  ) values (
    v_id, coalesce(new.created_at, now()), coalesce(new.updated_at, now()),
    new.slug, coalesce(new.state, 'lead'::public.place_state),
    coalesce(new.content_state, 'queued'::public.content_state),
    coalesce(new.currency, 'MXN')
  );
  new.id := v_id;
  return new;
end;
$function$;

create or replace function public.profiles_update()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update public.place_profiles set
    google_place_id = new.google_place_id, category = new.category,
    category_label = new.category_label, vibe = new.vibe, price_level = new.price_level,
    lat = new.lat, lng = new.lng, address = new.address, timezone = new.timezone,
    closes_at = new.closes_at, phone = new.phone, pitch = new.pitch, story = new.story,
    photos = new.photos, website_url = new.website_url, instagram_url = new.instagram_url,
    facebook_url = new.facebook_url,
    whatsapp_url = new.whatsapp_url, opentable_url = new.opentable_url,
    resy_url = new.resy_url, uber_eats_url = new.uber_eats_url, x_url = new.x_url,
    threads_url = new.threads_url, reddit_url = new.reddit_url,
    google_maps_url = new.google_maps_url,
    didi_food_url = new.didi_food_url, email = new.email, hours = new.hours,
    embedding = new.embedding, embedding_source_hash = new.embedding_source_hash,
    embedding_source_text = new.embedding_source_text,
    name_embedding = new.name_embedding,
    name_embedding_hash = new.name_embedding_hash,
    country = new.country, description = new.description, menu_pdf_url = new.menu_pdf_url,
    tags = new.tags,
    google_stars_overall = new.google_stars_overall, google_review_count = new.google_review_count,
    instagram_followers_count = new.instagram_followers_count,
    menu_pdf_name = new.menu_pdf_name, enriched_at = new.enriched_at,
    enrichment_sources = new.enrichment_sources, editorial_summary = new.editorial_summary,
    zone = new.zone, city = new.city, established_year = new.established_year,
    executive_chef = new.executive_chef, facebook_rating = new.facebook_rating,
    facebook_followers = new.facebook_followers,
    details = new.details, google_reviews = new.google_reviews, menus = new.menus,
    popular_times = new.popular_times, products = new.products,
    reservation_channel = new.reservation_channel,
    reservation_target = new.reservation_target,
    business_state = new.business_state,
    business_state_at = new.business_state_at,
    google_name = new.google_name,
    mesita_name = new.mesita_name,
    family_keys = new.family_keys
  where id = old.id;

  update public.places set
    slug = new.slug, state = new.state, content_state = new.content_state,
    currency = new.currency
  where id = old.id;
  return new;
end
$function$;

-- ══════════════════════════════════════════════════════════════════════════
-- 10. THE VIEW, REBUILT
-- ══════════════════════════════════════════════════════════════════════════
--
-- The 20260915234500 column list, in its order, minus what step 6 dropped
-- and minus the four dummies (tiktok_url, tripadvisor_url, yelp_url,
-- requires_story) that only existed so pre-redeploy EFs could still select
-- them. From `places` it reads id, slug, state, content_state and currency,
-- all of which anon and authenticated can already SELECT column by column.
--
-- `WITH (security_invoker = true)` IS NOT OPTIONAL. Without it the view runs
-- as its owner and hands anon every row RLS exists to hide.

create view public.profiles with (security_invoker = true) as
 SELECT p.id,
    p.created_at,
    p.updated_at,
    p.google_place_id,
    u.slug,
    p.name,
    p.category,
    p.vibe,
    p.price_level,
    u.state,
    p.lat,
    p.lng,
    p.address,
    p.timezone,
    p.closes_at,
    p.phone,
    p.pitch,
    p.story,
    p.photos,
    p.website_url,
    p.instagram_url,
    p.facebook_url,
    p.whatsapp_url,
    p.opentable_url,
    p.resy_url,
    p.uber_eats_url,
    p.x_url,
    p.threads_url,
    p.reddit_url,
    p.google_maps_url,
    p.didi_food_url,
    p.email,
    p.hours,
    p.embedding,
    p.embedding_source_hash,
    p.country,
    p.description,
    p.menu_pdf_url,
    p.tags,
    p.google_stars_overall,
    p.google_review_count,
    p.instagram_followers_count,
    u.currency,
    p.menu_pdf_name,
    p.enriched_at,
    p.enrichment_sources,
    p.editorial_summary,
    p.zone,
    p.city,
    p.established_year,
    p.executive_chef,
    p.facebook_rating,
    p.facebook_followers,
    p.details,
    p.google_reviews,
    p.menus,
    p.popular_times,
    p.products,
    p.category_label,
    u.content_state,
    p.embedding_source_text,
    p.google_name,
    p.mesita_name,
    p.reservation_channel,
    p.reservation_target,
    p.business_state,
    p.business_state_at,
    p.name_embedding,
    p.name_embedding_hash,
    p.request_count,
    p.family_keys,
    p.reservations_enabled
   FROM places u
     JOIN place_profiles p ON p.id = u.id;

-- Exactly the grants the dropped view carried (live, 2026-10-10).
revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger
  on table public.profiles to service_role;

create trigger profiles_insert_trg
  instead of insert on public.profiles
  for each row execute function public.profiles_insert();

create trigger profiles_update_trg
  instead of update on public.profiles
  for each row execute function public.profiles_update();

-- ══════════════════════════════════════════════════════════════════════════
-- 11. admin_reset_database — A WHOLE NEW BODY
-- ══════════════════════════════════════════════════════════════════════════
--
-- Not a text patch. The live body (20260915234029 + the 20260924041200
-- patch) required classes, consumer_plans and place_plans as survivors and
-- reseeded all three; each now names a table that does not exist. Kept: the
-- registry-driven truncate, the super_admins guard, the member-number
-- counter reset, the three seed_* calls, and the auth.users sweep.

create or replace function public.admin_reset_database()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  keep_tables text[];
  wipe_tables text[];
  deleted_users bigint;
  missing_required text[];
begin
  select coalesce(array_agg(p.table_name order by p.table_name), '{}'::text[])
    into keep_tables
    from public.admin_reset_preserve p;

  if not ('admin_reset_preserve' = any (keep_tables)) then
    keep_tables := keep_tables || array['admin_reset_preserve'];
  end if;

  select array_agg(r order by r) into missing_required
    from unnest(array[
      'app_config',
      'super_admins',
      'place_categories',
      'place_families',
      'place_tags',
      'consumer_code_counter'
    ]) r
   where not (r = any (keep_tables));
  if missing_required is not null then
    raise exception
      'admin_reset_preserve is missing required survivor(s): %. Refusing to wipe.',
      missing_required;
  end if;

  if not exists (select 1 from public.super_admins) then
    raise exception
      'super_admins is empty: the wipe would delete every auth user, including yours, and leave nobody able to re-grant admin. Refusing to wipe.';
  end if;

  select coalesce(array_agg(format('public.%I', c.relname) order by c.relname), '{}'::text[])
    into wipe_tables
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p')
     and not c.relispartition
     and c.relname <> all (keep_tables)
     and not exists (
       select 1 from pg_depend d
        where d.objid = c.oid
          and d.classid = 'pg_class'::regclass
          and d.deptype = 'e'
     );

  if coalesce(array_length(wipe_tables, 1), 0) > 0 then
    execute format(
      'truncate table %s restart identity cascade',
      array_to_string(wipe_tables, ', ')
    );
  end if;

  update public.consumer_code_counter set next_value = 0 where id = 1;

  perform public.seed_place_families();
  perform public.seed_place_categories();
  perform public.seed_place_tags();

  delete from auth.users u
  where not exists (
    select 1
    from public.super_admins sa
    where (u.email is not null and lower(u.email) = lower(sa.email))
       or (u.phone is not null and sa.phone is not null and u.phone = sa.phone)
       or (sa.user_id is not null and sa.user_id = u.id)
  );
  get diagnostics deleted_users = row_count;

  return jsonb_build_object(
    'ok', true,
    'truncated_tables', coalesce(array_length(wipe_tables, 1), 0),
    'preserved_tables', coalesce(array_length(keep_tables, 1), 0),
    'deleted_auth_users', deleted_users,
    'reset_at', now()
  );
end;
$function$;

revoke all on function public.admin_reset_database() from public, anon, authenticated;
grant execute on function public.admin_reset_database() to service_role;

-- The registry rows that name a dropped table. Left in place they would be
-- harmless to the truncate but would fail the pgTAP "every row names a live
-- table" check, and they describe vocabularies the product no longer has.
delete from public.admin_reset_preserve
 where table_name in ('classes', 'consumer_plans', 'place_plans', 'membership_plans');

update public.admin_reset_preserve
   set reason = 'admin config singleton (Enricher / Memo / Discovery / Reservations / Models / Agents)'
 where table_name = 'app_config';

-- ══════════════════════════════════════════════════════════════════════════
-- 12. POST-FLIGHT
-- ══════════════════════════════════════════════════════════════════════════

do $postflight$
declare
  leftover text[];
begin
  select array_agg(t) into leftover
    from unnest(array[
      'classes', 'consumer_connectors', 'consumer_invite_codes', 'consumer_plans',
      'consumer_review_claims', 'consumer_subscriptions', 'credit_gift_redeem_events',
      'credit_gifts', 'credit_ledger', 'credit_lots', 'favorites', 'managers',
      'membership_plans', 'partner_memberships', 'place_api_keys',
      'place_field_proposals', 'place_guest_customers', 'place_invites',
      'place_members', 'place_payment_accounts', 'place_plans', 'place_strikes',
      'place_subscriptions', 'place_verifications', 'stripe_events',
      'ticket_check_events', 'ticket_reports', 'ticket_reviews',
      'visit_ticket_payments', 'visit_tickets'
    ]) t
   where to_regclass('public.' || t) is not null;
  if leftover is not null then
    raise exception 'Second Stage tables survived the cut: %', leftover;
  end if;

  select array_agg(table_name || '.' || column_name) into leftover
    from information_schema.columns
   where table_schema = 'public'
     and (
       (table_name = 'places' and column_name not in
         ('id', 'created_at', 'updated_at', 'slug', 'state', 'content_state', 'currency'))
       or (table_name in ('place_profiles', 'profiles') and column_name in (
         'listing_type', 'plan', 'fiscal_type', 'whatsapp_pr_urls', 'instagram_pr_urls',
         'google_business_url', 'google_visitor_count', 'mesita_stars_overall',
         'mesita_stars_food', 'mesita_stars_service', 'mesita_stars_ambience',
         'mesita_stars_value', 'mesita_review_count', 'mesita_visitor_count',
         'description_es', 'order_channel', 'order_target', 'orders_enabled',
         'mesita_pay_enabled', 'credits_enabled', 'pickup_orders_enabled',
         'delivery_orders_enabled', 'tiktok_url', 'tripadvisor_url', 'yelp_url',
         'requires_story'))
       or (table_name = 'consumers' and (column_name like 'class\_%'
         or column_name like 'invitation\_%' or column_name like 'privacy\_%'
         or column_name in ('plan', 'stripe_customer_id')))
       or (table_name = 'app_config' and column_name in (
         'promos_config', 'ojo_config', 'orders_config', 'visits_config',
         'controls_config', 'verification_config'))
       or (table_name = 'consumer_notifications' and column_name = 'ticket_id')
     );
  if leftover is not null then
    raise exception 'Second Stage columns survived the cut: %', leftover;
  end if;

  if not exists (select 1 from pg_class
    where oid = 'public.profiles'::regclass
      and reloptions @> array['security_invoker=true']) then
    raise exception 'profiles was rebuilt without security_invoker — RLS is being bypassed';
  end if;

  if (select count(*) from pg_trigger
       where tgrelid = 'public.profiles'::regclass and not tgisinternal) <> 2 then
    raise exception 'profiles was rebuilt without both INSTEAD OF triggers';
  end if;

  if not has_table_privilege('anon', 'public.profiles', 'SELECT')
     or not has_table_privilege('authenticated', 'public.profiles', 'SELECT') then
    raise exception 'profiles lost its client SELECT grant — consumer browse 401s';
  end if;

  if exists (select 1 from pg_proc
     where pronamespace = 'public'::regnamespace and proname = 'is_place_member') then
    raise exception 'is_place_member survived';
  end if;

  if (select count(*) from pg_policy
       where polrelid = 'storage.objects'::regclass
         and polname in (
           'place_images_admin_insert', 'place_images_admin_update', 'place_images_admin_delete',
           'menu_images_admin_insert', 'menu_images_admin_update', 'menu_images_admin_delete',
           'menu_pdfs_admin_insert', 'menu_pdfs_admin_update', 'menu_pdfs_admin_delete')) <> 9 then
    raise exception 'a place-bucket write policy is missing — web-admin uploads would 403';
  end if;

  if exists (select 1 from cron.job where jobname = 'sweep-expired-credit-lots') then
    raise exception 'sweep-expired-credit-lots is still scheduled';
  end if;

  select array_agg(p.table_name) into leftover
    from public.admin_reset_preserve p
   where to_regclass('public.' || p.table_name) is null;
  if leftover is not null then
    raise exception 'admin_reset_preserve names tables that do not exist: %', leftover;
  end if;
end $postflight$;

notify pgrst, 'reload schema';

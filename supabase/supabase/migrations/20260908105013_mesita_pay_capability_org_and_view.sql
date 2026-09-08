-- Mesita Pay becomes a CAPABILITY, and it has an owner (Pato, 2026-09-08).
--
-- MESITA PAY IS THE WHOLE PAYMENTS PACKAGE, all or nothing (Docs > Checkout
-- §0): any phone scans the guest QR, the check page reads the Passport,
-- resolves the best reward against the bill, and settles in one of four
-- tenders. It is never a tender itself and never a synonym for Checkout,
-- which is the validator flow inside it.
--
-- TWO BITS, ONE FACT. The org holds the Stripe account and the fee, so the org
-- holds the capability; each place decides whether it runs the flow. The place
-- bit can only be true while the org's is, and the org switching off cascades
-- down without touching a single place row.
--
-- THE SERVER STATES IT ONCE. `profiles.mesita_pay_enabled` is the EFFECTIVE
-- capability — place AND org — because this codebase already learned that
-- lesson with `partner`, `promoting` and `enriched`: the server states them so
-- no client re-derives the chain, and a client that re-derives is a client
-- that will disagree with the server the day the rule changes. A place in the
-- public pool has no organization and is therefore false.
--
-- `WITH (security_invoker = true)` IS NOT OPTIONAL AND IS EASY TO LOSE.
-- `create or replace view` RESETS reloptions, so replacing this view without
-- restating it drops security_invoker and the view starts running as its
-- OWNER — bypassing row-level security on places and place_profiles, letting
-- anon read rows RLS exists to hide. This migration shipped without it; the
-- schema_invariants test caught it on the fresh replay and 20260908110045
-- repaired the database that had already run it. Never replace this view
-- without the option.
--
-- A CORRELATED SUBQUERY, not a third join. `profiles` is a 110-column view
-- over `places JOIN place_profiles` carrying TWO INSTEAD OF triggers that are
-- how every EF writes a place. Adding a join would rewrite its FROM; appending
-- one derived column leaves the existing shape byte-identical, and the
-- post-flight asserts both triggers survived the replace — losing them would
-- fail silently on the next write rather than here.
--
-- Data at apply time: 1 place, 1 organization, `mesita_pay_enabled` false
-- everywhere, so the effective capability is false for every place. That is
-- the intended starting state: an operator turns a place on through the
-- Partner-tab toggles, and until then Pay > QR has nothing to list.
--
-- LEDGER: applied through MCP apply_migration, which stamps its own
-- server-side timestamp, so this FILENAME matches the stamped version
-- 20260908105013 rather than writing to schema_migrations by hand.

alter table public.organizations
  add column if not exists mesita_pay_enabled boolean not null default false;

comment on column public.organizations.mesita_pay_enabled is
  'The org runs Mesita Pay: the whole payments package, all or nothing. The ONLY org capability. A place''s own bit can only be true while this is (profiles.mesita_pay_enabled ANDs them), so switching this off cascades down without touching a single place row.';

create or replace view public.profiles with (security_invoker = true) as
 SELECT p.id,
    p.created_at,
    p.updated_at,
    p.google_place_id,
    u.slug,
    p.name,
    p.category,
    p.vibe,
    p.price_level,
    u.listing_type,
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
    u.fiscal_type,
    u.plan,
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
    p.whatsapp_pr_urls,
    p.instagram_pr_urls,
    p.google_business_url,
    p.google_stars_overall,
    p.google_review_count,
    p.google_visitor_count,
    p.mesita_stars_overall,
    p.mesita_stars_food,
    p.mesita_stars_service,
    p.mesita_stars_ambience,
    p.mesita_review_count,
    p.mesita_visitor_count,
    p.instagram_followers_count,
    u.segmentation_basic_enabled,
    u.segmentation_advanced_enabled,
    u.currency,
    p.menu_pdf_name,
    u.welcome_free_rate,
    u.welcome_premium_rate,
    u.free_rate,
    u.premium_rate,
    p.enriched_at,
    p.enrichment_sources,
    p.editorial_summary,
    p.zone,
    p.city,
    p.established_year,
    p.executive_chef,
    u.discount_cap_cents,
    p.facebook_rating,
    p.facebook_followers,
    p.mesita_stars_value,
    p.details,
    p.google_reviews,
    p.menus,
    p.popular_times,
    u.monthly_promo_cap,
    p.products,
    p.category_label,
    u.content_state,
    u.staff_channel_pinged_at,
    u.first_ticket_honored_at,
    u.plan_live_at,
    u.strike_count,
    u.last_strike_at,
    u.promo_paused_until,
    u.plan_forfeited_at,
    p.embedding_source_text,
    p.google_name,
    p.description_es,
    p.mesita_name,
    p.reservation_channel,
    p.reservation_target,
    p.order_channel,
    p.order_target,
    p.business_state,
    p.business_state_at,
    p.name_embedding,
    p.name_embedding_hash,
    NULL::text AS tiktok_url,
    NULL::text AS tripadvisor_url,
    NULL::text AS yelp_url,
    false AS requires_story,
    p.request_count,
    p.family_keys,
    p.orders_enabled,
    p.reservations_enabled,
    u.reward_lane_pending_review_at,
    -- THE EFFECTIVE CAPABILITY, stated once by the server. The place's own bit
    -- AND its organization's, so no reader anywhere re-derives the chain — the
    -- same rule `partner`, `promoting` and `enriched` already follow. A place
    -- in the public pool has no organization and is therefore false.
    -- A correlated subquery rather than a join so the view's FROM is untouched.
    (p.mesita_pay_enabled AND COALESCE((SELECT o.mesita_pay_enabled
       FROM public.organizations o WHERE o.id = u.organization_id), false))
      AS mesita_pay_enabled
   FROM places u
     JOIN place_profiles p ON p.id = u.id;

do $$
begin
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='organizations'
      and column_name='mesita_pay_enabled') then
    raise exception 'organizations.mesita_pay_enabled missing after migration';
  end if;
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles'
      and column_name='mesita_pay_enabled') then
    raise exception 'profiles.mesita_pay_enabled missing after migration';
  end if;
  -- The view's two INSTEAD OF triggers must survive the replace: they are how
  -- every EF writes a place, and losing them would fail silently on the next
  -- write rather than here.
  if (select count(*) from pg_trigger
       where tgrelid='public.profiles'::regclass and not tgisinternal) <> 2 then
    raise exception 'profiles lost its INSTEAD OF triggers during the view replace';
  end if;
  -- The option the replace silently drops. Asserted here so a future edit to
  -- this view fails at apply time rather than in a security review.
  if not exists (select 1 from pg_class
    where oid = 'public.profiles'::regclass
      and reloptions @> array['security_invoker=true']) then
    raise exception 'profiles lost security_invoker during the view replace — RLS is being bypassed';
  end if;
end $$;

notify pgrst, 'reload schema';

-- Compat projections so currently-deployed Edge Functions keep selecting
-- tiktok_url / tripadvisor_url / yelp_url / requires_story off public.profiles
-- after 20260825004000 dropped those base-table columns. CREATE OR REPLACE
-- can only ADD columns (at the end); the INSTEAD OF triggers stay. Dummy
-- values are typed constants — writers ignore them. Drop once every EF that
-- still names those columns has been redeployed from this branch.

create or replace view public.profiles
  with (security_invoker = true)
as
 select p.id,
    p.created_at,
    p.updated_at,
    p.google_place_id,
    u.slug,
    p.name,
    p.category,
    p.vibe,
    p.price_level,
    u.listing_type,
    u.status,
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
    u.content_status,
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
    p.business_status,
    p.business_status_at,
    p.name_embedding,
    p.name_embedding_hash,
    null::text as tiktok_url,
    null::text as tripadvisor_url,
    null::text as yelp_url,
    false as requires_story
   from projects u
     join places p on p.id = u.id;

comment on view public.profiles is
  'SECURITY INVOKER join of projects ⋈ places. Dummy tiktok_url / tripadvisor_url / yelp_url / requires_story keep pre-redeploy EFs selecting; base tables no longer store them. INVARIANT: any create-or-replace MUST keep with (security_invoker = true).';

grant select on table public.profiles to anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger
  on table public.profiles to service_role;

do $$
begin
  if not exists (
    select 1 from pg_class
     where oid = 'public.profiles'::regclass
       and 'security_invoker=true' = any (reloptions)
  ) then
    raise exception 'public.profiles lost security_invoker=true';
  end if;
  if not has_table_privilege('anon', 'public.profiles', 'select') then
    raise exception 'anon lost SELECT on public.profiles';
  end if;
  if (
    select count(*) from pg_trigger t
     where t.tgrelid = 'public.profiles'::regclass and not t.tgisinternal
  ) <> 2 then
    raise exception 'profiles lost an INSTEAD OF trigger';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'places'
       and column_name in ('tiktok_url', 'tripadvisor_url', 'yelp_url')
  ) then
    raise exception 'places still stores a dropped URL column';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'projects'
       and column_name = 'requires_story'
  ) then
    raise exception 'projects.requires_story came back as a base column';
  end if;
end $$;

notify pgrst, 'reload schema';

-- MESITA-720 — persist the human embedding source text (synthesized on-update).
-- Tags are never part of the embedding input; the On-Update path writes a short
-- LLM blurb into embedding_source_text, then embeds that blurb.

alter table public.places
  add column if not exists embedding_source_text text;

comment on column public.places.embedding_source_text is
  'Human-readable place blurb synthesized on-update (no tags); this is the exact text fed to text-embedding-3-small.';

-- Recreate projects_view with the new column. MUST keep security_invoker = true
-- (MESITA-599 invariant — DEFINER leaks non-public rows to anon browse).
create or replace view public.projects_view
with (security_invoker = true)
as
select
  p.id,
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
  p.tiktok_url,
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
  p.tripadvisor_url,
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
  u.reward_cap_cents,
  u.requires_story,
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
  p.yelp_url,
  p.reservation_endpoint,
  p.reservation_contacts,
  u.staff_channel_pinged_at,
  u.first_ticket_honored_at,
  u.membership_live_at,
  u.strike_count,
  u.last_strike_at,
  u.promo_paused_until,
  u.membership_forfeited_at,
  -- Appended (cannot insert mid-view — CREATE OR REPLACE maps by position).
  p.embedding_source_text
from public.projects u
join public.places p on p.id = u.id;

comment on view public.projects_view is
  'SECURITY INVOKER join of projects ⋈ places. Public reads follow projects_select_public_visible; service-role EFs bypass RLS. INVARIANT: any create-or-replace MUST keep with (security_invoker = true).';

notify pgrst, 'reload schema';

-- MESITA-1704 — the consumer catalog comes back: `public.profiles` is readable
-- by the client roles again.
--
-- WHAT BROKE. 20260908105013 (MESITA-1689) appended the effective Mesita Pay
-- capability to the view every consumer read lands on:
--
--   p.mesita_pay_enabled AND coalesce((select o.mesita_pay_enabled
--     from public.organizations o where o.id = u.organization_id), false)
--
-- `profiles` is `security_invoker = true` — which is the entire reason RLS on
-- `places` applies to a guest read, and must stay. So that one line put two
-- objects the client roles have NEVER held into the invoker's permission
-- check: `places.organization_id` and `public.organizations`. Since it
-- applied, every anon and authenticated read of `profiles` has answered
--
--   42501  permission denied for table places
--
-- and the consumer app's Search map has shown that sentence to guests in a red
-- band. Postgres names the first relation whose check fails, never the column,
-- which is why the message accused `places` and never mentioned the org table
-- that is equally denied.
--
-- WHY NO TEST CAUGHT IT. `schema_invariants` asserts
-- `has_table_privilege('anon','public.profiles','SELECT')` — a privilege on
-- the VIEW, which was never lost — and then spot-checks ONE underlying column
-- (`places.plan`). A privilege check on a view cannot see the view's body, and
-- a hand-listed column cannot see a new one arrive. Both assertions passed
-- while the view was completely unreadable. The companion test change asserts
-- the thing itself: a real read, as each client role, plus the referenced-
-- column set derived from `pg_depend` rather than typed out.
--
-- LEDGER: applied through MCP apply_migration, which stamps its own server-side
-- timestamp, so this FILENAME matches the stamped version 20260908175831 rather
-- than writing to schema_migrations by hand.
--
-- ── repair 1 · the org read leaves the invoker ──────────────────────────────
--
-- `organizations` is closed to the client roles on purpose (20260905222953,
-- `revoke all ... from public, anon, authenticated`) and stays closed. Opening
-- it — even to two columns — would hand the publishable key the org roster,
-- and because the table has RLS on with zero policies, a column grant alone
-- would return NO ROWS rather than an error: every place's capability would
-- quietly read false. A config that silently falls back is not enforced, which
-- is the house definition of a bug, and a silently-false capability is worse
-- than the outage it replaced.
--
-- So the org read stops being the invoker's. `org_mesita_pay_enabled` is
-- `security definer`, owned by postgres, and answers one boolean for one org
-- id. It is keyed on the ORG id and not the place id deliberately: an org id
-- is only obtainable from a `places` row the caller can already see, so the
-- function publishes nothing the view did not already publish. Keyed on the
-- place id it would have had to read `places` as its owner, and a definer
-- function that reads `places` is an RLS bypass — it would answer for rows
-- RLS exists to hide.

create or replace function public.org_mesita_pay_enabled(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select o.mesita_pay_enabled from public.organizations o where o.id = p_org_id),
    false
  );
$$;

comment on function public.org_mesita_pay_enabled(uuid) is
  'Does this organization run Mesita Pay? security definer so public.profiles can AND the org bit into the effective place capability without the invoking client role needing SELECT on public.organizations, which is EF-only and stays that way. NULL org (a place in the public pool) answers false, matching the correlated subquery it replaces.';

revoke all on function public.org_mesita_pay_enabled(uuid) from public;
grant execute on function public.org_mesita_pay_enabled(uuid)
  to anon, authenticated, service_role;

-- ── repair 2 · the one places column the view still reads directly ──────────
--
-- Client roles hold COLUMN-level SELECT on `places`; table-level SELECT would
-- carry `check_pin` and the three CFDI columns with it, which 20260824235205
-- closed and this migration keeps closed. That migration granted a computed
-- deny-list — every column except the secrets — but a grant is a snapshot of
-- the columns that existed the day it ran. `organization_id` arrived after it,
-- with the org split, and inherited nothing.
--
-- Only `organization_id` is granted here, not the whole deny-list again. The
-- four columns that stay dark are `claimed_by` (→ managers), `claim_reviewed_by`
-- (→ auth.users) and their two timestamps: person ids and operator provenance,
-- which no guest surface reads and which a blanket restatement would have
-- published on the publishable key without anyone deciding to.
--
-- Re-granting is not what keeps this from happening again — the next column is
-- the next snapshot. The invariant test is.

grant select (organization_id) on table public.places to anon, authenticated;

-- ── the view, its org read routed through the function ──────────────────────
--
-- `create or replace view` RESETS reloptions, so `security_invoker = true` is
-- restated here. Losing it makes the view run as its OWNER and hands anon
-- every row RLS hides. The post-flight below fails the migration if it is gone.

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
    -- The org half is a security-definer function, not an inline subquery on
    -- `organizations`: this view runs as its INVOKER, and the invoker is
    -- usually anon, which cannot read that table and must not learn to.
    (p.mesita_pay_enabled AND public.org_mesita_pay_enabled(u.organization_id))
      AS mesita_pay_enabled
   FROM places u
     JOIN place_profiles p ON p.id = u.id;

do $$
declare
  probe text;
begin
  -- The two INSTEAD OF triggers are how every EF writes a place. A replace
  -- that loses them fails silently on the next write rather than here.
  if (select count(*) from pg_trigger
       where tgrelid='public.profiles'::regclass and not tgisinternal) <> 2 then
    raise exception 'profiles lost its INSTEAD OF triggers during the view replace';
  end if;

  if not exists (select 1 from pg_class
    where oid = 'public.profiles'::regclass
      and reloptions @> array['security_invoker=true']) then
    raise exception 'profiles lost security_invoker during the view replace — RLS is being bypassed';
  end if;

  -- The assertion this whole migration exists for: not "can the role reach the
  -- view" but "does the read RUN". Everything above can be true while the view
  -- is 42501 for every guest, which is exactly what shipped.
  foreach probe in array array['anon','authenticated'] loop
    begin
      execute format('set local role %I', probe);
      perform id, mesita_pay_enabled from public.profiles limit 1;
      reset role;
    exception when others then
      reset role;
      raise exception '% still cannot read public.profiles: % %', probe, sqlstate, sqlerrm;
    end;
  end loop;

  -- The repair must not have been a widening. organizations stays EF-only, and
  -- the place secrets stay off the publishable key.
  if has_table_privilege('anon', 'public.organizations', 'SELECT')
     or has_table_privilege('authenticated', 'public.organizations', 'SELECT') then
    raise exception 'a client role gained SELECT on public.organizations — it is EF-only';
  end if;
  if has_table_privilege('anon', 'public.places', 'SELECT')
     or has_table_privilege('authenticated', 'public.places', 'SELECT') then
    raise exception 'a client role gained TABLE-level SELECT on public.places — that carries check_pin and CFDI';
  end if;
  if exists (
    select 1 from information_schema.columns c
     where c.table_schema = 'public' and c.table_name = 'places'
       and c.column_name in ('check_pin','staff_pin','cfdi_rfc','cfdi_cp','cfdi_razon_social')
       and (has_column_privilege('anon', 'public.places', c.column_name, 'SELECT')
         or has_column_privilege('authenticated', 'public.places', c.column_name, 'SELECT'))
  ) then
    raise exception 'a client role gained SELECT on a places secret column';
  end if;
end $$;

notify pgrst, 'reload schema';

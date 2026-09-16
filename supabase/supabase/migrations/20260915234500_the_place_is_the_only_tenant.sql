-- THE ORGANIZATION LAYER IS REMOVED (Pato, 2026-09-15 · MESITA-1892).
--
-- The place is the sole tenant boundary. Organizations may be reconsidered
-- one day; until then they do not exist — not as a table, not as a renamed
-- table, not as a generic tenant container, not as an unused column, and not
-- as a compatibility view. This migration is the whole removal: it moves what
-- the organization held onto the place, and then deletes the layer.
--
-- WHY THIS IS SMALLER THAN IT LOOKS. The org layer was mostly a SECOND path
-- beside a place path that already existed and already worked:
--
--   organization_invites   →  place_invites already exists, same ten columns,
--                             and business-web-{invite,accept,list,remove}-
--                             member already run on it.
--   organization_members   →  place_members already exists, and checkMembership
--                             already resolved the org path CAPPED AT EDITOR.
--                             So the backfill below writes editor, never owner,
--                             and never overwrites a stronger direct grant:
--                             every caller keeps exactly the access they had
--                             and nobody gains any.
--   organizations.partnered / .mesita_pay_enabled / .rfc / .legal_name /
--   .stripe_billing_customer_id
--                          →  columns on `places`, which already carries the
--                             rest of the operator's configuration.
--
-- THE TWO PAY BITS BECOME ONE. `profiles.mesita_pay_enabled` was the place's
-- own bit AND its organization's (20260908105013). With no organization there
-- is one bit, and it is the place's — so the backfill writes the CONJUNCTION
-- into `place_profiles.mesita_pay_enabled` before the org bit is dropped. The
-- effective capability every reader sees is byte-identical across this
-- migration; no place silently starts or stops taking cards.
--
-- ── THE MAPPING RULE ──────────────────────────────────────────────────────
--
-- A tenant-owned record is mapped by the org's PLACE COUNT, and the rule is
-- the same for every table so no row is ever assigned arbitrarily:
--
--   exactly one place   map it to that place. Unambiguous.
--   two or more places  REFUSE. A merchant account, a prepaid balance or a
--                       subscription held across several places is the
--                       organization concept itself; splitting it would either
--                       duplicate money or pick a winner. The migration raises
--                       and names the rows so a human decides.
--   zero places         the record has nowhere to land. Dropped, and named in
--                       this file and on MESITA-1892 so it can be re-attached
--                       by hand. NOT silent, and NOT preserved as a
--                       placeholder row — a tenant record with no tenant is
--                       exactly the hidden infrastructure this issue removes.
--
-- Memberships are the one exception: they FAN OUT to every held place,
-- because that is literally the access checkMembership already granted.
--
-- ── DATA AT APPLY TIME (verified live, 2026-09-15) ────────────────────────
--
--   organizations                 2   "Pato" (1 place) · "Org Test" (0 places)
--   organization_members          2   both pato@canzeco.com, both owner — and
--                                     already place_members owner of the one
--                                     place, so the backfill writes nothing
--   organization_payment_accounts 2   acct_1UFmLHD5UbELfiCG → org "Pato"
--                                     acct_1UEzR7DLyAYA9u7n → org "Org Test"
--   organization_invites          0
--   organization_guest_customers  0
--   partner_memberships           0
--   credit_lots                   0
--   places                        1   f6729e6e-… , held by org "Pato"
--
-- THE ONE ORPHAN: Stripe Connect account `acct_1UEzR7DLyAYA9u7n`, held by
-- "Org Test", which holds no place. Its row is dropped here. The Stripe
-- account itself is untouched and still exists in Stripe (livemode = false —
-- a test-mode account, no real money behind it); an operator who wants it back
-- re-runs Connect onboarding from the place that should own it. Recording the
-- id was the alternative to keeping a row that would have to point at nothing.
--
-- LEDGER: supabase/CLAUDE.md — if this is applied through MCP apply_migration,
-- MCP stamps its own server-side timestamp and this FILENAME is renamed to
-- match it rather than writing to schema_migrations by hand. The migration
-- runner wraps this file in one transaction, so a failure anywhere leaves the
-- schema exactly as it was — which is why the refusals in section 0 are safe to
-- state as exceptions.

-- ══════════════════════════════════════════════════════════════════════════
-- 0. REFUSALS — ambiguity stops the migration, it does not get guessed at
-- ══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_rows text;
begin
  -- Money and merchant identity held across several places. See the mapping
  -- rule above: there is no non-arbitrary answer, so a human picks.
  select string_agg(format('%s (org %s holds %s places)', label, org, n), '; ')
    into v_rows
  from (
    select 'credit_lot ' || l.id::text as label, l.organization_id as org,
           (select count(*) from public.places p where p.organization_id = l.organization_id) as n
      from public.credit_lots l
    union all
    select 'partner_membership ' || m.id::text, m.organization_id,
           (select count(*) from public.places p where p.organization_id = m.organization_id)
      from public.partner_memberships m
    union all
    select 'payment_account ' || a.stripe_account_id, a.organization_id,
           (select count(*) from public.places p where p.organization_id = a.organization_id)
      from public.organization_payment_accounts a
    union all
    select 'guest_customer ' || g.stripe_customer_id, g.organization_id,
           (select count(*) from public.places p where p.organization_id = g.organization_id)
      from public.organization_guest_customers g
  ) t
  where t.n > 1;

  if v_rows is not null then
    raise exception
      'organization-owned records are shared across several places and cannot be mapped: %', v_rows
      using hint = 'Decide which place keeps each record (or split them) before re-running MESITA-1892.';
  end if;

  -- Money with nowhere to land is a refusal too: a prepaid balance is a debt
  -- to a guest, and dropping it would be discarding their money.
  select string_agg('credit_lot ' || l.id::text, '; ') into v_rows
    from public.credit_lots l
   where not exists (select 1 from public.places p where p.organization_id = l.organization_id);
  if v_rows is not null then
    raise exception 'credit lots belong to an organization that holds no place: %', v_rows
      using hint = 'These are outstanding guest balances. Attach the organization to a place, or refund them, before re-running MESITA-1892.';
  end if;
end $$;

-- Name every record that is about to be dropped for having no place, so the
-- apply log carries it even when nobody reads this file.
do $$
declare
  r record;
begin
  for r in
    select 'payment_account' as kind, a.stripe_account_id as ref, o.name as org
      from public.organization_payment_accounts a
      join public.organizations o on o.id = a.organization_id
     where not exists (select 1 from public.places p where p.organization_id = a.organization_id)
    union all
    select 'guest_customer', g.stripe_customer_id, o.name
      from public.organization_guest_customers g
      join public.organizations o on o.id = g.organization_id
     where not exists (select 1 from public.places p where p.organization_id = g.organization_id)
    union all
    select 'partner_membership', coalesce(m.stripe_subscription_id, m.id::text), o.name
      from public.partner_memberships m
      join public.organizations o on o.id = m.organization_id
     where not exists (select 1 from public.places p where p.organization_id = m.organization_id)
    union all
    select 'invite', i.email, o.name
      from public.organization_invites i
      join public.organizations o on o.id = i.organization_id
     where not exists (select 1 from public.places p where p.organization_id = i.organization_id)
  loop
    raise notice 'MESITA-1892 dropping orphan %: % (organization "%" holds no place)',
      r.kind, r.ref, r.org;
  end loop;
end $$;

-- ══════════════════════════════════════════════════════════════════════════
-- 1. THE PLACE TAKES WHAT THE ORGANIZATION HELD
-- ══════════════════════════════════════════════════════════════════════════

alter table public.places
  add column if not exists partnered                  boolean not null default false,
  add column if not exists legal_name                 text,
  add column if not exists rfc                        text,
  add column if not exists stripe_billing_customer_id text;

comment on column public.places.partnered is
  'Mesita Partner: the ENTITLEMENT, as opposed to the billing row in partner_memberships. Was organizations.partnered until MESITA-1892.';
comment on column public.places.legal_name is
  'The legal person this place trades as. Was organizations.legal_name.';
comment on column public.places.rfc is
  'Mexican tax ID, shaped and unique among places. One RFC is one merchant, and since MESITA-1892 one merchant is one place. Nullable: a place that has not been paid yet has no RFC.';
comment on column public.places.stripe_billing_customer_id is
  'The Stripe CUSTOMER this place pays Mesita as (Membership). Distinct from place_payment_accounts.stripe_account_id, which is the connected account it gets paid THROUGH.';

update public.places p
   set partnered                  = o.partnered,
       legal_name                 = o.legal_name,
       rfc                        = o.rfc,
       stripe_billing_customer_id = o.stripe_billing_customer_id
  from public.organizations o
 where o.id = p.organization_id;

-- THE TWO PAY BITS COLLAPSE INTO THE PLACE'S. The conjunction is written down
-- before the org bit disappears, so `profiles.mesita_pay_enabled` answers the
-- same thing after this migration as before it.
update public.place_profiles pp
   set mesita_pay_enabled = pp.mesita_pay_enabled
     and coalesce((select o.mesita_pay_enabled
                     from public.places pl
                     join public.organizations o on o.id = pl.organization_id
                    where pl.id = pp.id), false)
 where pp.mesita_pay_enabled;

comment on column public.place_profiles.mesita_pay_enabled is
  'The place runs Mesita Pay: the whole payments package, all or nothing. THE capability bit since MESITA-1892 — it used to be ANDed with its organization''s, and profiles.mesita_pay_enabled now reads it alone.';

-- The RFC rule moves with the column, both halves (MESITA-1880): the shape as
-- a CHECK, the uniqueness as a partial unique index. `_shared/place-rfc.ts`
-- matches `places_rfc_unique` by name to turn a 23505 into a sentence.
alter table public.places
  add constraint places_rfc_shape
  check (rfc is null or rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$');

create unique index places_rfc_unique
  on public.places (rfc) where rfc is not null;

create unique index places_stripe_billing_customer_id_key
  on public.places (stripe_billing_customer_id)
  where stripe_billing_customer_id is not null;

-- ══════════════════════════════════════════════════════════════════════════
-- 2. MEMBERSHIP — the org path becomes real place rows, capped at editor
-- ══════════════════════════════════════════════════════════════════════════
--
-- checkMembership resolved place_members OR (organization_members through
-- places.organization_id), and the org branch CAPPED AT EDITOR because
-- isLastOwnerOfPlace counts place_members owner rows and the Staff Check PIN
-- rides the owner branch. Writing `editor` here reproduces that cap exactly:
-- an org owner was an editor of the org's places, and stays one.
--
-- `do nothing` on conflict, never `do update`: a direct grant is the stronger
-- statement and must win. Nobody is promoted, nobody is demoted.

insert into public.place_members (place_id, manager_id, role)
select p.id,
       om.manager_id,
       (case when om.role = 'owner' then 'editor' else om.role::text end)::public.member_role
  from public.organization_members om
  join public.places p on p.organization_id = om.organization_id
on conflict (place_id, manager_id) do nothing;

-- ══════════════════════════════════════════════════════════════════════════
-- 3. THE MERCHANT ACCOUNT BECOMES THE PLACE'S
-- ══════════════════════════════════════════════════════════════════════════

create table public.place_payment_accounts (
  place_id          uuid primary key references public.places(id) on delete cascade,
  stripe_account_id text not null unique,
  livemode          boolean not null default false,
  charges_enabled   boolean not null default false,
  details_submitted boolean not null default false,
  payouts_enabled   boolean not null default false,
  requirements_due  jsonb   not null default '[]'::jsonb,
  disabled_reason   text,
  country           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint place_payment_accounts_country_iso
    check (country is null or country ~ '^[A-Z]{2}$')
);

comment on table public.place_payment_accounts is
  'The Stripe Connect account a place gets paid through. One place, one merchant account (MESITA-1892 — it hung off the organization until then). EF-only: RLS on, no policies, client privileges revoked.';
comment on column public.place_payment_accounts.disabled_reason is
  'Stripe sets this on a brand-new account too, so "disabled" and "never started" look identical — read details_submitted before reporting a state.';

alter table public.place_payment_accounts enable row level security;
revoke all on table public.place_payment_accounts from public, anon, authenticated;
grant all on table public.place_payment_accounts to service_role;

create trigger place_payment_accounts_set_updated_at
  before update on public.place_payment_accounts
  for each row execute function public.set_updated_at();

insert into public.place_payment_accounts (
  place_id, stripe_account_id, livemode, charges_enabled, details_submitted,
  payouts_enabled, requirements_due, disabled_reason, country, created_at, updated_at
)
select p.id, a.stripe_account_id, a.livemode, a.charges_enabled, a.details_submitted,
       a.payouts_enabled, a.requirements_due, a.disabled_reason, a.country, a.created_at, a.updated_at
  from public.organization_payment_accounts a
  join public.places p on p.organization_id = a.organization_id;

-- ══════════════════════════════════════════════════════════════════════════
-- 4. GUEST CUSTOMERS BECOME THE PLACE'S
-- ══════════════════════════════════════════════════════════════════════════

create table public.place_guest_customers (
  place_id           uuid not null references public.places(id) on delete cascade,
  consumer_id        uuid not null references public.consumers(id) on delete cascade,
  stripe_customer_id text not null,
  created_at         timestamptz not null default now(),
  primary key (place_id, consumer_id)
);

comment on table public.place_guest_customers is
  'The Stripe CUSTOMER a guest is, on the place''s connected account. Scoped to the place because the connected account is (MESITA-1892). EF-only.';

create index place_guest_customers_consumer_idx
  on public.place_guest_customers (consumer_id);

alter table public.place_guest_customers enable row level security;
revoke all on table public.place_guest_customers from public, anon, authenticated;
grant all on table public.place_guest_customers to service_role;

insert into public.place_guest_customers (place_id, consumer_id, stripe_customer_id, created_at)
select p.id, g.consumer_id, g.stripe_customer_id, g.created_at
  from public.organization_guest_customers g
  join public.places p on p.organization_id = g.organization_id;

-- ══════════════════════════════════════════════════════════════════════════
-- 5. CREDITS AND THE MEMBERSHIP RE-SCOPE IN PLACE
-- ══════════════════════════════════════════════════════════════════════════

alter table public.credit_lots add column place_id uuid references public.places(id) on delete restrict;
update public.credit_lots l
   set place_id = (select p.id from public.places p where p.organization_id = l.organization_id);
alter table public.credit_lots alter column place_id set not null;

drop index if exists public.credit_lots_consumer_org_idx;
drop index if exists public.credit_lots_organization_idx;
drop index if exists public.credit_lots_spendable_idx;
alter table public.credit_lots drop column organization_id;

create index credit_lots_place_idx          on public.credit_lots (place_id);
create index credit_lots_consumer_place_idx on public.credit_lots (consumer_id, place_id);
create index credit_lots_spendable_idx      on public.credit_lots (consumer_id, place_id, expires_at)
  where (paid_cents + bonus_cents) > spent_cents;

comment on column public.credit_lots.place_id is
  'The place these prepaid credits are spendable at. Was organization_id until MESITA-1892 — a balance is a debt to a guest at one venue now, not at a portfolio.';

alter table public.partner_memberships add column place_id uuid references public.places(id) on delete cascade;
update public.partner_memberships m
   set place_id = (select p.id from public.places p where p.organization_id = m.organization_id);
delete from public.partner_memberships where place_id is null;   -- orphans, named above
alter table public.partner_memberships alter column place_id set not null;

drop index if exists public.idx_partner_memberships_org;
drop index if exists public.partner_memberships_one_live;
alter table public.partner_memberships drop column organization_id;

create index partner_memberships_place_idx on public.partner_memberships (place_id);
create unique index partner_memberships_one_live
  on public.partner_memberships (place_id)
  where state in ('active', 'past_due');

comment on table public.partner_memberships is
  'The yearly Mesita Membership a PLACE buys (MESITA-1892). BILLING; places.partnered is the entitlement it grants.';

-- The plan catalogue is a vocabulary, not an org-owned record. Only its name
-- was organizational.
alter table public.org_plans rename to membership_plans;
update public.admin_reset_preserve
   set table_name = 'membership_plans',
       reason = 'Mesita Membership plan vocabulary — the Stripe price is provisioned from it'
 where table_name = 'org_plans';

-- ══════════════════════════════════════════════════════════════════════════
-- 6. THE VIEW STOPS ASKING AN ORGANIZATION ANYTHING
-- ══════════════════════════════════════════════════════════════════════════
--
-- Replaced BEFORE org_mesita_pay_enabled is dropped: the view calls it, and
-- `profiles` is SECURITY INVOKER, so anon and authenticated hold EXECUTE on
-- that function purely to satisfy this expression. Drop the function first and
-- every consumer browse request fails instead.
--
-- `WITH (security_invoker = true)` IS NOT OPTIONAL. `create or replace view`
-- RESETS reloptions; omitting it here would silently make the view run as its
-- OWNER and hand anon every row RLS exists to hide. The post-flight asserts it.

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
    -- ONE BIT NOW (MESITA-1892). It was `place AND organization`; the
    -- organization is gone and its half was folded into this column above, so
    -- the effective capability is unchanged and stated in one place still.
    p.mesita_pay_enabled
   FROM places u
     JOIN place_profiles p ON p.id = u.id;

-- ══════════════════════════════════════════════════════════════════════════
-- 7. THE FUNCTIONS SPEAK PLACE
-- ══════════════════════════════════════════════════════════════════════════

drop function if exists public.org_mesita_pay_enabled(uuid);

-- Claiming a place no longer files it under anything. What made a place
-- claimable was never the null organization_id on its own — `claim_place_into_org`
-- already refused a place that had an owner — so the owner row IS the fact,
-- and claimed_at is its provenance.
drop function if exists public.claim_place_into_org(uuid, uuid, uuid);

create or replace function public.claim_place(p_place_id uuid, p_claimer uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_updated integer;
begin
  if exists (
    select 1 from public.place_members
     where place_id = p_place_id and role = 'owner'
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_claimable');
  end if;

  update public.places
     set claimed_by = p_claimer,
         claimed_at = now()
   where id = p_place_id
     and claimed_at is null;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'code', 'race_lost');
  end if;

  insert into public.place_members (place_id, manager_id, role)
  values (p_place_id, p_claimer, 'owner')
  on conflict (place_id, manager_id) do update set role = 'owner';

  return jsonb_build_object('ok', true, 'claimed_at', now());
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'owner_conflict');
end;
$function$;

revoke all on function public.claim_place(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_place(uuid, uuid) to service_role;

drop function if exists public.release_place_from_org(uuid, uuid);

create or replace function public.release_place(p_place_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_claimed_at timestamptz;
  v_updated integer;
begin
  select claimed_at into v_claimed_at
    from public.places
   where id = p_place_id and claimed_at is not null;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'race_lost');
  end if;

  if exists (
    select 1 from public.place_subscriptions
     where place_id = p_place_id
       and state in ('active', 'past_due')
       and cancel_at_period_end = false
  ) then
    return jsonb_build_object('ok', false, 'code', 'subscription_live');
  end if;

  -- A released place keeps no partnership and no merchant identity: those are
  -- the operator's, and the operator is who just let go of it.
  update public.places
     set claimed_by                 = null,
         claimed_at                 = null,
         claim_reviewed_at          = null,
         claim_reviewed_by          = null,
         plan                       = 'free',
         partnered                  = false,
         legal_name                 = null,
         rfc                        = null,
         stripe_billing_customer_id = null
   where id = p_place_id
     and claimed_at is not null;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'code', 'race_lost');
  end if;

  delete from public.place_members
   where place_id = p_place_id
     and created_at >= v_claimed_at;

  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.release_place(uuid) from public, anon, authenticated;
grant execute on function public.release_place(uuid) to service_role;

-- The claim review gate loses its organization leg; `claimed_by` was always
-- the real evidence that a claim happened.
create or replace function public.mark_place_claim_reviewed(p_place_id uuid, p_admin uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_updated integer;
begin
  update public.places
     set claim_reviewed_at = now(),
         claim_reviewed_by = p_admin
   where id = p_place_id
     and claimed_by is not null
     and claim_reviewed_at is null;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'code', 'not_claimed_or_reviewed');
  end if;
  return jsonb_build_object('ok', true);
end;
$function$;

-- THE FOUR CREDIT FUNCTIONS ARE DROPPED AND REBUILT, not replaced: their
-- organization parameter becomes a place parameter, and `create or replace
-- function` refuses to rename an input parameter (42P13). They are dropped
-- together and up front because apply_ticket_credits calls spend_credits.
-- `drop … cascade` is deliberately NOT used: nothing should depend on these,
-- and if something does, this migration must stop rather than quietly take it
-- with them. Section 7's tail restores the EXECUTE lockdown a drop discards.
drop function if exists public.apply_ticket_credits(uuid, uuid, uuid, integer);
drop function if exists public.spend_credits(uuid, uuid, integer, text);
drop function if exists public.create_credit_lot(uuid, uuid, integer, integer, text, timestamptz, timestamptz, text);
drop function if exists public.create_credit_gift(uuid, uuid, integer, integer, text, text, timestamptz, integer, text, text);

create function public.spend_credits(
  p_consumer_id uuid, p_place_id uuid, p_amount_cents integer, p_reference text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_remaining integer := p_amount_cents;
  v_lot record;
  v_take integer;
  v_take_paid integer;
  v_take_bonus integer;
  v_paid_left integer;
  v_applied jsonb := '[]'::jsonb;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    return jsonb_build_object('ok', false, 'code', 'amount_not_positive');
  end if;

  for v_lot in
    select id, paid_cents, bonus_cents, spent_cents
      from public.credit_lots
     where consumer_id = p_consumer_id
       and place_id = p_place_id
       and activates_at <= now()
       and expires_at > now()
       and paid_cents + bonus_cents > spent_cents
     order by expires_at asc, created_at asc
     for update
  loop
    exit when v_remaining <= 0;
    v_take := least(
      v_remaining,
      v_lot.paid_cents + v_lot.bonus_cents - v_lot.spent_cents
    );

    v_paid_left := greatest(
      v_lot.paid_cents - least(v_lot.spent_cents, v_lot.paid_cents), 0
    );
    v_take_paid := least(v_take, v_paid_left);
    v_take_bonus := v_take - v_take_paid;

    update public.credit_lots
       set spent_cents = spent_cents + v_take
     where id = v_lot.id;

    insert into public.credit_ledger (
      lot_id, kind, paid_delta_cents, bonus_delta_cents, reference
    ) values (v_lot.id, 'spend', -v_take_paid, -v_take_bonus, p_reference);

    v_applied := v_applied || jsonb_build_object(
      'lotId', v_lot.id, 'cents', v_take,
      'paidCents', v_take_paid, 'bonusCents', v_take_bonus
    );
    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;

  return jsonb_build_object('ok', true, 'applied', v_applied);
exception
  when check_violation then
    return jsonb_build_object('ok', false, 'code', 'race_lost');
  when raise_exception then
    if sqlerrm = 'insufficient_credits' then
      return jsonb_build_object('ok', false, 'code', 'insufficient_credits');
    end if;
    raise;
end;
$function$;

create function public.apply_ticket_credits(
  p_ticket_id uuid, p_consumer_id uuid, p_place_id uuid, p_amount_cents integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ticket record;
  v_cap integer;
  v_spend jsonb;
begin
  select id, state, approved_amount_due_cents, tip_cents, credits_applied_cents
    into v_ticket
    from public.visit_tickets
   where id = p_ticket_id and consumer_id = p_consumer_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  -- IDEMPOTENT, NOT AN ERROR. A retried call after a successful-but-timed-out
  -- response must not re-spend.
  if v_ticket.credits_applied_cents > 0 then
    return jsonb_build_object(
      'ok', true, 'idempotent', true,
      'creditsAppliedCents', v_ticket.credits_applied_cents,
      'netAmountDueCents', v_ticket.approved_amount_due_cents - v_ticket.credits_applied_cents
    );
  end if;
  if v_ticket.state <> 'approved' then
    return jsonb_build_object('ok', false, 'code', 'stale_state', 'state', v_ticket.state);
  end if;

  -- Credits may only reduce (subtotal - discount), never the tip. coalesce is
  -- load-bearing: tip_cents is nullable and greatest(0, x - NULL) is NULL.
  v_cap := greatest(0, v_ticket.approved_amount_due_cents - coalesce(v_ticket.tip_cents, 0));
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > v_cap then
    return jsonb_build_object('ok', false, 'code', 'amount_out_of_range', 'cap', v_cap);
  end if;

  v_spend := public.spend_credits(
    p_consumer_id, p_place_id, p_amount_cents,
    'ticket:' || p_ticket_id::text
  );
  if not (v_spend ->> 'ok')::boolean then
    return v_spend;
  end if;

  update public.visit_tickets
     set credits_applied_cents = p_amount_cents
   where id = p_ticket_id and state = 'approved' and credits_applied_cents = 0;

  return jsonb_build_object(
    'ok', true,
    'creditsAppliedCents', p_amount_cents,
    'netAmountDueCents', v_ticket.approved_amount_due_cents - p_amount_cents
  );
end;
$function$;

create function public.create_credit_lot(
  p_place_id uuid, p_consumer_id uuid, p_paid_cents integer, p_bonus_cents integer,
  p_currency text, p_activates_at timestamptz, p_expires_at timestamptz,
  p_stripe_payment_intent_id text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  insert into public.credit_lots (
    place_id, consumer_id, paid_cents, bonus_cents, currency,
    activates_at, expires_at, stripe_payment_intent_id
  ) values (
    p_place_id, p_consumer_id, coalesce(p_paid_cents, 0),
    coalesce(p_bonus_cents, 0), coalesce(p_currency, 'MXN'),
    p_activates_at, p_expires_at, p_stripe_payment_intent_id
  ) returning id into v_id;

  insert into public.credit_ledger (
    lot_id, kind, paid_delta_cents, bonus_delta_cents, reference
  ) values (
    v_id, 'issue', coalesce(p_paid_cents, 0), coalesce(p_bonus_cents, 0),
    p_stripe_payment_intent_id
  );

  return jsonb_build_object('ok', true, 'lotId', v_id);
exception
  when unique_violation then
    select id into v_id
      from public.credit_lots
     where stripe_payment_intent_id = p_stripe_payment_intent_id;
    return jsonb_build_object('ok', true, 'lotId', v_id, 'idempotent', true);
end;
$function$;

create function public.create_credit_gift(
  p_place_id uuid, p_sender_id uuid, p_paid_cents integer, p_bonus_cents integer,
  p_currency text, p_code_hash text, p_claim_expires_at timestamptz,
  p_expiry_days integer, p_note text, p_stripe_payment_intent_id text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lot_id uuid;
  v_gift_id uuid;
  v_constraint text;
begin
  -- OWNERLESS ON PURPOSE. activates_at/expires_at only need to satisfy the
  -- table's own NOT NULL + ordering constraint here; nobody can spend an
  -- owner-less lot regardless (spend_credits filters on consumer_id). Redeem
  -- and cancel both overwrite these the moment the lot gets an owner.
  insert into public.credit_lots (
    place_id, consumer_id, paid_cents, bonus_cents, currency,
    activates_at, expires_at, stripe_payment_intent_id
  ) values (
    p_place_id, null, coalesce(p_paid_cents, 0),
    coalesce(p_bonus_cents, 0), coalesce(p_currency, 'MXN'),
    now(), p_claim_expires_at, p_stripe_payment_intent_id
  ) returning id into v_lot_id;

  insert into public.credit_ledger (
    lot_id, kind, paid_delta_cents, bonus_delta_cents, reference
  ) values (
    v_lot_id, 'issue', coalesce(p_paid_cents, 0), coalesce(p_bonus_cents, 0),
    p_stripe_payment_intent_id
  );

  insert into public.credit_gifts (
    lot_id, sender_id, code_hash, expires_at, expiry_days, note
  ) values (
    v_lot_id, p_sender_id, p_code_hash, p_claim_expires_at, p_expiry_days, p_note
  ) returning id into v_gift_id;

  return jsonb_build_object('ok', true, 'lotId', v_lot_id, 'giftId', v_gift_id);
exception
  when unique_violation then
    -- TWO DIFFERENT constraints can fire here, and they mean different
    -- things: the payment intent already funded a gift (SUCCESS — the
    -- webhook backstop and the synchronous confirm reader both try, and the
    -- loser must hand back what exists), or the drawn code collided with
    -- another LIVE gift (astronomically rare at 10 digits, but a real
    -- collision, not a retry-safe no-op) — the caller must draw a fresh
    -- code and call again rather than being told it already succeeded.
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'credit_lots_payment_intent_key' then
      select cl.id, cg.id into v_lot_id, v_gift_id
        from public.credit_lots cl
        join public.credit_gifts cg on cg.lot_id = cl.id
       where cl.stripe_payment_intent_id = p_stripe_payment_intent_id;
      return jsonb_build_object('ok', true, 'lotId', v_lot_id, 'giftId', v_gift_id, 'idempotent', true);
    end if;
    return jsonb_build_object('ok', false, 'code', 'gift_code_collision');
end;
$function$;

-- TWO FUNCTIONS CHANGE ONLY THEIR PROSE, and they have to: the post-flight
-- below refuses any function body that still says "organization", and these
-- two explain the money in the vocabulary this issue retires. Neither
-- signature nor behaviour moves.
create or replace function public.cancel_credit_gift(p_gift_id uuid, p_sender_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lot_id uuid;
  v_expiry_days integer;
begin
  -- MONEY MUST NEVER BE STRANDABLE. Only the SENDER of an UNCLAIMED gift may
  -- cancel — a claimed or cancelled gift, or someone else's gift, all refuse
  -- identically (the caller does not get to learn which).
  update public.credit_gifts
     set state = 'cancelled', cancelled_at = now()
   where id = p_gift_id
     and sender_id = p_sender_id
     and state = 'unclaimed'
   returning lot_id, expiry_days into v_lot_id, v_expiry_days;

  if v_lot_id is null then
    return jsonb_build_object('ok', false, 'code', 'gift_not_cancellable');
  end if;

  -- RETURN THE LOT, NOT A STRIPE REFUND. The place already holds the funds;
  -- cancelling only reassigns who owns the resulting balance — the same
  -- handover redeem does, landing on the sender instead of a stranger.
  update public.credit_lots
     set consumer_id = p_sender_id,
         activates_at = now(),
         expires_at = now() + (v_expiry_days || ' days')::interval
   where id = v_lot_id
     and consumer_id is null;

  if not found then
    raise exception 'credit_gift_cancel_lot_taken' using errcode = 'P0001';
  end if;

  return jsonb_build_object('ok', true, 'lotId', v_lot_id);
exception
  when raise_exception then
    if sqlerrm = 'credit_gift_cancel_lot_taken' then
      return jsonb_build_object('ok', false, 'code', 'gift_not_cancellable');
    end if;
    raise;
end;
$function$;

create or replace function public.reverse_credit_lot(
  p_lot_id uuid, p_kind text, p_amount_cents integer, p_reference text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lot record;
  v_available integer;
  v_take integer;
  v_take_paid integer;
  v_take_bonus integer;
  v_paid_left integer;
begin
  if p_kind not in ('refund', 'adjust') then
    return jsonb_build_object('ok', false, 'code', 'invalid_kind');
  end if;

  -- Idempotency BEFORE the row lock: a webhook retry (outer stripe_events
  -- dedupe already covers the common case, this is belt-and-suspenders —
  -- same posture as create_credit_lot's own unique-violation catch) or a
  -- doubled admin click must not claw back the same money twice.
  if p_reference is not null and exists (
    select 1 from public.credit_ledger
     where lot_id = p_lot_id and kind = p_kind and reference = p_reference
  ) then
    return jsonb_build_object('ok', true, 'idempotent', true, 'lotId', p_lot_id);
  end if;

  select id, paid_cents, bonus_cents, spent_cents
    into v_lot
    from public.credit_lots
   where id = p_lot_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'lot_not_found');
  end if;

  v_available := v_lot.paid_cents + v_lot.bonus_cents - v_lot.spent_cents;
  v_take := least(coalesce(p_amount_cents, v_available), v_available);

  if v_take is null or v_take <= 0 then
    return jsonb_build_object('ok', false, 'code', 'nothing_to_reverse', 'availableCents', v_available);
  end if;

  -- PRINCIPAL FIRST, same law and same reason as spend_credits: the
  -- guest's actual money is what a Stripe refund can return, so it is what
  -- gets claimed first; whatever remains comes out of the bonus. An
  -- 'adjust' claw-back has no Stripe leg to honor, but reusing the same
  -- order keeps one rule instead of two and is never wrong for a claw-back
  -- that, like a venue closing, empties the lot either way.
  v_paid_left := greatest(v_lot.paid_cents - least(v_lot.spent_cents, v_lot.paid_cents), 0);
  v_take_paid := least(v_take, v_paid_left);
  v_take_bonus := v_take - v_take_paid;

  update public.credit_lots
     set spent_cents = spent_cents + v_take
   where id = v_lot.id
     and spent_cents = v_lot.spent_cents;

  insert into public.credit_ledger (
    lot_id, kind, paid_delta_cents, bonus_delta_cents, reference
  ) values (v_lot.id, p_kind, -v_take_paid, -v_take_bonus, p_reference);

  return jsonb_build_object(
    'ok', true, 'lotId', v_lot.id, 'kind', p_kind,
    'centsReversed', v_take, 'paidCents', v_take_paid, 'bonusCents', v_take_bonus
  );
exception
  when check_violation then
    -- credit_lots_spent_range fired: a concurrent write moved spent_cents
    -- between our read and our write. Roll back, report the race honestly.
    return jsonb_build_object('ok', false, 'code', 'race_lost');
end;
$function$;

-- THE LOCKDOWN A DROP DISCARDS (20260910025122). A freshly created function
-- grants EXECUTE to PUBLIC by default, so the four rebuilt above would come
-- back open to anon and authenticated. These are the money path.
do $lockdown$
declare
  fn text;
begin
  foreach fn in array array[
    'public.spend_credits(uuid, uuid, integer, text)',
    'public.apply_ticket_credits(uuid, uuid, uuid, integer)',
    'public.create_credit_lot(uuid, uuid, integer, integer, text, timestamptz, timestamptz, text)',
    'public.create_credit_gift(uuid, uuid, integer, integer, text, text, timestamptz, integer, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $lockdown$;

-- A TABLE-RETURNING function's signature changes, so it is dropped and rebuilt
-- rather than replaced: `create or replace` cannot change the OUT columns.
drop function if exists public.get_credit_spend_report();

create function public.get_credit_spend_report()
returns table(place_id uuid, place_name text, paid_method text, spend_count bigint, spend_cents bigint)
language sql
security definer
set search_path to 'public'
as $function$
  -- Aliases are load-bearing: without them ORDER BY resolves `paid_method` to
  -- the raw vt.paid_method column instead of the grouped output expression,
  -- which Postgres refuses outside GROUP BY.
  select
    cl.place_id,
    pp.name as place_name,
    coalesce(vt.paid_method, 'unknown') as paid_method,
    count(*)::bigint as spend_count,
    sum(-(le.paid_delta_cents + le.bonus_delta_cents))::bigint as spend_cents
  from public.credit_ledger le
  join public.credit_lots cl on cl.id = le.lot_id
  join public.place_profiles pp on pp.id = cl.place_id
  left join public.visit_tickets vt
    on le.reference = 'ticket:' || vt.id::text
  where le.kind = 'spend'
  group by cl.place_id, pp.name, coalesce(vt.paid_method, 'unknown')
  order by pp.name, paid_method;
$function$;

revoke all on function public.get_credit_spend_report() from public, anon, authenticated;
grant execute on function public.get_credit_spend_report() to service_role;

create or replace function public.get_credit_liability()
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'byCurrency', coalesce((
      select jsonb_agg(jsonb_build_object(
        'currency', s.currency,
        'issuedCents', s.issued_cents,
        'outstandingCents', s.outstanding_cents,
        'pendingCents', s.pending_cents,
        'pendingLotCount', s.pending_lot_count,
        'breakageCents', coalesce(b.breakage_cents, 0),
        'lotCount', s.lot_count
      ) order by s.currency)
      from (
        select
          l.currency,
          sum(l.paid_cents + l.bonus_cents)::bigint as issued_cents,
          sum(l.paid_cents + l.bonus_cents - l.spent_cents)::bigint as outstanding_cents,
          sum(l.paid_cents + l.bonus_cents - l.spent_cents)
            filter (where l.activates_at > now())::bigint as pending_cents,
          count(*) filter (
            where l.activates_at > now() and l.paid_cents + l.bonus_cents > l.spent_cents
          ) as pending_lot_count,
          count(*) as lot_count
        from public.credit_lots l
        group by l.currency
      ) s
      left join (
        -- Breakage falls out of the two-delta ledger with no need to branch on
        -- which disposition wrote the 'expire' row.
        select gl.currency, sum(-(g.paid_delta_cents + g.bonus_delta_cents))::bigint as breakage_cents
        from public.credit_ledger g
        join public.credit_lots gl on gl.id = g.lot_id
        where g.kind = 'expire'
        group by gl.currency
      ) b on b.currency = s.currency
    ), '[]'::jsonb),
    'byPlace', coalesce((
      select jsonb_agg(jsonb_build_object(
        'placeId', t.place_id,
        'placeName', pp.name,
        'currency', t.currency,
        'issuedCents', t.issued_cents,
        'outstandingCents', t.outstanding_cents,
        'lotCount', t.lot_count,
        'currencyMismatch', t.currency is distinct from pl.currency
      ) order by t.outstanding_cents desc)
      from (
        select
          place_id,
          currency,
          sum(paid_cents + bonus_cents)::bigint as issued_cents,
          sum(paid_cents + bonus_cents - spent_cents)::bigint as outstanding_cents,
          count(*) as lot_count
        from public.credit_lots
        group by place_id, currency
      ) t
      join public.places pl on pl.id = t.place_id
      join public.place_profiles pp on pp.id = t.place_id
    ), '[]'::jsonb),
    'expiryDisposition', (
      select controls_config ->> 'expiryDisposition' from public.app_config where id = 1
    ),
    'generatedAt', now()
  );
$function$;

-- ══════════════════════════════════════════════════════════════════════════
-- 8. THE LAYER GOES
-- ══════════════════════════════════════════════════════════════════════════

drop index if exists public.places_unreviewed_claims_idx;
drop index if exists public.places_organization_idx;

drop table if exists public.organization_guest_customers;
drop table if exists public.organization_payment_accounts;
drop table if exists public.organization_invites;
drop table if exists public.organization_members;

drop function if exists public.organization_members_check_owner_remains();

alter table public.places drop column organization_id;
drop table if exists public.organizations;

-- Rebuilt without the organization leg: `claimed_by` is the evidence.
create index places_unreviewed_claims_idx
  on public.places (claimed_at desc)
  where claimed_by is not null and claim_reviewed_at is null;

comment on column public.places.claimed_by is
  'Who claimed this place. Provenance, not authorization — the place_members owner row is the grant.';

-- ══════════════════════════════════════════════════════════════════════════
-- 9. POST-FLIGHT — the removal is asserted, not assumed
-- ══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_leftover text;
begin
  -- No organization table, view or matview survives anywhere in public.
  select string_agg(c.relname, ', ') into v_leftover
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r','v','m','p')
     and c.relname ilike '%organization%';
  if v_leftover is not null then
    raise exception 'organization relations survived: %', v_leftover;
  end if;

  -- No organization column survives anywhere in public.
  select string_agg(table_name || '.' || column_name, ', ') into v_leftover
    from information_schema.columns
   where table_schema = 'public' and column_name ilike '%organization%';
  if v_leftover is not null then
    raise exception 'organization columns survived: %', v_leftover;
  end if;

  -- No function body still mentions one.
  select string_agg(p.proname, ', ') into v_leftover
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f' and p.prosrc ilike '%organization%';
  if v_leftover is not null then
    raise exception 'functions still reference organizations: %', v_leftover;
  end if;

  -- The place carries what the organization held.
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='places' and column_name='partnered') then
    raise exception 'places.partnered missing after migration';
  end if;
  if not exists (select 1 from pg_class where oid = 'public.place_payment_accounts'::regclass) then
    raise exception 'place_payment_accounts missing after migration';
  end if;

  -- The view's two INSTEAD OF triggers must survive the replace: they are how
  -- every EF writes a place, and losing them fails silently on the next write.
  if (select count(*) from pg_trigger
       where tgrelid='public.profiles'::regclass and not tgisinternal) <> 2 then
    raise exception 'profiles lost its INSTEAD OF triggers during the view replace';
  end if;

  -- The option `create or replace view` silently drops.
  if not exists (select 1 from pg_class
    where oid = 'public.profiles'::regclass
      and reloptions @> array['security_invoker=true']) then
    raise exception 'profiles lost security_invoker during the view replace — RLS is being bypassed';
  end if;

  -- The new tenant tables stay EF-only, like the ones they replace.
  if has_table_privilege('anon', 'public.place_payment_accounts', 'SELECT')
     or has_table_privilege('authenticated', 'public.place_payment_accounts', 'SELECT')
     or has_table_privilege('anon', 'public.place_guest_customers', 'SELECT')
     or has_table_privilege('authenticated', 'public.place_guest_customers', 'SELECT') then
    raise exception 'the new place-scoped tenant tables are readable by a client role';
  end if;
end $$;

notify pgrst, 'reload schema';

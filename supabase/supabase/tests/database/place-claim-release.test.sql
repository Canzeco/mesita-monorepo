-- claim_place / release_place — the two functions that replaced organization
-- ownership (MESITA-1892).
--
-- WHY ITS OWN FILE. `schema_invariants.test.sql` asserts SHAPE: the column is
-- there, the key is there, the privilege is there. These two functions are the
-- only place in the schema where "who owns this place" is DECIDED, and shape
-- cannot say anything about a decision. `claim_place_into_org` and
-- `release_place_from_org` were dropped and rebuilt with different bodies, not
-- renamed, and the rebuild is where ownership rules get lost quietly — a
-- refusal that stamps the row anyway, a release that forgets half of what it
-- was supposed to clear. So: build a place, run the function, read the rows
-- back. Nothing here asserts that a function exists.
--
-- WHAT EACH CASE IS PROTECTING, none of them hypothetical:
--   · a claim on a place somebody already owns must refuse AND leave no trace
--     — a refusal that stamped claimed_at would make the place permanently
--     unclaimable by anyone, including the real operator
--   · two claims racing: the owner check and the UPDATE are separate
--     statements, so both callers can pass the check and exactly one must win
--   · release must clear the merchant identity, not just the claim. MESITA-1892
--     added partnered / legal_name / rfc / stripe_billing_customer_id to the
--     release for one reason: those are the OPERATOR's, and the operator is who
--     just let go. A released place that keeps `partnered = true` is a free
--     Partner entitlement sitting in the catalogue waiting for the next claimer
--   · release must refuse while money is still moving — a live subscription
--     outlives the claim, and cancelling it is Stripe's job, not this RPC's
--   · release deletes the memberships the claim created, and ONLY those.
--     `created_at >= claimed_at` is the rule; a grant that predates the claim
--     was never the claimer's to revoke.

begin;
select plan(19);

-- ── FIXTURES ──────────────────────────────────────────────────────────────
--
-- `managers.id` carries an FK to `auth.users(id)`, and `places.id` carries one
-- to `place_profiles(id)`, so both parents go in first. `place_profiles.name`
-- is GENERATED from mesita_name/google_name and cannot be written directly —
-- `google_name` is what satisfies place_profiles_name_source_present.

insert into auth.users (id) values
  ('bbbb0001-0000-4000-8000-000000000001'),
  ('bbbb0002-0000-4000-8000-000000000002');

insert into public.managers (id, email) values
  ('bbbb0001-0000-4000-8000-000000000001', 'claimer@pgtap.test'),
  ('bbbb0002-0000-4000-8000-000000000002', 'incumbent@pgtap.test');

insert into public.place_profiles (id, google_name) values
  ('aaaa0001-0000-4000-8000-000000000001', 'pgTAP Unclaimed'),
  ('aaaa0002-0000-4000-8000-000000000002', 'pgTAP Already Owned'),
  ('aaaa0003-0000-4000-8000-000000000003', 'pgTAP Raced'),
  ('aaaa0004-0000-4000-8000-000000000004', 'pgTAP Released'),
  ('aaaa0005-0000-4000-8000-000000000005', 'pgTAP Still Paying'),
  ('aaaa0006-0000-4000-8000-000000000006', 'pgTAP Never Claimed');

insert into public.places (id, slug) values
  ('aaaa0001-0000-4000-8000-000000000001', 'pgtap-unclaimed'),
  ('aaaa0002-0000-4000-8000-000000000002', 'pgtap-already-owned'),
  ('aaaa0003-0000-4000-8000-000000000003', 'pgtap-raced'),
  ('aaaa0004-0000-4000-8000-000000000004', 'pgtap-released'),
  ('aaaa0005-0000-4000-8000-000000000005', 'pgtap-still-paying'),
  ('aaaa0006-0000-4000-8000-000000000006', 'pgtap-never-claimed');

-- ── claim_place: the happy path ───────────────────────────────────────────
--
-- Three separate facts, because they can come apart: the RPC's answer, the
-- provenance stamp on the place, and the grant. The grant is the one that
-- actually authorizes anything — `places.claimed_by` is provenance, the
-- place_members OWNER row is what checkMembership reads.

select is(
  (public.claim_place(
    'aaaa0001-0000-4000-8000-000000000001',
    'bbbb0001-0000-4000-8000-000000000001'
  ) ->> 'ok')::boolean,
  true,
  'claim_place on a place nobody owns succeeds'
);

select is(
  (select claimed_by from public.places
    where id = 'aaaa0001-0000-4000-8000-000000000001'),
  'bbbb0001-0000-4000-8000-000000000001'::uuid,
  'the claimer is stamped on the place (provenance for the admin claim review)'
);

select ok(
  (select claimed_at is not null from public.places
    where id = 'aaaa0001-0000-4000-8000-000000000001'),
  'claimed_at is stamped (it is what release_place later uses to decide which grants the claim created)'
);

select is(
  (select role::text from public.place_members
    where place_id = 'aaaa0001-0000-4000-8000-000000000001'
      and manager_id = 'bbbb0001-0000-4000-8000-000000000001'),
  'owner',
  'claim_place grants OWNER, not editor (the owner row is the authorization; claimed_by is not)'
);

-- ── claim_place: the place already has an owner ───────────────────────────

insert into public.place_members (place_id, manager_id, role) values
  ('aaaa0002-0000-4000-8000-000000000002',
   'bbbb0002-0000-4000-8000-000000000002', 'owner');

select is(
  public.claim_place(
    'aaaa0002-0000-4000-8000-000000000002',
    'bbbb0001-0000-4000-8000-000000000001'
  ) ->> 'code',
  'not_claimable',
  'a place that already has an owner refuses the claim'
);

-- THE REFUSAL MUST BE TOTAL. The owner check runs before the UPDATE, so this
-- passes today — but the two are separate statements and a later reordering
-- would leave claimed_at set on a place whose claim was refused, which makes
-- it permanently unclaimable by the `claimed_at is null` guard below.
select ok(
  (select claimed_at is null from public.places
    where id = 'aaaa0002-0000-4000-8000-000000000002'),
  'the refused claim left claimed_at alone (a stamped-but-refused place can never be claimed again)'
);

select is(
  (select count(*)::int from public.place_members
    where place_id = 'aaaa0002-0000-4000-8000-000000000002'),
  1,
  'and the refused claimer got no membership — the incumbent owner is still the only member'
);

-- ── claim_place: the race ─────────────────────────────────────────────────
--
-- STAGED, not simulated with a second session. The interleaving this guard
-- exists for is: two callers both pass the owner check, one wins the UPDATE,
-- and the loser must not insert an owner row for a place it did not claim.
-- The loser's view of the world at that instant is exactly this — claimed_at
-- set, no owner row yet, because the winner has not reached its INSERT — so
-- writing that state down and calling the function reproduces it exactly,
-- deterministically, in one transaction.

update public.places
   set claimed_by = 'bbbb0002-0000-4000-8000-000000000002',
       claimed_at = now()
 where id = 'aaaa0003-0000-4000-8000-000000000003';

select is(
  public.claim_place(
    'aaaa0003-0000-4000-8000-000000000003',
    'bbbb0001-0000-4000-8000-000000000001'
  ) ->> 'code',
  'race_lost',
  'the loser of a claim race is told it lost, not told it won'
);

select is(
  (select count(*)::int from public.place_members
    where place_id = 'aaaa0003-0000-4000-8000-000000000003'),
  0,
  'and the loser inserted no owner row (two owners is what place_members_one_owner_per_place would have to catch)'
);

-- ── release_place: money still moving ─────────────────────────────────────
--
-- Checked before the release, because the refusal has to be tested against a
-- place that is otherwise perfectly releasable — otherwise a release that
-- refuses for the wrong reason passes.

select public.claim_place(
  'aaaa0005-0000-4000-8000-000000000005',
  'bbbb0001-0000-4000-8000-000000000001'
);

insert into public.place_subscriptions (place_id, plan_key, state) values
  ('aaaa0005-0000-4000-8000-000000000005', 'pro', 'active');

select is(
  public.release_place('aaaa0005-0000-4000-8000-000000000005') ->> 'code',
  'subscription_live',
  'release_place refuses while a live subscription is still billing (cancelling it is Stripe''s job, not this RPC''s)'
);

select ok(
  (select claimed_at is not null from public.places
    where id = 'aaaa0005-0000-4000-8000-000000000005'),
  'and the refusal changed nothing — the place is still claimed by the operator who is still paying'
);

-- ── release_place: the full release ───────────────────────────────────────
--
-- The place is loaded with everything a release is supposed to strip: a claim,
-- an admin review of that claim, a paid plan, and the four merchant-identity
-- facts the organization row used to hold. The editor grant is written with an
-- explicit past `created_at` on purpose — every row in one transaction shares
-- the same now(), so a grant inserted here without it would be
-- indistinguishable from one the claim created and the `created_at >=
-- claimed_at` rule could not be tested at all.

insert into public.place_members (place_id, manager_id, role, created_at) values
  ('aaaa0004-0000-4000-8000-000000000004',
   'bbbb0002-0000-4000-8000-000000000002', 'editor', now() - interval '1 day');

select public.claim_place(
  'aaaa0004-0000-4000-8000-000000000004',
  'bbbb0001-0000-4000-8000-000000000001'
);

update public.places
   set claim_reviewed_at          = now(),
       claim_reviewed_by          = 'bbbb0001-0000-4000-8000-000000000001',
       plan                       = 'pro',
       partnered                  = true,
       legal_name                 = 'Tacos del Centro SA de CV',
       rfc                        = 'MEST900101AB1',
       stripe_billing_customer_id = 'cus_pgtap_release'
 where id = 'aaaa0004-0000-4000-8000-000000000004';

select is(
  (public.release_place('aaaa0004-0000-4000-8000-000000000004') ->> 'ok')::boolean,
  true,
  'release_place on a claimed place with no live subscription succeeds'
);

select ok(
  (select claimed_by is null and claimed_at is null from public.places
    where id = 'aaaa0004-0000-4000-8000-000000000004'),
  'the claim stamp is gone (the place is claimable again)'
);

select ok(
  (select claim_reviewed_at is null and claim_reviewed_by is null from public.places
    where id = 'aaaa0004-0000-4000-8000-000000000004'),
  'the admin review of that claim is gone too (a review of a claim that no longer exists would keep the next claim out of the review queue)'
);

select is(
  (select plan::text from public.places
    where id = 'aaaa0004-0000-4000-8000-000000000004'),
  'free',
  'the plan resets to free (a released place must not keep a paid tier nobody is paying for)'
);

-- Derived rather than four assertions, so the failure NAMES the fact that
-- survived. These four are the ones MESITA-1892 added to the release and the
-- ones nothing checked: `partnered` surviving is a free Partner entitlement
-- waiting for the next claimer, and the other three are one operator's legal
-- identity handed to another.
select is_empty(
  $$select label from (
      select 'partnered' as label, partnered is distinct from false as survived
        from public.places where id = 'aaaa0004-0000-4000-8000-000000000004'
      union all
      select 'legal_name', legal_name is not null
        from public.places where id = 'aaaa0004-0000-4000-8000-000000000004'
      union all
      select 'rfc', rfc is not null
        from public.places where id = 'aaaa0004-0000-4000-8000-000000000004'
      union all
      select 'stripe_billing_customer_id', stripe_billing_customer_id is not null
        from public.places where id = 'aaaa0004-0000-4000-8000-000000000004'
    ) t
    where t.survived$$,
  'release_place clears every merchant-identity fact the operator brought (partnered, legal_name, rfc, stripe_billing_customer_id)'
);

select is(
  (select count(*)::int from public.place_members
    where place_id = 'aaaa0004-0000-4000-8000-000000000004'),
  1,
  'the OWNER row the claim created is deleted by the release'
);

select is(
  (select role::text from public.place_members
    where place_id = 'aaaa0004-0000-4000-8000-000000000004'
      and manager_id = 'bbbb0002-0000-4000-8000-000000000002'),
  'editor',
  'and the grant that predates the claim survives it — it was never the claimer''s to revoke'
);

-- ── release_place: nothing to release ─────────────────────────────────────

select is(
  public.release_place('aaaa0006-0000-4000-8000-000000000006') ->> 'code',
  'race_lost',
  'releasing a place that was never claimed refuses instead of clearing a live operator''s columns'
);

select * from finish();

rollback;

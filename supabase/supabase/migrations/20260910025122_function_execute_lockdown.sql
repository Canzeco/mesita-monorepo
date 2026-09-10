-- Credit-gift RPCs were callable by anon, and the door that let them in is
-- still open for the next function anyone writes (MESITA-1721).
--
-- THE SYMPTOM. create_credit_gift, redeem_credit_gift and cancel_credit_gift
-- (20260908160404_credit_gifts_issuance.sql) shipped as SECURITY DEFINER
-- money functions carrying PUBLIC + anon + authenticated EXECUTE. `public` is
-- an exposed PostgREST schema, so anyone holding the publishable anon key --
-- it ships in every browser bundle -- could POST /rest/v1/rpc/create_credit_gift
-- with an arbitrary p_paid_cents / p_bonus_cents and mint gift Credits, or
-- POST redeem_credit_gift against a guessed code hash. That contradicts the
-- standing rule that clients call Edge Functions, never the DB.
--
-- THE CAUSE. Postgres grants EXECUTE to PUBLIC by default on every function
-- it creates. 20260807170433_alter_default_privileges_no_client.sql (MESITA-942)
-- closed that door for TABLES and SEQUENCES and never mentioned FUNCTIONS, so
-- the default has been re-arming itself on every `create function` since.
-- 20260909234346_credits_settle_ticket_bill.sql noticed the same thing one day
-- ago and hand-revoked three functions (apply_ticket_credits, create_credit_lot,
-- spend_credits). Hand-revoking is why the gift trio, written the day before in
-- a different migration, was missed -- and why the next one would be too.
--
-- So this migration does both halves: it shuts the default off for every future
-- function, then sweeps the eight that already inherited it.

-- ── The cause: no client role gets EXECUTE on a new function by default ────
--
-- Mirrors the tables/sequences stanza in MESITA-942 exactly, including the
-- service_role grant, so the two read as one rule. A function that genuinely
-- needs a client caller now has to say so out loud with an explicit grant,
-- which is the reviewable outcome we want.

alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;

alter default privileges in schema public
  grant execute on functions to service_role;

-- ── The symptom: the three gift RPCs, the actual vulnerability ─────────────

revoke execute on function public.create_credit_gift(uuid, uuid, integer, integer, text, text, timestamptz, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.create_credit_gift(uuid, uuid, integer, integer, text, text, timestamptz, integer, text, text)
  to service_role;

revoke execute on function public.redeem_credit_gift(text, uuid)
  from public, anon, authenticated;
grant execute on function public.redeem_credit_gift(text, uuid)
  to service_role;

revoke execute on function public.cancel_credit_gift(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cancel_credit_gift(uuid, uuid)
  to service_role;

-- ── Same slip, no money attached, swept while we are here ──────────────────
--
-- org_mesita_pay_enabled answers "does this org accept Mesita Pay" to anon.
-- is_super_admin lets any signed-in user probe whether an email is an admin.
-- is_place_member takes a place id and answers membership for the caller.
-- None is reachable from a client by design: consumer-web-get-place and the
-- business console read these facts through Edge Functions holding the
-- service key. is_place_member's p_project_id parameter is a leftover of the
-- project->place rename and is dropped outright in MESITA-1725; revoking here
-- first means the window does not stay open if that lands later.

revoke execute on function public.org_mesita_pay_enabled(uuid)
  from public, anon, authenticated;
grant execute on function public.org_mesita_pay_enabled(uuid)
  to service_role;

revoke execute on function public.is_super_admin()
  from public, anon, authenticated;
grant execute on function public.is_super_admin()
  to service_role;

revoke execute on function public.is_place_member(uuid)
  from public, anon, authenticated;
grant execute on function public.is_place_member(uuid)
  to service_role;

-- ── The two trigger functions: search_path, not grants ─────────────────────
--
-- organization_members_check_owner_remains and place_name_history_capture are
-- the remaining client-executable functions, and both are SECURITY INVOKER
-- trigger functions: called directly they abort with "can only be called as a
-- trigger", so the EXECUTE grant is noise rather than an exploit path, and
-- revoking it risks the trigger itself for no security gain. Their real defect
-- is the one the linter names -- a role-mutable search_path
-- (function_search_path_mutable) -- which is a live hazard for any function a
-- non-owner can cause to fire. Pinned to public, pg_temp rather than '' so the
-- unqualified references already in both bodies keep resolving.

alter function public.organization_members_check_owner_remains()
  set search_path = public, pg_temp;

alter function public.place_name_history_capture()
  set search_path = public, pg_temp;

-- Restores anon/authenticated EXECUTE on org_mesita_pay_enabled, revoked one
-- migration ago in error (MESITA-1721).
--
-- The revoke read as obviously safe: a SECURITY DEFINER helper answering "does
-- this org accept Mesita Pay", with no caller in any Edge Function or app. It
-- has a caller. `public.profiles` calls it in the view BODY, and profiles is
-- `security_invoker` -- so the body runs as the CLIENT role, and a guest
-- browsing places is the one who needs EXECUTE. Revoking it turned every
-- consumer browse into permission denied.
--
-- This is the failure mode 20260908110045 and MESITA-1704 already wrote down,
-- in the same view, for the same reason: "a privilege on a VIEW says the role
-- may reach it; a security_invoker view then re-checks the role against
-- everything its BODY touches." A grep for callers reads function bodies and
-- app source. It does not read view definitions. The lesson generalises: before
-- revoking EXECUTE on anything, check pg_views for the name, not just the code.
--
-- schema_invariants.test.sql caught this on the first CI run -- the probe that
-- actually performs the read as anon rather than asserting a privilege bit.
-- That test earned its keep.

grant execute on function public.org_mesita_pay_enabled(uuid)
  to anon, authenticated;

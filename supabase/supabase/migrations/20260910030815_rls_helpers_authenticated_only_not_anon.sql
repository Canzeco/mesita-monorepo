-- The previous migration over-restored: it handed anon EXECUTE on the two
-- storage RLS helpers, which anon never had (MESITA-1721, caught by Bugbot).
--
-- 20260709193000_place_images_storage_policies.sql revokes both functions from
-- PUBLIC and then grants EXECUTE to `authenticated` alone, and MESITA-446
-- revoked anon deliberately so the publishable key could not POST them as
-- PostgREST RPCs. The twelve storage policies only ever evaluate them for a
-- signed-in operator, so anon has no reason to hold EXECUTE.
--
-- Restoring "what was there" is not the same as granting both client roles.
-- Net across this issue's four migrations, the three helpers end exactly where
-- they started -- org_mesita_pay_enabled anon+authenticated, is_super_admin and
-- is_place_member authenticated only -- and the only functions that actually
-- changed posture are the three credit-gift RPCs, which is the whole point.

revoke execute on function public.is_super_admin() from anon;
revoke execute on function public.is_place_member(uuid) from anon;

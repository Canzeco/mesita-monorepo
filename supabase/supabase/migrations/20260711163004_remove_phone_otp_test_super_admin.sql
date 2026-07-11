-- MESITA-546 — remove phone-OTP test super-admin seed.
--
-- Draft PR #14 applied a seed row for +52 444 549 9597 with a hardcoded Auth
-- test OTP (123456). That is an open production door. Delete the allowlist
-- row; Auth test-phone override (if still set) is a separate dashboard step.

delete from public.super_admins
where email = 'admin-524445499597@phone.mesita.local'
   or phone = '524445499597';

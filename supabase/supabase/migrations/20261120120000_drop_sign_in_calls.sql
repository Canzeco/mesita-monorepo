-- MESITA-4318: phone sign-in is a text code only. The call pick table
-- has no reader once consumer-web-call-sign-in-code and the Send SMS hook's
-- call branch are gone. sign_in_codes was already dropped by
-- 20261109010000_sign_in_calls.sql.

drop table if exists public.sign_in_calls;

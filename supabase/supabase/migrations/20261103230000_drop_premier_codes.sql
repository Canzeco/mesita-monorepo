-- MESITA-3183 — Premier codes are gone (Pato, 2026-11-03: "fuck the coupons
-- everywhere"; reverses MESITA-3167). A place gets a Boost from Mesita or from
-- a guest buying one, never from a code.
--
-- Data: checked live before this was written: 0 codes, 0 redemptions, 0
-- attempts, and no place_manual_premier row with source 'code'. Nothing is lost.

drop function if exists public.premier_redeem_code(text, uuid, uuid);
drop table if exists public.premier_code_redemptions;
drop table if exists public.premier_code_attempts;
drop table if exists public.premier_codes;

alter table public.place_manual_premier drop constraint if exists place_manual_premier_source_check;
alter table public.place_manual_premier
  add constraint place_manual_premier_source_check check (source in ('admin', 'purchase'));

-- MESITA-3696 — the Staff QR. A waiter scans the place's Staff QR once per
-- shift and their phone is staff for 12 hours, with no place code typed.
--
-- The QR is a link to visit.mesita.ai/staff/<place>#<secret>. The secret
-- lives beside the place code on place_codes (EF-only: RLS on, no client
-- grants), readable to the owner on Business › Payments so they can print it
-- again. "New Staff QR" replaces it; every staff token of the place is signed
-- over the code hash AND this secret, so a new QR or a new code ends them all.

alter table public.place_codes
  add column staff_qr text check (staff_qr is null or staff_qr ~ '^[A-Za-z0-9_-]{43}$'),
  add column staff_qr_made_at timestamptz,
  add column staff_qr_used_at timestamptz;

comment on column public.place_codes.staff_qr is
  'MESITA-3696: the Staff QR secret (32 random bytes, base64url). A bearer key like the place code; EF-only, shown to the owner on Business › Payments.';
comment on column public.place_codes.staff_qr_used_at is
  'MESITA-3696: the last time a phone signed in with the Staff QR (Business › Payments shows it).';

-- MESITA-4886 — the owner always sees a waiter's code (Pato, 2026-11-24: "it's
-- not a nuclear code. show it"). The table stays EF-only and only who manages
-- the place is answered it. A code made before this has none: New code shows one.
alter table public.place_waiters
  add column code text check (code is null or (code ~ '^[0-9]{8}$' and removed_at is null));
comment on column public.place_waiters.code is 'MESITA-4886: the 8-digit code, for the owner''s screen; lookup_hash is what is matched. Null once removed, or made before this column.';

-- MESITA-823 — optional staff PIN for the public check page.
--
-- Pato (2026-08-02, reaffirming after the waiter retirement): "you scan a
-- qr, and you need some 6 digits PIN to mark ticket as done. optional. but
-- maybe big companies want that so there you have it."
--
-- This is NOT a waiter identity (MESITA-833 stands): it is one shared,
-- per-place 6-digit PIN, stored on the projects entity. NULL = gate off
-- (the default — the check page stays two-tap). When set, the check-web
-- WRITE endpoints (submit-bill, verify-action, mark-paid) require it;
-- check-web-get-ticket never does — a guest showing their own pass must
-- always resolve.
--
-- Stored in plaintext on purpose: the place manager must be able to READ
-- the PIN to tell staff (it's a shared secret with ~20 bits of entropy —
-- hashing would only pretend otherwise). The table is EF-only (RLS
-- lockdown, no anon policies); the public payload allowlist in
-- _shared/ticket-check.ts exposes only a boolean pin_required, never the
-- value. Wrong attempts are audit-logged to ticket_check_events
-- ('pin_rejected'), which also feeds the sliding-window rate limiter.

alter table public.projects
  add column check_pin text
  constraint projects_check_pin_format
  check (check_pin is null or check_pin ~ '^[0-9]{6}$');

comment on column public.projects.check_pin is
  'Optional shared staff PIN (6 digits) gating check-page WRITE actions (MESITA-823). NULL = off. Plaintext by design — the owner reads it to brief staff; never exposed in public check payloads.';

-- Drop two dead RPCs (MESITA-1725).
--
-- MESITA-1725 opened against six objects: four functions plus
-- reservation_call_counters and its writer. Re-verifying each one
-- independently against repo source AND the live catalog found FOUR of the
-- six are still reached. Only the two below are genuinely unreferenced, so
-- only the two below are dropped. The four survivors are documented at the
-- bottom of this header so nobody re-opens this investigation, or worse,
-- "finishes the job" from the issue text alone.
--
-- Method, applied per object, all read-only:
--   1. grep supabase/functions/, apps/*/src, supabase/migrations/ and
--      supabase/tests/ for the name and for partial forms of it.
--   2. Enumerate every `.rpc("<literal>")` name reachable from EF and app
--      source (both non-literal-looking call sites turned out to be plain
--      string literals wrapped across lines: mark_place_claim_reviewed and
--      service_elevenlabs_api_key). That whitelist is the ground truth for
--      "is any client calling this".
--   3. Live catalog: pg_depend, pg_policy (qual AND with-check),
--      pg_constraint contype='c', pg_trigger, pg_get_viewdef, pg_attrdef,
--      and pg_proc.prosrc ILIKE for any other function body naming it.
--   4. cron.job command text, read in full.
--
-- ── DROPPED ───────────────────────────────────────────────────────────────
--
-- public.find_user_id_by_phone(text)
--   Added 20260601120000_staff_ticket_type_a_flow.sql for the staff ticket
--   Type-A flow, then immediately fenced by
--   20260626230000_rls_hardening.sql, whose own comment calls out that it
--   "enables phone→user-id enumeration over auth.users" and revokes it from
--   public/anon/authenticated, leaving service_role only. Nothing ever took
--   it up on that: no EF calls it, no app calls it, and nothing in the repo
--   mentions `phone_digits` or `by_phone` outside this function's own
--   migrations and the generated database.types.ts. Zero rows in pg_depend,
--   pg_policy, pg_constraint, pg_trigger, views, column defaults, other
--   function bodies, or cron.job. A security-definer reader over auth.users
--   with no caller is pure attack surface, so it goes.
--
-- public.place_enrich_events_latest(uuid[])
--   Added 20260822204229_place_enrich_events_latest_rpc.sql as the read path
--   behind pulseHighWater / pulseBlockedAt (_shared/pulse-pieces.ts), which
--   recomputed the enrichment meter from public.place_enrichment_events on
--   every read. MESITA-1249
--   (20260824004646_place_enrichment_state_map.sql) superseded exactly that:
--   it materialized this RPC's OUTPUT onto `places.enrichment`, and the
--   write side (pulse-report.ts's reportPulsePieces) keeps it current. The
--   RPC was left standing and has been orphaned since. pulse-pieces.ts no
--   longer calls it, nothing else does, and it appears in no catalog
--   dependency of any kind. It survived one incidental edit
--   (20260906000000_status_columns_become_state.sql renamed its `status`
--   output column to `state`), which is churn on a dead object, not a sign
--   of life.
--
-- ── LEFT IN PLACE, AND WHY ────────────────────────────────────────────────
--
-- public.is_place_member(p_project_id uuid) and public.is_super_admin()
--   NOT DEAD. Both are load-bearing in NINE live RLS policies on
--   storage.objects: place-images, menu-images and menu-pdfs each carry
--   member_or_admin insert / update / delete, and every one of them reads
--   `is_super_admin() OR is_place_member(...)`. pg_depend confirms it, with
--   twelve normal ('n') dependency rows per function. A `drop function`
--   would be refused outright, and a `drop ... cascade` would silently
--   delete those storage policies and open all three buckets.
--   is_place_member is additionally pinned by a pgTAP assertion in
--   tests/database/schema_invariants.test.sql, which requires it to exist by
--   name.
--   The `p_project_id` parameter name IS legacy: 20260908053644
--   (projects->places, MESITA-1590) renamed the function from
--   is_project_member but left its argument carrying the old entity's name.
--   That is a cosmetic wart on a live function, not evidence the function is
--   dead. Renaming the parameter is a separate change, and not a free one:
--   the name is part of the PostgREST RPC signature.
--   MESITA-1721 separately tightens EXECUTE on both of these. This migration
--   deliberately neither references nor re-grants them, so the two are
--   order-independent.
--
-- public.reservation_call_counters and
-- public.bump_reservation_call_counter(pid uuid)
--   NOT DEAD, and the most dangerous of the six to have dropped. The table
--   is the per-place daily venue-call meter, the abuse guard added by
--   20260804043722_reservation_run_discipline.sql. It is actively enforced
--   at two points in supabase-edgefunc-reservation-call/index.ts, via that
--   file's bumpPlaceCalls(): once on the place-notice path and once on the
--   booking-intent path. Both compare the returned count against
--   input.placeCallCap and, on breach, defer the call by six hours instead
--   of dialing. bump_reservation_call_counter is on the whitelist of RPC
--   names EF source actually calls.
--   The reservation retry ladder DOES need it, contrary to the issue's
--   premise: supabase-cron-reservation-retries/index.ts invokes
--   "supabase-edgefunc-reservation-call", which is the very EF that bumps
--   the meter, so every retry-driven call is metered through this table.
--   The failure mode is quiet, which is what makes it worth spelling out:
--   bumpPlaceCalls swallows RPC errors and returns null, and both cap checks
--   are guarded by `!== null`. Dropping these would not raise anything. It
--   would just disable the daily call cap permanently while the logs filled
--   with a counter error nobody reads, and Mesita would keep dialing venues
--   past the limit.
--
-- Nothing else in this migration. No grants, no policy edits, no ledger
-- reconciliation.

-- ── The drops ─────────────────────────────────────────────────────────────
--
-- `if exists` on both: this migration must be replayable, and must not care
-- whether MESITA-1721's grant tightening landed before or after it.

drop function if exists public.find_user_id_by_phone(text);

drop function if exists public.place_enrich_events_latest(uuid[]);

-- ── Post-flight ───────────────────────────────────────────────────────────
--
-- Assert both directions. The first two checks are this migration's own
-- work. The last four are the guard that matters: if a future edit ever
-- turns these drops into a cascade, or widens this file back to the issue's
-- original six, the storage-policy helpers vanish and all three buckets
-- open, or the reservation call cap goes dark. Fail the migration instead.

do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'find_user_id_by_phone') then
    raise exception 'find_user_id_by_phone still present after drop';
  end if;

  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'place_enrich_events_latest') then
    raise exception 'place_enrich_events_latest still present after drop';
  end if;

  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_place_member') then
    raise exception 'is_place_member was dropped — storage RLS policies depend on it';
  end if;

  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_super_admin') then
    raise exception 'is_super_admin was dropped — storage RLS policies depend on it';
  end if;

  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'reservation_call_counters') then
    raise exception 'reservation_call_counters was dropped — the reservation call cap needs it';
  end if;

  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'bump_reservation_call_counter') then
    raise exception 'bump_reservation_call_counter was dropped — the reservation-call EF calls it';
  end if;
end $$;

notify pgrst, 'reload schema';

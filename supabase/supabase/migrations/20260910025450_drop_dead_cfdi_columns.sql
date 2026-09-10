-- Drop the three dead CFDI columns from public.places (MESITA-1722).
--
-- places.cfdi_rfc / cfdi_razon_social / cfdi_cp were written by exactly one
-- thing: business-web-update-cfdi, an Edge Function that has been ACTIVE on
-- the singleton project since 2026-08-23 with NO source in this repo and no
-- git history anywhere — a leftover from the pre-monorepo standalone repos
-- that was never undeployed. Its verbatim source is archived at
-- retired/edge-functions/business-web-update-cfdi/index.ts, because git holds
-- no other copy of it.
--
-- That writer had already stopped working. Its bundle froze at its 2026-08-23
-- deploy, so it still writes `public.projects`, which MESITA-1590 renamed to
-- `public.places` — every call has been a 42P01 since. Nothing has written
-- these columns in that window, and all three are 0 non-null across the whole
-- table today.
--
-- Nothing reads them either. No Edge Function selects them: the only repo
-- mentions were the write surface in _shared/place-doc.ts and one entry in
-- business-web-get-place's FORBIDDEN_COLUMNS deny-list, both removed in the
-- same commit as this migration. They were never projected through `profiles`
-- — Wave 0 (20260824235205) closed client SELECT on them and 20260908175831
-- keeps it closed — and no view or matview depends on them, so this is a
-- plain drop and not a view rebuild.
--
-- HOW THEY GOT HERE. The columns were created cloud-side by the standalone
-- repo, not by any repo migration. 20260825001000 back-filled them into the
-- ledger with IF NOT EXISTS so local replay would stop 42703-ing the Wave 0
-- pins, and that same migration dropped `refund_requests`, the table the two
-- other ghost EFs read. This closes the rest of that attic.
--
-- The three CHECK constraints (places_cfdi_rfc_shape, places_cfdi_cp_shape,
-- places_cfdi_razon_social_len) and the column-level REVOKEs go with the
-- columns automatically — a dropped column takes its own constraints and
-- grants with it. Named here so a reader is not left hunting for them, and
-- asserted below. The historical migrations that created them (20260823092128,
-- 20260825001000) are an applied ledger and are left exactly as they stand.

alter table public.places
  drop column if exists cfdi_rfc,
  drop column if exists cfdi_razon_social,
  drop column if exists cfdi_cp;

-- ── Post-flight ──────────────────────────────────────────────────────────

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'places'
       and column_name in ('cfdi_rfc', 'cfdi_razon_social', 'cfdi_cp')
  ) then
    raise exception 'a CFDI column survived the drop on public.places';
  end if;

  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.places'::regclass
       and conname in (
         'places_cfdi_rfc_shape',
         'places_cfdi_cp_shape',
         'places_cfdi_razon_social_len'
       )
  ) then
    raise exception 'a CFDI check constraint outlived its column on public.places';
  end if;
end $$;

notify pgrst, 'reload schema';

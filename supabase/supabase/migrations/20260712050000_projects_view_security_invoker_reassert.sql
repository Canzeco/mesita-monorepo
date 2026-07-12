-- Re-assert SECURITY INVOKER on public.projects_view (clears advisor
-- 0010_security_definer_view) — MESITA-599, supersedes the reverted flip in
-- 20260712035218.
--
-- WHY: consumer-web-list-places reads projects_view with the ANON client and
-- relies on base-table RLS as "the single source of truth for what consumers
-- see." A SECURITY DEFINER view runs as its owner and BYPASSES that RLS, so
-- non-public rows (status not active/lead, or a non-browsable content_status)
-- would leak into the public catalog. Running the view as the CALLER
-- (invoker) makes the existing public-visible policies actually enforce.
--
-- The earlier flip (20260712035218) was clobbered when 20260712040000
-- recreated the view `with (security_invoker = false)`. This migration lands
-- AFTER that recreate so it sticks.
--
-- INVARIANT: any future `create or replace view public.projects_view` MUST
-- include `with (security_invoker = true)`, or it silently reopens this leak.
--
-- Service-role EFs (admin/business) bypass RLS and still see every row.

-- Public SELECT on projects — active/lead + any browsable content_status
-- (keeps places visible while enrichment is in flight). Idempotent: these
-- policies live only on prod today (applied out-of-band by 035218), so create
-- them here too for a self-consistent repo / fresh apply.
drop policy if exists units_select_public_visible on public.projects;
drop policy if exists projects_select_public_visible on public.projects;
create policy projects_select_public_visible on public.projects
  for select to anon, authenticated
  using (
    status = any (array['active'::public.project_status, 'lead'::public.project_status])
    and content_status = any (array[
      'ready'::public.content_gen_status,
      'generating'::public.content_gen_status,
      'queued'::public.content_gen_status,
      'failed'::public.content_gen_status
    ])
  );

-- Public SELECT on places — visible iff its project row is visible (the
-- subquery is itself gated by the projects policy under invoker).
drop policy if exists venues_select_public_visible on public.places;
drop policy if exists places_select_public_visible on public.places;
create policy places_select_public_visible on public.places
  for select to anon, authenticated
  using (exists (select 1 from public.projects u where u.id = places.id));

alter view public.projects_view set (security_invoker = true);

comment on view public.projects_view is
  'SECURITY INVOKER join of projects ⋈ places. Public reads follow projects_select_public_visible (active/lead + ready/generating/queued/failed); service-role EFs bypass RLS. INVARIANT: any create-or-replace MUST keep with (security_invoker = true).';

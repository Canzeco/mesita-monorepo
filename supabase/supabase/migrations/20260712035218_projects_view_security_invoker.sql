-- Clear security advisor 0010_security_definer_view on public.projects_view.
--
-- Previously the view was SECURITY DEFINER (security_invoker=false) as a
-- workaround so anon consumer EFs could read places still enriching
-- (content_status queued/generating). That bypassed base-table RLS and
-- exposed paused/archived/pending rows to anyone with the anon key.
--
-- Fix: run the view as the caller, and widen the public SELECT policy so
-- active/lead listings remain readable while enrichment is in flight.
-- Service-role EFs (admin/business) still see every row via bypass.

drop policy if exists units_select_public_visible on public.projects;

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

-- places_select_public_visible already gates on exists(projects) — with the
-- widened projects policy, enriching places stay readable through the join.

alter view public.projects_view set (security_invoker = true);

comment on view public.projects_view is
  'SECURITY INVOKER join of projects ⋈ places. Public reads follow projects_select_public_visible (active/lead + any content_status). EF writes via INSTEAD OF triggers (service role).';

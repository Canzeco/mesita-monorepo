-- Seven compat views that keep the consoles alive in the window between
-- `projects_becomes_places` (20260908053644, applied to the cloud) and
-- MESITA-1590 landing its code sweep.
--
-- WHAT BROKE. The rename is live in the cloud. `main` still names the old
-- tables at 98 call sites across 47 files, so PostgREST answers every one of
-- them with "Could not find the table 'public.projects' in the schema cache".
-- The business console's Places screen is the one that got reported; team,
-- invites, verifications, subscriptions and the Stripe webhook are all
-- equally dead and simply had not been clicked yet.
--
-- WHY A VIEW AND NOT THE CODE FIX. Every one of those 47 files is open and
-- being written right now in another session's worktree (MESITA-1590, 91
-- files uncommitted, last write one minute before this migration). Editing
-- them here collides across the whole sweep and one of the two sessions
-- loses its work. A view touches nothing that session owns and repairs all
-- 98 call sites at once instead of the single screen that got reported.
--
-- WHY IT IS SAFE. Each view is a bare `select *` over exactly one table with
-- no join, filter or aggregate, so Postgres treats it as auto-updatable:
-- insert, update, delete and `on conflict ... do update` (what PostgREST
-- emits for `.upsert()`) all pass through to the base table. That was probed
-- on this database before this migration was written, because the three
-- upsert call sites -- accept-invite, change-subscription, stripe-webhook --
-- would have failed silently otherwise.
--
-- `security_invoker = true` makes the base table's RLS apply as the calling
-- role, so a view is never a way around a policy. Grants mirror the base
-- tables exactly: service_role only, nothing for anon or authenticated,
-- matching the law that clients reach the DB through Edge Functions and
-- never directly.
--
-- WHY IT IS GUARDED. `20260908053644 projects_becomes_places` was applied
-- through MCP and has no repo file yet -- that file belongs to MESITA-1590's
-- PR, and writing it here would collide with the session holding it. So the
-- two places this migration runs disagree about the schema: the cloud has
-- `places`, while CI's `supabase start` replays repo migrations only and
-- still has `projects` as a table. Unguarded, this file fails CI outright.
--
-- The guard states the precondition instead of assuming it: build the shim
-- only where the rename has actually happened and the shim is not already
-- there. Live cloud -> already built, no-op. CI replay -> rename absent,
-- no-op. A future replay that includes MESITA-1590's migration -> builds.
-- The same file is correct in all three, which is what makes it safe to
-- carry until the sweep lands.
--
-- WHAT THIS IS NOT. It is not the rename finishing. A view freezes its
-- column list at creation, so a column added to a base table after this
-- point is invisible through the old name. That is fine for a shim measured
-- in hours and is the reason it should not outlive MESITA-1590.
--
-- HOW IT ENDS. When MESITA-1590 lands its sweep, drop all seven. They exist
-- to buy that session the time to finish without an outage running against it.

do $$
declare
  -- old name -> new name, the seven the rename moved.
  pairs text[][] := array[
    ['projects',              'places'],
    ['project_members',       'place_members'],
    ['project_invites',       'place_invites'],
    ['project_plans',         'place_plans'],
    ['project_strikes',       'place_strikes'],
    ['project_subscriptions', 'place_subscriptions'],
    ['project_verifications', 'place_verifications']
  ];
  old_name text;
  new_name text;
begin
  if to_regclass('public.places') is null then
    raise notice 'projects->places rename not present here; no shim to build';
    return;
  end if;
  if to_regclass('public.projects') is not null then
    raise notice 'public.projects already resolves; shim already built';
    return;
  end if;

  for i in 1 .. array_length(pairs, 1) loop
    old_name := pairs[i][1];
    new_name := pairs[i][2];

    execute format(
      'create view public.%I with (security_invoker = true) as select * from public.%I',
      old_name, new_name);
    execute format(
      'grant select, insert, update, delete on public.%I to service_role',
      old_name);
    execute format(
      'comment on view public.%I is %L',
      old_name,
      'TEMPORARY compat shim for MESITA-1590. Drop when the code sweep lands.');
  end loop;
end $$;

notify pgrst, 'reload schema';

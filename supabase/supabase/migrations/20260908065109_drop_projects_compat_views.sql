-- Drops the seven `projects`-family compat views MESITA-1663
-- (20260908062918) built to keep the consoles alive between the schema
-- rename landing (20260908053644) and this issue's code sweep landing.
-- That migration's own header says how it ends: "When MESITA-1590 lands
-- its sweep, drop all seven." This is that drop.
--
-- Every real caller now spells `places`/`place_*` directly (verified via
-- `grep` and this package's own `_shared/dropped-table-refs.test.ts`
-- guard, which flips in the same PR to assert the OLD names are what's
-- gone). Nothing needs the shim anymore, and a view freezes its column
-- list at creation — leaving it up would silently start lying the moment
-- a new column lands on `places` (etc.) that the shim never sees.
--
-- Guarded the same way MESITA-1663 guarded its own create: only drop a
-- name if it is actually the compat view (checked by relkind + the exact
-- comment that migration stamped on it), never a table. A fresh replay
-- that runs 1590's rename, then 1663's shim, then this drop, ends with
-- no `projects`-family object left at all — matching what a repo that
-- never needed the shim would look like.

do $$
declare
  names text[] := array[
    'projects',
    'project_members',
    'project_invites',
    'project_plans',
    'project_strikes',
    'project_subscriptions',
    'project_verifications'
  ];
  n text;
begin
  foreach n in array names loop
    if exists (
      select 1
        from pg_class c
       where c.relnamespace = 'public'::regnamespace
         and c.relname = n
         and c.relkind = 'v'
         and obj_description(c.oid) = 'TEMPORARY compat shim for MESITA-1590. Drop when the code sweep lands.'
    ) then
      execute format('drop view public.%I', n);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

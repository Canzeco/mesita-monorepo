-- Postgres carries constraint and index NAMES through ALTER TABLE ... RENAME.
-- The objects follow the table; their names do not. So after 20260818092000 the
-- schema was left with 66 constraints and 29 indexes named for tables that no
-- longer exist: tickets_pkey on visit_tickets, app_settings_atlas_* on
-- app_config, saved_places_consumer_id_project_id_key on favorites, and
-- tickets_check_subtotal_cents_check on a column now called
-- bill_subtotal_cents.
--
-- Nothing reads these names, so this is cosmetic. It is also exactly how the
-- fossils this whole audit was cleaning up got there in the first place: a
-- rename that stopped at the table.
--
-- Generated from the live catalog rather than hand-listed, so no name is
-- missed and re-running is a no-op.

do $fossils$
declare
  m record;
  r record;
  new_name text;
begin
  -- old prefix -> new prefix, longest first so account_invites is not
  -- swallowed by accounts.
  for m in
    select * from (values
      ('account_invites',            'project_invites'),
      ('consumer_pay_notifications', 'consumer_notifications'),
      ('consumer_mcp_tokens',        'consumer_connectors'),
      ('membership_strikes',         'project_strikes'),
      ('business_plans',             'project_plans'),
      ('saved_places',               'favorites'),
      ('app_settings',               'app_config'),
      ('reservations',               'reservation_tickets'),
      ('accounts',                   'managers'),
      ('tickets',                    'visit_tickets')
    ) as t(old_p, new_p)
    order by length(t.old_p) desc
  loop
    -- constraints first: renaming a pkey/unique constraint renames its
    -- backing index too, so the index pass below finds less to do.
    for r in
      select c.conname, c.conrelid::regclass::text as tbl
        from pg_constraint c
       where c.connamespace = 'public'::regnamespace
         and c.conname like m.old_p || '\_%'
    loop
      new_name := m.new_p || substring(r.conname from length(m.old_p) + 1);
      if not exists (
        select 1 from pg_constraint x
         where x.connamespace = 'public'::regnamespace and x.conname = new_name
      ) then
        execute format('alter table %s rename constraint %I to %I',
                       r.tbl, r.conname, new_name);
      end if;
    end loop;

    -- then any standalone index left over
    for r in
      select i.indexname
        from pg_indexes i
       where i.schemaname = 'public'
         and i.indexname like m.old_p || '\_%'
    loop
      new_name := m.new_p || substring(r.indexname from length(m.old_p) + 1);
      if to_regclass('public.' || quote_ident(new_name)) is null then
        execute format('alter index public.%I rename to %I', r.indexname, new_name);
      end if;
    end loop;
  end loop;
end
$fossils$;

-- The two CHECK constraints whose names also carried a renamed COLUMN.
-- The prefix pass above already moved the table half; these finish the job.
do $cols$
begin
  if exists (select 1 from pg_constraint
              where connamespace = 'public'::regnamespace
                and conname = 'visit_tickets_check_subtotal_cents_check') then
    alter table public.visit_tickets
      rename constraint visit_tickets_check_subtotal_cents_check
                     to visit_tickets_bill_subtotal_cents_check;
  end if;

  if exists (select 1 from pg_constraint
              where connamespace = 'public'::regnamespace
                and conname = 'reservation_tickets_guest_notify_check') then
    alter table public.reservation_tickets
      rename constraint reservation_tickets_guest_notify_check
                     to reservation_tickets_consumer_notify_check;
  end if;
end
$cols$;

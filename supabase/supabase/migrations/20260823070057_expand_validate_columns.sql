-- EXPAND (MESITA-1115, PR 1 of 3 under MESITA-1114).
--
-- Purely additive. Nothing is renamed, nothing is dropped, nothing is
-- user-visible. Every deployed Edge Function keeps reading the old columns and
-- keeps working unchanged. This exists so PR 2 can move the code without a
-- window where the schema and the deployed functions disagree.
--
--   new           mirrors               on
--   ticket_code   check_code            visit_tickets
--   staff_pin     check_pin             projects
--   require_bill  check_require_bill    projects
--
-- The table is visit_tickets, not tickets — renamed in the entity pass
-- (20260818092000_rename_entities.sql). The issue title predates that.

-- ── 1. Columns ──────────────────────────────────────────────────────────
alter table public.visit_tickets add column if not exists ticket_code text;

alter table public.projects add column if not exists staff_pin text;
alter table public.projects
  add column if not exists require_bill boolean not null default false;

-- ── 2. Backfill from the twin ───────────────────────────────────────────
-- No-op today (both tables hold 0 rows) but correct for any later state.
update public.visit_tickets
   set ticket_code = check_code
 where ticket_code is distinct from check_code;

update public.projects
   set staff_pin = check_pin,
       require_bill = check_require_bill
 where staff_pin is distinct from check_pin
    or require_bill is distinct from check_require_bill;

-- ── 3. Constraints, twinning the live ones exactly ──────────────────────
-- Verbatim twin of projects_check_pin_format as read from pg_constraint.
alter table public.projects
  drop constraint if exists projects_staff_pin_format;
alter table public.projects
  add constraint projects_staff_pin_format
  check (staff_pin is null or staff_pin ~ '^[0-9]{6}$');

-- Twin of visit_tickets_check_code_key, including its partial predicate.
create unique index if not exists visit_tickets_ticket_code_key
  on public.visit_tickets (ticket_code)
  where ticket_code is not null;

-- Deliberately NOT added: a 22-char base64url shape CHECK on ticket_code.
-- check_code carries no such constraint today, and a one-sided check would
-- break the sync below — a legacy write to check_code would propagate into
-- ticket_code and be rejected by a rule its twin never had to satisfy.
-- visit_tickets_one_open_check_per_consumer_place also stays on check_code:
-- the columns are in lockstep, so twinning it would double-enforce one rule.

-- ── 4. Bidirectional sync ───────────────────────────────────────────────
-- Bidirectional is the point. During PR 2 some deployed functions still write
-- the old name while the new ones write the new name, and both must stay true.
--
-- UPDATE: whichever column actually changed propagates to its twin.
-- INSERT: the two can disagree with no history to arbitrate, so the NEW name
-- wins when both are supplied and differ — the tree is migrating toward it.
create or replace function public.sync_project_validate_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.staff_pin is distinct from new.check_pin then
      if new.staff_pin is not null then
        new.check_pin := new.staff_pin;
      else
        new.staff_pin := new.check_pin;
      end if;
    end if;
    -- Both are NOT NULL DEFAULT false, so "which one was supplied" is not
    -- answerable on INSERT; OR them, which makes opting in win either way.
    if new.require_bill is distinct from new.check_require_bill then
      new.require_bill := new.require_bill or new.check_require_bill;
      new.check_require_bill := new.require_bill;
    end if;
  else
    if new.staff_pin is distinct from old.staff_pin then
      new.check_pin := new.staff_pin;
    elsif new.check_pin is distinct from old.check_pin then
      new.staff_pin := new.check_pin;
    end if;

    if new.require_bill is distinct from old.require_bill then
      new.check_require_bill := new.require_bill;
    elsif new.check_require_bill is distinct from old.check_require_bill then
      new.require_bill := new.check_require_bill;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.sync_visit_ticket_validate_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.ticket_code is distinct from new.check_code then
      if new.ticket_code is not null then
        new.check_code := new.ticket_code;
      else
        new.ticket_code := new.check_code;
      end if;
    end if;
  else
    if new.ticket_code is distinct from old.ticket_code then
      new.check_code := new.ticket_code;
    elsif new.check_code is distinct from old.check_code then
      new.ticket_code := new.check_code;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_project_validate_columns on public.projects;
create trigger sync_project_validate_columns
  before insert or update on public.projects
  for each row execute function public.sync_project_validate_columns();

drop trigger if exists sync_visit_ticket_validate_columns on public.visit_tickets;
create trigger sync_visit_ticket_validate_columns
  before insert or update on public.visit_tickets
  for each row execute function public.sync_visit_ticket_validate_columns();

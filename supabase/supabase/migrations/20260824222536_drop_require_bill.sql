-- MESITA-1095 — the bill is always guest-entered and always required.
-- A per-place switch is dead config (unenforced config = bug).
--
-- 1115 added require_bill as a twin of check_require_bill and synced them
-- in sync_project_validate_columns. Drop both columns and keep the trigger
-- for staff_pin / check_pin only.

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
  else
    if new.staff_pin is distinct from old.staff_pin then
      new.check_pin := new.staff_pin;
    elsif new.check_pin is distinct from old.check_pin then
      new.staff_pin := new.check_pin;
    end if;
  end if;
  return new;
end;
$$;

alter table public.projects drop column if exists require_bill;
alter table public.projects drop column if exists check_require_bill;

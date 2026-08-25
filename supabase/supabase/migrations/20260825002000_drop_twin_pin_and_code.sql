-- Twin columns. Keep check_pin / check_code. Drop staff_pin / ticket_code
-- and the sync triggers that copied them (20260823070057).

drop trigger if exists sync_project_validate_columns on public.projects;
drop trigger if exists sync_visit_ticket_validate_columns on public.visit_tickets;
drop function if exists public.sync_project_validate_columns();
drop function if exists public.sync_visit_ticket_validate_columns();

alter table public.projects drop column if exists staff_pin;
alter table public.visit_tickets drop column if exists ticket_code;

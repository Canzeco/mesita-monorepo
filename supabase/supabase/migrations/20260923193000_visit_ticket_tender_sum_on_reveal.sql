-- Enforce tender sum at ticket close (MESITA-1913).
--
-- MESITA-1910 moved the invariant into record_visit_tenders; once the four
-- closers record tenders before reveal, the table can refuse a close whose
-- rows do not sum to net due.

create or replace function public.visit_tickets_enforce_tender_sum_on_reveal()
returns trigger
language plpgsql
as $$
declare
  v_net integer;
  v_sum integer;
begin
  v_net := coalesce(new.approved_amount_due_cents, 0)
         - coalesce(new.credits_applied_cents, 0);

  select coalesce(sum(amount_cents), 0)
    into v_sum
    from public.visit_ticket_payments
   where ticket_id = new.id;

  if v_sum <> v_net then
    raise exception 'visit ticket tender sum must equal net amount due on reveal'
      using errcode = 'P0001', hint = 'tender_sum_mismatch';
  end if;

  return new;
end;
$$;

comment on function public.visit_tickets_enforce_tender_sum_on_reveal() is
  'Constraint trigger body: on transition into revealed, sum(visit_ticket_payments) must equal approved_amount_due_cents - credits_applied_cents. MESITA-1913.';

create constraint trigger visit_tickets_tender_sum_on_reveal
  after update of state on public.visit_tickets
  deferrable initially deferred
  for each row
  when (new.state = 'revealed' and old.state is distinct from 'revealed')
  execute function public.visit_tickets_enforce_tender_sum_on_reveal();

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'visit_tickets_tender_sum_on_reveal'
      and tgrelid = 'public.visit_tickets'::regclass
  ) then
    raise exception 'visit_tickets_tender_sum_on_reveal trigger missing after migration';
  end if;
end $$;

notify pgrst, 'reload schema';

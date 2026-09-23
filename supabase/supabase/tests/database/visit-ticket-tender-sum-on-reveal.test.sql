-- Constraint trigger: tender sum enforced on reveal (MESITA-1913).

begin;
select plan(3);

insert into auth.users (id) values ('cccccccc-0000-0000-0000-000000000001');
insert into public.consumers (id, code)
  values ('cccccccc-0000-0000-0000-000000000001', '9999-1913');

insert into public.place_profiles (id, google_name)
  values ('cccccccc-0000-0000-0000-000000000003', 'pgTAP reveal tender');
insert into public.places (id, slug)
  values ('cccccccc-0000-0000-0000-000000000003', 'pgtap-reveal-tender');

insert into public.visit_tickets (
  id, place_id, consumer_id, opened_by, state,
  approved_amount_due_cents, credits_applied_cents
) values
  ('cccccccc-0000-0000-0000-00000000000a', 'cccccccc-0000-0000-0000-000000000003',
   'cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   'paying', 800, 0),
  ('cccccccc-0000-0000-0000-00000000000b', 'cccccccc-0000-0000-0000-000000000003',
   'cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   'paying', 500, 0);

-- Happy path: tenders recorded, then reveal commits.
select is(
  ((public.record_visit_tenders('cccccccc-0000-0000-0000-00000000000a',
    '[{"method":"cash","amount_cents":800}]'::jsonb))->>'ok')::boolean,
  true,
  'tenders recorded before reveal');

update public.visit_tickets
   set state = 'revealed', revealed_at = now(), paid_at = now()
 where id = 'cccccccc-0000-0000-0000-00000000000a';

select is(
  (select state from public.visit_tickets where id = 'cccccccc-0000-0000-0000-00000000000a'),
  'revealed',
  'reveal succeeds when tender sum matches net due');

-- Refusal: reveal without matching tenders (deferrable trigger → force immediate).
select throws_ok(
  $$
    set constraints visit_tickets_tender_sum_on_reveal immediate;
    update public.visit_tickets
       set state = 'revealed', revealed_at = now(), paid_at = now()
     where id = 'cccccccc-0000-0000-0000-00000000000b'
  $$,
  'P0001',
  'visit ticket tender sum must equal net amount due on reveal',
  'reveal without tenders is refused at commit');

select * from finish();
rollback;

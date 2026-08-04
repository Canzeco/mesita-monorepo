-- v3b (MESITA-850): the bill goes optional, so recorded amounts become
-- mixed-provenance. Track WHO supplied the peso figure so Performance can
-- label a guest-typed total instead of presenting it as place-confirmed.
-- NULL = no amount recorded ("none").
alter table public.tickets
  add column if not exists bill_source text
  check (bill_source in ('business', 'consumer'));

comment on column public.tickets.bill_source is
  'Provenance of the recorded bill amount: business (staff entered at the check page), consumer (guest typed after close), NULL = no amount recorded (MESITA-850).';

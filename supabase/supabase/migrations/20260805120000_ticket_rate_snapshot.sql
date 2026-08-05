-- MESITA-912: snapshot place promo rates on tickets at creation so mid-visit
-- strategy switches do not re-price open tickets.

alter table public.tickets
  add column if not exists welcome_free_rate smallint,
  add column if not exists welcome_premium_rate smallint,
  add column if not exists free_rate smallint,
  add column if not exists premium_rate smallint,
  add column if not exists rates_snapshotted_at timestamptz;

comment on column public.tickets.welcome_free_rate is
  'Promo rate snapshot at ticket creation (MESITA-912). Billing prefers these over live place rates.';
comment on column public.tickets.welcome_premium_rate is
  'Promo rate snapshot at ticket creation (MESITA-912).';
comment on column public.tickets.free_rate is
  'Promo rate snapshot at ticket creation (MESITA-912).';
comment on column public.tickets.premium_rate is
  'Promo rate snapshot at ticket creation (MESITA-912).';
comment on column public.tickets.rates_snapshotted_at is
  'Set at ticket creation when the four rate columns are snapshotted. NULL = legacy row (bill from live place rates).';

notify pgrst, 'reload schema';

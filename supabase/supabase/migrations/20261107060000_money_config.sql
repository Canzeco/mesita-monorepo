-- MESITA-3303 — W1b: the kill switch for selling vouchers.
--
-- app_config.money_config is the money section's blob; its one key today,
-- buying_paused, stops every voucher sale at once (consumer-web-list-vouchers
-- reports every voucher unavailable with reason `paused`, consumer-web-buy-
-- voucher refuses 409 `paused`). Written by the admin console from W3
-- (MESITA-3307, the `money` section); until then an operator flips it with
-- one SQL update under an issue. Default off, so the column lands with no
-- behaviour change through the migration-before-functions window.

alter table public.app_config
  add column money_config jsonb not null default '{"buying_paused": false}'::jsonb;

comment on column public.app_config.money_config is
  'MESITA-3303: the money section. buying_paused (boolean): every voucher sale refused while true. Read by the consumer money EFs; written by the admin console (W3).';

-- The live table holds one row; a fresh database (pgTAP) holds none until the
-- console writes one, and no row reads as not paused (money-config.ts).
do $$
begin
  if exists (select 1 from public.app_config where money_config ->> 'buying_paused' is distinct from 'false') then
    raise exception 'money_config did not land with buying_paused false';
  end if;
end $$;

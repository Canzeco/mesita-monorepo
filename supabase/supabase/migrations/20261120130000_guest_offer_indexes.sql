-- MESITA-4208: readGuestBlocks filters wallet_purchases and wallet_payments
-- by (consumer_id, place_id). The tables are small today; PostgREST still
-- caps a filter at 1000 rows, so the pair needs an index before they grow.

create index if not exists wallet_purchases_consumer_place_idx
  on public.wallet_purchases (consumer_id, place_id);

create index if not exists wallet_payments_consumer_place_idx
  on public.wallet_payments (consumer_id, place_id);

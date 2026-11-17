-- MESITA-4277 — the guest's card is a Loyalty Card, not a House Card.
--
-- Pato (2026-11-17): "remember its not house card. its loyalty card …
-- across all the frontend and backend it must be called Loyalty Card".
-- Step 1 of 3 (Pato picked "three safe steps"): this renames the pin table
-- wallet_house_cards (MESITA-3582) to wallet_loyalty_cards, with its key,
-- foreign keys and index.
--
-- THE BRIDGE. Supabase's integration applies this migration minutes before
-- it redeploys the Edge Functions, and a renamed function folder is a new
-- function: the old consumer-web-add-house-card / -remove-house-card and the
-- old get-wallet / list-vouchers stay deployed with code that names
-- wallet_house_cards. A plain view under the old name (auto-updatable, so
-- their select / upsert / delete keep working) carries them until the new
-- functions answer. EF-only like the table: no client role holds anything on
-- it. MESITA-4283 drops it once prod serves only the new names.

alter table public.wallet_house_cards rename to wallet_loyalty_cards;
alter table public.wallet_loyalty_cards rename constraint wallet_house_cards_pkey to wallet_loyalty_cards_pkey;
alter table public.wallet_loyalty_cards rename constraint wallet_house_cards_consumer_id_fkey to wallet_loyalty_cards_consumer_id_fkey;
alter table public.wallet_loyalty_cards rename constraint wallet_house_cards_place_id_fkey to wallet_loyalty_cards_place_id_fkey;
alter index public.wallet_house_cards_place_idx rename to wallet_loyalty_cards_place_idx;

comment on table public.wallet_loyalty_cards is
  'MESITA-3582 Wallet (renamed from wallet_house_cards, MESITA-4277): a Loyalty Card the guest pinned by hand (the place screen''s "Add card to Wallet"), shown as a $0 card until they hold credit there. One row per guest and place. EF-only.';

create view public.wallet_house_cards
  with (security_invoker = true)
  as select consumer_id, place_id, added_at from public.wallet_loyalty_cards;
revoke all on table public.wallet_house_cards from public, anon, authenticated;
grant all on table public.wallet_house_cards to service_role;

comment on view public.wallet_house_cards is
  'MESITA-4277 bridge: the old name of wallet_loyalty_cards for Edge Functions deployed before the rename. Dropped by MESITA-4283.';

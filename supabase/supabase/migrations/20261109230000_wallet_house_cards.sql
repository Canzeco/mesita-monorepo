-- MESITA-3582 — a guest pins a place's House Card to their Wallet with $0.
--
-- Pato (2026-11-09): "you can directly add the card to your wallet from
-- there ... the House Card can be added to your wallet either manually or
-- automatically when buying or receiving House Credits from that place."
--
-- Automatic stays as it is: a card appears once the guest holds entries at
-- the place (wallet_entries, consumer-web-get-wallet). Manual is this table:
-- one row per guest and place, written only by consumer-web-add-house-card
-- and deleted only by consumer-web-remove-house-card. A pin is a Wallet
-- preference, not money: no amount, no livemode; a pinned place with no
-- entries reads as a $0 card.
--
-- Additive: one new table. Nothing reads it until the EFs deploy.

create table public.wallet_house_cards (
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (consumer_id, place_id)
);

create index wallet_house_cards_place_idx on public.wallet_house_cards (place_id);

alter table public.wallet_house_cards enable row level security;
revoke all on table public.wallet_house_cards from public, anon, authenticated;
grant all on table public.wallet_house_cards to service_role;

comment on table public.wallet_house_cards is
  'MESITA-3582 Wallet: a House Card the guest pinned by hand (the place screen''s "Add card to Wallet"), shown as a $0 card until they hold credit there. One row per guest and place. EF-only.';

-- MESITA-3589 — the Place states of Notion Main §10, functional on the
-- Stripe sandbox (Pato, 2026-11-09: "WE ARE GOING TO MAKE ALL THIS
-- FUNCTIONAL ... REMEMBER THAT CONTRACT IS INDEPENDENT FROM STRIPE CONNECT").
--
-- 1. house_credits_contracts: the House Credits Contract a place signs with
--    Mesita. Independent of Stripe: no column here names an account. A place
--    has at most one live contract (ended_at null). terms_version names the
--    text the owner agreed to; the text is a placeholder until a lawyer
--    writes it ('draft-2026-11').
-- 2. place_payment_settings gains the owner's switches the states need:
--      house_credits      House Credits On/Off. On only while a live
--                         contract exists (trigger below). Off stops NEW
--                         credits only: credit a guest already holds stays
--                         spendable (no RPC reads this column).
--      cash_payments      Cash Payments On/Off (the waiter confirms a bill
--                         paid outside with Received). The EF refuses On
--                         without the place code.
--      card_cashback_bps  Mesita Payments Cashback: null = Off, else 100..2000
--                         (1%..20%). Default when turned on: 500.
--      cash_cashback_bps  Cash Payments Cashback: null = Off, else 100..2000.
--                         Default when turned on: 200. Never above the card
--                         rate when both are set.
--    The six voucher switches (Mesita Prepayments) need House Credits On.
--    `cashback` is no longer read by any EF; a follow-up drops it once the
--    EFs that named it are gone from the cloud (drop-before-deploy would
--    break the old EFs for the ~5 minutes between migration and redeploy).
-- 3. The old `cashback` switch moves into the two rates (5% card, 2% cash).
--    No place has a signed contract yet, so House Credits starts Off
--    everywhere, and voucher switches on a place without House Credits go
--    Off (they could not sell without it). Today that is one test place.
--
-- The ledger stays rail- and setting-blind: the EFs read these columns at
-- payment time and pass the rate into the RPCs, which snapshot it on the row
-- (cashback_bps, outside_cashback_bps). The tip and the credit part never
-- earn: the RPCs only apply the rate to the card part and the cash bill part.

-- ── 1. The contract ────────────────────────────────────────────────────────

create table public.house_credits_contracts (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  -- No foreign key on purpose: the record of who signed outlives the
  -- account (deleting a user must neither fail nor erase the signature).
  signed_by uuid not null,
  signed_by_email text,
  signed_at timestamptz not null default now(),
  terms_version text not null check (length(terms_version) between 1 and 64),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= signed_at)
);

create unique index house_credits_contracts_one_live
  on public.house_credits_contracts (place_id) where ended_at is null;
create index house_credits_contracts_place on public.house_credits_contracts (place_id, signed_at desc);

alter table public.house_credits_contracts enable row level security;
revoke all on table public.house_credits_contracts from public, anon, authenticated;
grant all on table public.house_credits_contracts to service_role;

comment on table public.house_credits_contracts is
  'MESITA-3589: the House Credits Contract a place signs with Mesita (Main §10). Independent of Stripe Connect. At most one live contract per place (ended_at null). terms_version names the text agreed to; draft-2026-11 is a placeholder until the lawyer''s text. EF-only.';

-- ── 2. The switches ────────────────────────────────────────────────────────

alter table public.place_payment_settings
  add column house_credits boolean not null default false,
  add column cash_payments boolean not null default false,
  add column card_cashback_bps integer
    check (card_cashback_bps is null or card_cashback_bps between 100 and 2000),
  add column cash_cashback_bps integer
    check (cash_cashback_bps is null or cash_cashback_bps between 100 and 2000);

-- ── 3. Carry the old switch over (before the guards exist) ────────────────

update public.place_payment_settings
   set card_cashback_bps = case when cashback then 500 end,
       cash_cashback_bps = case when cashback then 200 end;

update public.place_payment_settings
   set voucher_200 = false, voucher_1000 = false, voucher_5000 = false,
       voucher_welcome = false, voucher_story = false, voucher_vip = false
 where not house_credits;

-- ── 4. The guards ──────────────────────────────────────────────────────────

alter table public.place_payment_settings
  add constraint place_payment_settings_cash_le_card
    check (cash_cashback_bps is null or card_cashback_bps is null or cash_cashback_bps <= card_cashback_bps),
  add constraint place_payment_settings_prepay_needs_house_credits
    check (house_credits or not (voucher_200 or voucher_1000 or voucher_5000
                                 or voucher_welcome or voucher_story or voucher_vip));

-- House Credits On needs a live, signed contract.
create or replace function public.place_payment_settings_house_credits_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.house_credits and not exists (
    select 1 from public.house_credits_contracts c
     where c.place_id = new.place_id and c.ended_at is null
  ) then
    raise exception 'house_credits_unsigned: House Credits needs a signed House Credits Contract'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

create trigger place_payment_settings_house_credits_guard
  before insert or update of house_credits on public.place_payment_settings
  for each row execute function public.place_payment_settings_house_credits_guard();

-- Ending a contract turns House Credits (and so Prepayments) Off with it.
-- Credit guests already hold is untouched: the ledger never reads this.
create or replace function public.house_credits_contracts_end()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.ended_at is not null and old.ended_at is null then
    update public.place_payment_settings
       set house_credits = false,
           voucher_200 = false, voucher_1000 = false, voucher_5000 = false,
           voucher_welcome = false, voucher_story = false, voucher_vip = false,
           updated_at = now()
     where place_id = new.place_id;
  end if;
  return new;
end;
$function$;

create trigger house_credits_contracts_end
  after update of ended_at on public.house_credits_contracts
  for each row execute function public.house_credits_contracts_end();

revoke all on function public.place_payment_settings_house_credits_guard() from public, anon, authenticated;
revoke all on function public.house_credits_contracts_end() from public, anon, authenticated;

comment on column public.place_payment_settings.house_credits is
  'MESITA-3589: House Credits On/Off (Main §10). On only while a live house_credits_contracts row exists. Off stops new credits; credit guests hold stays spendable.';
comment on column public.place_payment_settings.cash_payments is
  'MESITA-3589: Cash Payments On/Off: the waiter confirms a bill paid outside with Received. The EF refuses On without the place code.';
comment on column public.place_payment_settings.card_cashback_bps is
  'MESITA-3589: Mesita Payments Cashback, null = Off, else 100..2000 bps on the card part of the bill only (never the tip or the credit part). Needs House Credits.';
comment on column public.place_payment_settings.cash_cashback_bps is
  'MESITA-3589: Cash Payments Cashback, null = Off, else 100..2000 bps on the cash bill part only, never above card_cashback_bps. Needs House Credits.';
comment on column public.place_payment_settings.cashback is
  'Retired by MESITA-3589 (moved into card_cashback_bps / cash_cashback_bps); no EF reads it; a follow-up drops it.';

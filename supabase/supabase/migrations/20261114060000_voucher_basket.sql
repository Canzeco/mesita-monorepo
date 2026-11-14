-- MESITA-3841 — the voucher basket (Pato: "ENABLE TO SELECT MULTIPLE
-- Vouchers"; then "One charge, basket").
--
-- A guest picks several vouchers on the Offers page (2× Small, 1× Big, …)
-- and pays them with ONE Stripe PaymentIntent on the place's account, all or
-- nothing. The ledger stays one wallet_purchases row per voucher unit, so
-- the credit, the bonus, the cashback, the refund and the fee rules of
-- wallet_credit_purchase / wallet_refund_purchase stay per row, unchanged.
--
--   the lead       the basket's first row: carries the tap's request_id and
--                  is metadata.purchase_id on the PaymentIntent.
--   a follower     every other unit: basket_lead_id names the lead,
--                  request_id is null, and once the PaymentIntent exists it
--                  stores the same stripe_payment_intent_id as the lead.
--
-- stripe_payment_intent_id stops being unique across the table: it is
-- unique among leads and single purchases (basket_lead_id is null), and a
-- follower's PaymentIntent must be its own lead's (a composite foreign key
-- onto (id, stripe_payment_intent_id)). So two rows share one PaymentIntent
-- only when one is the lead and the other points to it.

-- ── 1. The column ──────────────────────────────────────────────────────────
alter table public.wallet_purchases
  add column if not exists basket_lead_id uuid
    constraint wallet_purchases_basket_lead_fk references public.wallet_purchases (id);

alter table public.wallet_purchases
  add constraint wallet_purchases_basket_not_self_chk check (basket_lead_id is null or basket_lead_id <> id),
  add constraint wallet_purchases_basket_follower_no_request_chk check (basket_lead_id is null or request_id is null);

create index if not exists wallet_purchases_basket_lead_idx
  on public.wallet_purchases (basket_lead_id) where basket_lead_id is not null;

comment on column public.wallet_purchases.basket_lead_id is
  'MESITA-3841: null on a single purchase and on a basket''s lead; on a follower, the lead''s id. A basket is one PaymentIntent for the sum of its rows: every row stores it, metadata.purchase_id is the lead. A follower has no request_id (the lead carries the tap''s).';

-- ── 2. The PaymentIntent: unique among leads, shared by a lead's followers ─
-- The original unique constraint was unnamed in 20261102001000, so it is
-- found by its definition.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.wallet_purchases'::regclass
       and contype = 'u'
       and pg_get_constraintdef(oid) = 'UNIQUE (stripe_payment_intent_id)'
  loop
    execute format('alter table public.wallet_purchases drop constraint %I', c.conname);
  end loop;
end $$;

create unique index if not exists wallet_purchases_payment_intent_lead_idx
  on public.wallet_purchases (stripe_payment_intent_id)
  where basket_lead_id is null and stripe_payment_intent_id is not null;

-- The target of the follower's composite key (id is already unique, so this
-- pair is too).
alter table public.wallet_purchases
  add constraint wallet_purchases_id_payment_intent_key unique (id, stripe_payment_intent_id);

-- A follower that names a PaymentIntent names its lead's. MATCH SIMPLE: a
-- follower still opening (no PaymentIntent yet) is not checked.
alter table public.wallet_purchases
  add constraint wallet_purchases_basket_payment_intent_fk
    foreign key (basket_lead_id, stripe_payment_intent_id)
    references public.wallet_purchases (id, stripe_payment_intent_id);

comment on index public.wallet_purchases_payment_intent_lead_idx is
  'MESITA-3841: one PaymentIntent per single purchase or basket lead (it replaced the column''s unique constraint); a basket''s followers share their lead''s (wallet_purchases_basket_payment_intent_fk).';

do $$
begin
  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.wallet_purchases'::regclass
       and contype = 'u'
       and pg_get_constraintdef(oid) = 'UNIQUE (stripe_payment_intent_id)'
  ) then
    raise exception 'the PaymentIntent unique constraint is still on wallet_purchases';
  end if;
end $$;

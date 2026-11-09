-- MESITA-3461: fee billing. Charge model d5a (the /autoplan gate of
-- 2026-11-08): a voucher purchase and the card part of a payment are direct
-- charges on the place's connected account with NO application fee; Mesita's
-- 5% is billed to the place apart, on a Stripe invoice from Mesita's own
-- account, and an unpaid invoice turns the place's card payments off
-- (fee_hold) until it is paid.
--
--   1. What a row owes. application_fee_cents keeps its name (renaming a
--      read column breaks every reader) and now means Mesita's fee on the
--      charge, whoever collects it. fee_collected says who: 'application_fee'
--      (every row before today: Stripe took it at the charge) or 'invoice'
--      (every row from today: billed here). fee_billed_cents is how much of
--      it an invoice already claimed.
--   2. The refund RPCs write fee_refunded_cents themselves: the refunded
--      share of the card part owes no fee (all of it on a full refund), the
--      same for a lost dispute. wallet_note_fee_refund is dropped: no charge
--      carries an application fee any more.
--   3. place_fee_invoices + place_fee_lines: one invoice per claim; a line
--      per row it moved, the delta (negative when a refund came after the
--      row was billed: the next invoice nets it).
--   4. place_payment_accounts: fee_hold (+ fee_hold_at) and fee_customer_id
--      (the place's customer on Mesita's account, per the row's livemode).
--   5. place_fee_claim: moves what is owed onto a draft invoice when it is
--      due (owed >= the threshold, or the oldest unbilled row is older than
--      the period) and at least Stripe's minimum.
--   6. place_fee_invoice_set: the invoice's state as Stripe says it, then the
--      hold recomputed. It never reads or writes place_payment_settings: an
--      owner's own Mesita Pay switch survives paying the invoice.
--   7. The cron, every hour: supabase-cron-bill-fees.

-- ── 1. What a row owes ─────────────────────────────────────────────────────
alter table public.wallet_payments
  add column if not exists fee_collected text not null default 'invoice',
  add column if not exists fee_billed_cents integer not null default 0;
alter table public.wallet_purchases
  add column if not exists fee_collected text not null default 'invoice',
  add column if not exists fee_billed_cents integer not null default 0;

-- Every row written before this migration was charged with Stripe's
-- application fee: it is never billed again.
update public.wallet_payments set fee_collected = 'application_fee' where fee_collected = 'invoice' and created_at < now();
update public.wallet_purchases set fee_collected = 'application_fee' where fee_collected = 'invoice' and created_at < now();

alter table public.wallet_payments drop constraint if exists wallet_payments_fee_collected_chk;
alter table public.wallet_payments add constraint wallet_payments_fee_collected_chk
  check (fee_collected in ('application_fee', 'invoice'));
alter table public.wallet_purchases drop constraint if exists wallet_purchases_fee_collected_chk;
alter table public.wallet_purchases add constraint wallet_purchases_fee_collected_chk
  check (fee_collected in ('application_fee', 'invoice'));

comment on column public.wallet_payments.application_fee_cents is
  'Mesita''s fee on the card part (5%, MESITA_FEE_BPS_PAYMENT), never on the tip. Collected as Stripe''s application fee before MESITA-3461 (fee_collected = application_fee), billed on a place_fee_invoices invoice since (fee_collected = invoice).';
comment on column public.wallet_purchases.application_fee_cents is
  'Mesita''s fee on the voucher (5%, MESITA_FEE_BPS_VOUCHER). Collected as Stripe''s application fee before MESITA-3461 (fee_collected = application_fee), billed on a place_fee_invoices invoice since (fee_collected = invoice).';
comment on column public.wallet_payments.fee_collected is
  'MESITA-3461: who collects application_fee_cents: application_fee (Stripe, at the charge; rows before 2026-11-09) or invoice (Mesita bills the place).';
comment on column public.wallet_purchases.fee_collected is
  'MESITA-3461: who collects application_fee_cents: application_fee (Stripe, at the charge; rows before 2026-11-09) or invoice (Mesita bills the place).';
comment on column public.wallet_payments.fee_billed_cents is
  'MESITA-3461: how much of (application_fee_cents - fee_refunded_cents) invoices have claimed; the difference is what the next invoice bills (negative after a late refund: a credit).';
comment on column public.wallet_purchases.fee_billed_cents is
  'MESITA-3461: how much of (application_fee_cents - fee_refunded_cents) invoices have claimed; the difference is what the next invoice bills (negative after a late refund: a credit).';
comment on column public.wallet_payments.fee_refunded_cents is
  'The share of application_fee_cents that followed refunds and lost disputes: the refunded share of the card part owes no fee. Written by wallet_refund_payment since MESITA-3461.';
comment on column public.wallet_purchases.fee_refunded_cents is
  'The share of application_fee_cents that followed refunds and lost disputes. Written by wallet_refund_purchase since MESITA-3461.';

-- ── 2. The refund RPCs follow the fee ──────────────────────────────────────
drop function if exists public.wallet_note_fee_refund(text, uuid, integer);

create or replace function public.wallet_refund_payment(p_payment_id uuid, p_amount_refunded integer, p_reason text default 'refund')
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_payments;
  v_ceiling integer;
  v_new_refunded integer;
  v_delta integer;
  v_card_refunded integer;
  v_tip_refunded integer;
  v_target integer := 0;
  v_done integer;
  v_to_reverse integer := 0;
  v_unspent integer;
  v_reversed integer := 0;
  v_status text;
  v_fee_refunded integer;
begin
  if p_amount_refunded is null or p_amount_refunded < 0 then
    return jsonb_build_object('ok', false, 'code', 'bad_amount');
  end if;
  if p_reason is null or p_reason not in ('refund', 'dispute_lost') then
    return jsonb_build_object('ok', false, 'code', 'bad_reason');
  end if;
  select * into v from public.wallet_payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.paid_at is null then
    return jsonb_build_object('ok', false, 'code', 'not_paid');
  end if;
  v_ceiling := v.card_cents + v.tip_cents;
  v_new_refunded := least(p_amount_refunded, v_ceiling);
  v_delta := v_new_refunded - v.refunded_cents;
  if v_delta <= 0 then
    return jsonb_build_object('ok', true, 'outcome', 'already_applied', 'refunded_cents', v.refunded_cents);
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);

  v_card_refunded := least(v_new_refunded, v.card_cents);
  v_tip_refunded := v_new_refunded - v_card_refunded;

  if v.cashback_cents > 0 and v.card_cents > 0 then
    v_target := case when v_card_refunded >= v.card_cents then v.cashback_cents
                     else (v.cashback_cents * v_card_refunded) / v.card_cents end;
    v_done := coalesce((select -sum(amount_cents) from public.wallet_entries
                         where payment_id = v.id and kind = 'reversal'), 0) + v.uncovered_cents;
    v_to_reverse := greatest(v_target - v_done, 0);
    if v_to_reverse > 0 then
      select greatest(available_cents + pending_cents, 0) into v_unspent
        from public.wallet_balance(v.consumer_id, v.place_id, v.currency, v.livemode, now());
      v_reversed := least(v_to_reverse, v_unspent);
      if v_reversed > 0 then
        insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at, reason)
        values (v.consumer_id, v.place_id, 'reversal', -v_reversed, v.currency, v.id, v.livemode, now(), p_reason);
      end if;
    end if;
  end if;

  -- MESITA-3461: the refunded share of the card part owes no fee; a full
  -- card refund owes none. Never shrinks (a replay cannot bill it again).
  v_fee_refunded := case
    when v.card_cents <= 0 or v_card_refunded >= v.card_cents then v.application_fee_cents
    else (v.application_fee_cents * v_card_refunded) / v.card_cents end;
  v_fee_refunded := least(greatest(v.fee_refunded_cents, v_fee_refunded), v.application_fee_cents);

  v_status := case
    when v.uncovered_cents + (v_to_reverse - v_reversed) > 0 then 'needs_review'
    when v_new_refunded >= v_ceiling then 'refunded'
    else 'partly_refunded'
  end;

  update public.wallet_payments
     set refunded_cents = v_new_refunded,
         tip_refunded_cents = v_tip_refunded,
         uncovered_cents = uncovered_cents + (v_to_reverse - v_reversed),
         fee_refunded_cents = v_fee_refunded,
         status = v_status,
         updated_at = now()
   where id = v.id;

  return jsonb_build_object('ok', true, 'outcome', 'applied', 'delta_cents', v_delta,
    'card_refunded_cents', v_card_refunded, 'tip_refunded_cents', v_tip_refunded,
    'reversed_cents', v_reversed, 'uncovered_cents', v_to_reverse - v_reversed, 'status', v_status,
    'fee_refunded_cents', v_fee_refunded);
end;
$function$;

revoke all on function public.wallet_refund_payment(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.wallet_refund_payment(uuid, integer, text) to service_role;

comment on function public.wallet_refund_payment(uuid, integer, text) is
  'MESITA-3305 Wallet: applies Stripe''s cumulative amount_refunded over card + tip: card first, then tip; the refunded share of the card part takes back that share of the cashback (all of it on a full card refund), capped at the credit the guest still holds; the rest is uncovered_cents and needs_review. p_reason (refund | dispute_lost, MESITA-3460) is stored on the reversal entry. MESITA-3461: the same share of Mesita''s fee is written to fee_refunded_cents (owes no fee). Replay-safe. Service role only.';

create or replace function public.wallet_refund_purchase(p_purchase_id uuid, p_amount_refunded integer, p_reason text default 'refund')
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_purchases;
  v_new_refunded integer;
  v_delta integer;
  v_target integer;
  v_done integer;
  v_to_reverse integer;
  v_unspent integer;
  v_reversed integer;
  v_status text;
  v_fee_refunded integer;
begin
  if p_amount_refunded is null or p_amount_refunded < 0 then
    return jsonb_build_object('ok', false, 'code', 'bad_amount');
  end if;
  if p_reason is null or p_reason not in ('refund', 'dispute_lost') then
    return jsonb_build_object('ok', false, 'code', 'bad_reason');
  end if;
  select * into v from public.wallet_purchases where id = p_purchase_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.status not in ('paid', 'refunded', 'partly_refunded', 'needs_review') then
    return jsonb_build_object('ok', false, 'code', 'not_paid');
  end if;
  v_new_refunded := least(p_amount_refunded, v.amount_cents);
  v_delta := v_new_refunded - v.refunded_cents;
  if v_delta <= 0 then
    return jsonb_build_object('ok', true, 'outcome', 'already_applied', 'refunded_cents', v.refunded_cents);
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);

  -- MESITA-3461: the refunded share owes no fee; a full refund owes none.
  v_fee_refunded := case
    when v.amount_cents <= 0 or v_new_refunded >= v.amount_cents then v.application_fee_cents
    else (v.application_fee_cents * v_new_refunded) / v.amount_cents end;
  v_fee_refunded := least(greatest(v.fee_refunded_cents, v_fee_refunded), v.application_fee_cents);

  -- A Story refunded before staff activated it was never credited
  -- (MESITA-3507): nothing to reverse, nothing uncovered. It can no longer be
  -- activated (wallet_activate_story needs status paid).
  if v.voucher = 'voucher_story' and v.story_activated_at is null then
    v_status := case when v_new_refunded >= v.amount_cents then 'refunded' else 'partly_refunded' end;
    update public.wallet_purchases
       set refunded_cents = v_new_refunded, fee_refunded_cents = v_fee_refunded, status = v_status, updated_at = now()
     where id = v.id;
    return jsonb_build_object('ok', true, 'outcome', 'applied', 'delta_cents', v_delta,
      'reversed_cents', 0, 'uncovered_cents', 0, 'status', v_status, 'fee_refunded_cents', v_fee_refunded);
  end if;

  -- What should be gone in total once this refund is applied: the refunded
  -- principal plus the bonus's share of it (all of the bonus on a full
  -- refund). What is already gone: earlier reversals plus what could not be
  -- reversed. The difference is this call's reversal, whatever order the
  -- events arrived in.
  v_target := v_new_refunded + (v.bonus_cents * v_new_refunded) / v.amount_cents;
  v_done := coalesce((select -sum(amount_cents) from public.wallet_entries
                       where purchase_id = v.id and kind = 'reversal'), 0) + v.uncovered_cents;
  v_to_reverse := greatest(v_target - v_done, 0);

  select greatest(available_cents + pending_cents, 0) into v_unspent
    from public.wallet_balance(v.consumer_id, v.place_id, v.currency, v.livemode, now());
  v_reversed := least(v_to_reverse, v_unspent);

  if v_reversed > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at, reason)
    values (v.consumer_id, v.place_id, 'reversal', -v_reversed, v.currency, v.id, v.livemode, now(), p_reason);
  end if;

  v_status := case
    when v.uncovered_cents + (v_to_reverse - v_reversed) > 0 then 'needs_review'
    when v_new_refunded >= v.amount_cents then 'refunded'
    else 'partly_refunded'
  end;
  update public.wallet_purchases
     set refunded_cents = v_new_refunded,
         uncovered_cents = uncovered_cents + (v_to_reverse - v_reversed),
         fee_refunded_cents = v_fee_refunded,
         status = v_status,
         updated_at = now()
   where id = v.id;

  return jsonb_build_object('ok', true, 'outcome', 'applied', 'delta_cents', v_delta,
    'reversed_cents', v_reversed, 'uncovered_cents', v_to_reverse - v_reversed, 'status', v_status,
    'fee_refunded_cents', v_fee_refunded);
end;
$function$;

revoke all on function public.wallet_refund_purchase(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.wallet_refund_purchase(uuid, integer, text) to service_role;

comment on function public.wallet_refund_purchase(uuid, integer, text) is
  'MESITA-3302 Wallet: applies Stripe''s cumulative amount_refunded to a purchase: only the delta above refunded_cents is reversed (bonus first), capped at the credit the guest still holds; the rest is uncovered_cents and needs_review; a Story refunded before activation had no credit and reverses nothing (MESITA-3507). p_reason (refund | dispute_lost, MESITA-3460) is stored on the reversal entry. MESITA-3461: the refunded share of Mesita''s fee is written to fee_refunded_cents. Replay-safe. Service role only.';

-- ── 3. Invoices and their lines ────────────────────────────────────────────
create table if not exists public.place_fee_invoices (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  livemode boolean not null,
  currency text not null,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'draft'
    check (status in ('draft', 'open', 'paid', 'void', 'uncollectible')),
  stripe_customer_id text,
  stripe_invoice_id text unique,
  hosted_invoice_url text,
  due_at timestamptz,
  paid_at timestamptz,
  stripe_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists place_fee_invoices_place_idx on public.place_fee_invoices (place_id, livemode, created_at desc);
create index if not exists place_fee_invoices_unsettled_idx on public.place_fee_invoices (status) where status in ('draft', 'open', 'uncollectible');

comment on table public.place_fee_invoices is
  'MESITA-3461: Mesita''s 5% billed to a place, one Stripe invoice on Mesita''s own account (collection_method send_invoice) per claim. draft = claimed, the Stripe invoice not made yet (the cron retries with the row id as Idempotency-Key); open → paid | void | uncollectible as Stripe says. An open invoice past due_at, or an uncollectible one, sets the place''s fee_hold. EF-only.';

alter table public.place_fee_invoices enable row level security;
revoke all on table public.place_fee_invoices from public, anon, authenticated;
grant all on table public.place_fee_invoices to service_role;

create table if not exists public.place_fee_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.place_fee_invoices(id) on delete cascade,
  payment_id uuid references public.wallet_payments(id) on delete set null,
  purchase_id uuid references public.wallet_purchases(id) on delete set null,
  amount_cents integer not null check (amount_cents <> 0),
  created_at timestamptz not null default now(),
  constraint place_fee_lines_one_row_chk check ((payment_id is null) <> (purchase_id is null))
);

create index if not exists place_fee_lines_invoice_idx on public.place_fee_lines (invoice_id);

comment on table public.place_fee_lines is
  'MESITA-3461: what one invoice moved off one row: the delta of (application_fee_cents - fee_refunded_cents - fee_billed_cents) at claim time; negative when a refund came after the row was billed. EF-only.';

alter table public.place_fee_lines enable row level security;
revoke all on table public.place_fee_lines from public, anon, authenticated;
grant all on table public.place_fee_lines to service_role;

-- ── 4. The hold and the customer on the account row ────────────────────────
alter table public.place_payment_accounts
  add column if not exists fee_hold boolean not null default false,
  add column if not exists fee_hold_at timestamptz,
  add column if not exists fee_customer_id text;

comment on column public.place_payment_accounts.fee_hold is
  'MESITA-3461: Mesita''s fee invoice is unpaid (open past due, or uncollectible): card payments here are off until it is paid. Derived by place_fee_invoice_set only; it never touches the owner''s pay_cards switch.';
comment on column public.place_payment_accounts.fee_customer_id is
  'MESITA-3461: the place''s Stripe customer on Mesita''s own account, in this row''s livemode, that fee invoices are sent to.';

-- ── 5. The claim ───────────────────────────────────────────────────────────
create or replace function public.place_fee_claim(
  p_place_id uuid, p_livemode boolean, p_currency text,
  p_min_cents integer, p_threshold_cents integer, p_period interval)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_draft public.place_fee_invoices;
  v_owed bigint;
  v_oldest timestamptz;
  v_invoice uuid;
  v_lines integer;
begin
  if p_place_id is null or p_livemode is null or p_currency is null
     or p_min_cents is null or p_threshold_cents is null or p_period is null then
    return jsonb_build_object('ok', false, 'code', 'bad_args');
  end if;
  -- One claim per place at a time.
  perform pg_advisory_xact_lock(hashtextextended('place_fee_claim:' || p_place_id::text, 0));

  -- A draft left by a failed Stripe call is retried as it is.
  select * into v_draft from public.place_fee_invoices
   where place_id = p_place_id and livemode = p_livemode and status = 'draft'
   order by created_at limit 1;
  if found then
    return jsonb_build_object('ok', true, 'outcome', 'draft', 'invoice_id', v_draft.id,
      'amount_cents', v_draft.amount_cents, 'currency', v_draft.currency);
  end if;

  create temporary table if not exists pg_temp.fee_owed (
    payment_id uuid, purchase_id uuid, delta integer, paid_at timestamptz) on commit drop;
  delete from pg_temp.fee_owed;

  insert into pg_temp.fee_owed
  select y.id, null, (y.application_fee_cents - y.fee_refunded_cents) - y.fee_billed_cents, y.paid_at
    from public.wallet_payments y
   where y.place_id = p_place_id and y.livemode = p_livemode and y.currency = p_currency
     and y.paid_at is not null and y.fee_collected = 'invoice'
     and (y.application_fee_cents - y.fee_refunded_cents) <> y.fee_billed_cents
   for update of y;
  insert into pg_temp.fee_owed
  select null, p.id, (p.application_fee_cents - p.fee_refunded_cents) - p.fee_billed_cents, p.paid_at
    from public.wallet_purchases p
   where p.place_id = p_place_id and p.livemode = p_livemode and p.currency = p_currency
     and p.paid_at is not null and p.fee_collected = 'invoice'
     and (p.application_fee_cents - p.fee_refunded_cents) <> p.fee_billed_cents
   for update of p;

  select coalesce(sum(delta), 0), min(paid_at) filter (where delta > 0)
    into v_owed, v_oldest from pg_temp.fee_owed;

  if v_owed < p_min_cents then
    return jsonb_build_object('ok', true, 'outcome', 'below_minimum', 'owed_cents', v_owed);
  end if;
  if v_owed < p_threshold_cents and (v_oldest is null or v_oldest > now() - p_period) then
    return jsonb_build_object('ok', true, 'outcome', 'not_due', 'owed_cents', v_owed);
  end if;

  insert into public.place_fee_invoices (place_id, livemode, currency, amount_cents)
  values (p_place_id, p_livemode, p_currency, v_owed::integer)
  returning id into v_invoice;

  insert into public.place_fee_lines (invoice_id, payment_id, purchase_id, amount_cents)
  select v_invoice, payment_id, purchase_id, delta from pg_temp.fee_owed where delta <> 0;
  get diagnostics v_lines = row_count;

  update public.wallet_payments y set fee_billed_cents = y.fee_billed_cents + o.delta, updated_at = now()
    from pg_temp.fee_owed o where o.payment_id = y.id;
  update public.wallet_purchases p set fee_billed_cents = p.fee_billed_cents + o.delta, updated_at = now()
    from pg_temp.fee_owed o where o.purchase_id = p.id;

  return jsonb_build_object('ok', true, 'outcome', 'claimed', 'invoice_id', v_invoice,
    'amount_cents', v_owed, 'currency', p_currency, 'lines', v_lines);
end;
$function$;

revoke all on function public.place_fee_claim(uuid, boolean, text, integer, integer, interval) from public, anon, authenticated;
grant execute on function public.place_fee_claim(uuid, boolean, text, integer, integer, interval) to service_role;

comment on function public.place_fee_claim(uuid, boolean, text, integer, integer, interval) is
  'MESITA-3461: moves what a place owes Mesita (fee_collected = invoice rows, net of refunds, minus what earlier invoices claimed) onto a new draft place_fee_invoices row with one place_fee_lines row each, when it is at least p_min_cents (Stripe''s minimum) and either reaches p_threshold_cents or its oldest unbilled row was paid more than p_period ago. An existing draft is answered instead (retry). Answers outcome draft | claimed | below_minimum | not_due. Service role only.';

-- ── 6. The invoice's state and the hold ────────────────────────────────────
create or replace function public.place_fee_invoice_set(
  p_invoice_id uuid, p_status text,
  p_stripe_invoice_id text default null, p_customer_id text default null,
  p_url text default null, p_due_at timestamptz default null,
  p_paid_at timestamptz default null, p_error text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.place_fee_invoices;
  v_hold boolean;
  v_was boolean;
begin
  if p_status is null or p_status not in ('draft', 'open', 'paid', 'void', 'uncollectible') then
    return jsonb_build_object('ok', false, 'code', 'bad_status');
  end if;
  select * into v from public.place_fee_invoices where id = p_invoice_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  -- paid and void are final: a stale read never reopens them.
  if v.status in ('paid', 'void') and p_status <> v.status then
    p_status := v.status;
  end if;

  update public.place_fee_invoices
     set status = p_status,
         stripe_invoice_id = coalesce(p_stripe_invoice_id, stripe_invoice_id),
         stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
         hosted_invoice_url = coalesce(p_url, hosted_invoice_url),
         due_at = coalesce(p_due_at, due_at),
         paid_at = case when p_status = 'paid' then coalesce(paid_at, p_paid_at, now()) else paid_at end,
         stripe_error = p_error,
         updated_at = now()
   where id = v.id;

  v_hold := exists (
    select 1 from public.place_fee_invoices i
     where i.place_id = v.place_id and i.livemode = v.livemode
       and (i.status = 'uncollectible' or (i.status = 'open' and i.due_at is not null and i.due_at < now())));

  select fee_hold into v_was from public.place_payment_accounts
   where place_id = v.place_id and livemode = v.livemode for update;
  if found and v_was is distinct from v_hold then
    update public.place_payment_accounts
       set fee_hold = v_hold,
           fee_hold_at = case when v_hold then now() else null end,
           updated_at = now()
     where place_id = v.place_id and livemode = v.livemode;
  end if;

  return jsonb_build_object('ok', true, 'place_id', v.place_id, 'status', p_status,
    'fee_hold', v_hold, 'changed', found and v_was is distinct from v_hold);
end;
$function$;

revoke all on function public.place_fee_invoice_set(uuid, text, text, text, text, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.place_fee_invoice_set(uuid, text, text, text, text, timestamptz, timestamptz, text) to service_role;

comment on function public.place_fee_invoice_set(uuid, text, text, text, text, timestamptz, timestamptz, text) is
  'MESITA-3461: stores a fee invoice''s state as Stripe reports it (paid and void are final), then recomputes the place''s fee_hold: on while any invoice of the place in that mode is open past due or uncollectible. Writes fee_hold only, never place_payment_settings.pay_cards. Answers fee_hold and whether it changed. Service role only.';

-- ── 7. The cron ────────────────────────────────────────────────────────────
-- Every hour at :17. Kill switch: select cron.unschedule('bill-fees');
select cron.unschedule('bill-fees')
where exists (select 1 from cron.job where jobname = 'bill-fees');

select cron.schedule(
  'bill-fees',
  '17 * * * *',
  $$
  select net.http_post(
    url := 'https://yjalywfzdelacdzccpgb.supabase.co/functions/v1/supabase-cron-bill-fees',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'scheduler_service_role_key'
      ),
      'X-Internal-Caller', 'pg_cron'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- ── 8. Post-flight ─────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'wallet_note_fee_refund') then
    raise exception 'wallet_note_fee_refund survived';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'place_fee_claim') then
    raise exception 'place_fee_claim is missing after apply';
  end if;
  if not exists (select 1 from cron.job where jobname = 'bill-fees') then
    raise exception 'the bill-fees cron job is missing after apply';
  end if;
end $$;

-- MESITA-3304 — W2a: a guest pays from credit in one RPC and shows a proof.
--
-- No Stripe in this wave. A guest with Available credit at a place types an
-- amount on the Pay tab; wallet_pay_credit spends it under the per-(guest,
-- place) lock and answers a proof token; the QR opens visit.mesita.ai, where
-- staff read the payment and mark it seen. The card part, the receiver,
-- cashback and the cron are W2b; the waiter's charge is W2c.
--
--   wallet_payments.proof_token    128 bits, base64url, minted by the EF and
--                                  stored in clear: it grants a read of one
--                                  receipt and a "seen" stamp, and the guest
--                                  reopens the same QR from the Wallet.
--   wallet_payments.proof_seen_at  set once, by visit-web-mark-proof-seen.
--   wallet_pay_credit(...)         the one money move of this wave.
--   wallet_balances(...)           wallet_balance for every place a guest
--                                  holds credit at, so consumer-web-get-wallet
--                                  reads spendable from SQL and never keeps a
--                                  copy of the hold rule in TypeScript.
--
-- Additive only: two nullable columns and two new functions. The functions
-- deploy about five minutes after this applies; nothing calls these until
-- they do.

-- ── 1. The proof columns ─────────────────────────────────────────────────────
alter table public.wallet_payments
  add column proof_token text unique
    constraint wallet_payments_proof_token_chk check (proof_token is null or proof_token ~ '^[A-Za-z0-9_-]{22}$'),
  add column proof_seen_at timestamptz;

comment on column public.wallet_payments.proof_token is
  'MESITA-3304: the proof QR''s key, 128 bits base64url (22 chars), minted by the EF. Stored in clear: it reads one receipt and stamps it seen; the guest reopens the same QR. W2b mints it when a mixed payment is paid.';
comment on column public.wallet_payments.proof_seen_at is
  'MESITA-3304: when staff first marked the proof seen on visit.mesita.ai; set once.';

-- ── 2. Paying from credit ────────────────────────────────────────────────────
-- Lock, replay, balance, two inserts. A replay of the same request_id with
-- the same place, amount and universe answers the stored row; anything else
-- under that request_id is `taken`, with the existing row's id so the client
-- shows that proof instead of paying again. Two concurrent calls with one
-- request_id at two places take two different pair locks and both miss the
-- replay select: the unique index decides, and the loser reads `taken` too.
create or replace function public.wallet_pay_credit(
  p_consumer_id uuid, p_place_id uuid, p_amount_cents integer, p_currency text,
  p_livemode boolean, p_request_id uuid, p_proof_token text, p_ticket text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_prior public.wallet_payments;
  v_spendable integer;
  v_id uuid;
  v_paid_at timestamptz;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    return jsonb_build_object('ok', false, 'code', 'amount_required');
  end if;
  if p_consumer_id is null or p_request_id is null then
    raise exception 'wallet_pay_credit: consumer and request_id are required';
  end if;
  -- The function is the last word on currency as on amounts: places store
  -- 'MXN', the ledger 'mxn'.
  p_currency := lower(p_currency);

  perform public.wallet_lock(p_consumer_id, p_place_id);

  select * into v_prior from public.wallet_payments
   where consumer_id = p_consumer_id and request_id = p_request_id;
  if found then
    if v_prior.place_id = p_place_id and v_prior.amount_cents = p_amount_cents
       and v_prior.livemode = p_livemode and v_prior.paid_at is not null then
      return jsonb_build_object('ok', true, 'outcome', 'already_paid', 'payment_id', v_prior.id,
        'status', v_prior.status, 'credit_cents', v_prior.credit_cents, 'currency', v_prior.currency,
        'paid_at', v_prior.paid_at, 'proof_token', v_prior.proof_token);
    end if;
    return jsonb_build_object('ok', false, 'code', 'taken', 'payment_id', v_prior.id);
  end if;

  select b.spendable_cents into v_spendable
    from public.wallet_balance(p_consumer_id, p_place_id, p_currency, p_livemode) b;
  v_spendable := coalesce(v_spendable, 0);
  if p_amount_cents > v_spendable then
    return jsonb_build_object('ok', false, 'code', 'insufficient', 'spendable_cents', v_spendable);
  end if;

  begin
    insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, tip_cents,
                                        currency, status, stripe_account_id, paid_at, request_id, ticket,
                                        proof_token, livemode)
    values (p_consumer_id, p_place_id, p_amount_cents, p_amount_cents, 0, 0,
            p_currency, 'paid', null, now(), p_request_id, p_ticket,
            p_proof_token, p_livemode)
    returning id, paid_at into v_id, v_paid_at;
  exception when unique_violation then
    select id into v_id from public.wallet_payments
     where consumer_id = p_consumer_id and request_id = p_request_id;
    return jsonb_build_object('ok', false, 'code', 'taken', 'payment_id', v_id);
  end;

  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
  values (p_consumer_id, p_place_id, 'spend', -p_amount_cents, p_currency, v_id, p_livemode, now());

  return jsonb_build_object('ok', true, 'outcome', 'paid', 'payment_id', v_id, 'status', 'paid',
    'credit_cents', p_amount_cents, 'currency', p_currency, 'paid_at', v_paid_at, 'proof_token', p_proof_token);
end;
$function$;

revoke all on function public.wallet_pay_credit(uuid, uuid, integer, text, boolean, uuid, text, text) from public, anon, authenticated;
grant execute on function public.wallet_pay_credit(uuid, uuid, integer, text, boolean, uuid, text, text) to service_role;

comment on function public.wallet_pay_credit(uuid, uuid, integer, text, boolean, uuid, text, text) is
  'MESITA-3304 Wallet: a credit-only payment. Under wallet_lock: a replayed request_id (same place, amount, livemode) answers already_paid; any other use of it answers taken with that row''s payment_id; more than spendable answers insufficient; otherwise one paid wallet_payments row and one spend entry, Available at once. Service role only.';

-- ── 3. Every balance of one guest ────────────────────────────────────────────
-- wallet_balance's arithmetic, grouped by place and currency: entries give
-- Available and Pending, open payments give the hold, spendable never goes
-- below zero. W2b changes the hold rule here and in wallet_balance only.
create or replace function public.wallet_balances(p_consumer_id uuid, p_livemode boolean, p_now timestamptz default now())
 returns table (place_id uuid, currency text, available_cents integer, pending_cents integer, held_cents integer, spendable_cents integer)
 language sql
 stable
 set search_path to 'public'
as $function$
  with e as (
    select we.place_id, we.currency,
      coalesce(sum(we.amount_cents) filter (where we.available_at <= p_now), 0)::integer as available_cents,
      coalesce(sum(we.amount_cents) filter (where we.available_at > p_now), 0)::integer as pending_cents
    from public.wallet_entries we
    where we.consumer_id = p_consumer_id and we.livemode = p_livemode
    group by we.place_id, we.currency
  ),
  h as (
    select wp.place_id, wp.currency, coalesce(sum(wp.credit_cents), 0)::integer as held_cents
    from public.wallet_payments wp
    where wp.consumer_id = p_consumer_id and wp.livemode = p_livemode
      and wp.status in ('opening', 'open')
    group by wp.place_id, wp.currency
  )
  select coalesce(e.place_id, h.place_id), coalesce(e.currency, h.currency),
         coalesce(e.available_cents, 0), coalesce(e.pending_cents, 0), coalesce(h.held_cents, 0),
         greatest(coalesce(e.available_cents, 0) - coalesce(h.held_cents, 0), 0)
  from e full join h on h.place_id = e.place_id and h.currency = e.currency;
$function$;

revoke all on function public.wallet_balances(uuid, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.wallet_balances(uuid, boolean, timestamptz) to service_role;

comment on function public.wallet_balances(uuid, boolean, timestamptz) is
  'MESITA-3304 Wallet: wallet_balance for every (place, currency) a guest holds entries or open payments at. Service role only.';

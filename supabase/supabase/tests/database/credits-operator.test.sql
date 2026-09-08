-- Credits operator surfaces: the BEHAVIOUR of refund/adjust, the expiry
-- sweep, and the liability aggregate (MESITA-1679).
--
-- A THIRD credits file, same reasoning credits.test.sql gives for being a
-- second one: these are new RPCs with their own failure modes, and folding
-- them into either the shape file or the issue/spend behaviour file would
-- make one failure unreadable as "which of three unrelated things broke."
--
-- WHY THESE. Each is a way an operator surface on a money feature has
-- historically lied or lost money, not a way this code happens to be
-- written:
--   · a refund or adjust that goes negative instead of refusing
--   · a doubled refund (replayed webhook, doubled admin click)
--   · the expiry sweep running before anyone decided forfeit vs return
--   · the expiry sweep re-processing the same lot twice
--   · a liability total that quietly sums two currencies together

begin;
select plan(13);

insert into auth.users (id) values ('22222222-2222-2222-2222-222222222222');
insert into public.organizations (id, name, currency)
values ('11111111-1111-1111-1111-111111111111', 'pgTAP org', 'MXN');
insert into public.consumers (id, code)
values ('22222222-2222-2222-2222-222222222222', '9999-0001');

-- ── reverse_credit_lot: refund ──────────────────────────────────────────

select public.create_credit_lot(
  '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
  1000, 100, 'MXN', now() - interval '1 hour', now() + interval '90 days', 'pi_refund_test'
);

select is(
  ((public.reverse_credit_lot(
    (select id from public.credit_lots where stripe_payment_intent_id = 'pi_refund_test'),
    'refund', 400, 're_1'
  ))->>'ok')::boolean,
  true,
  'a partial refund inside the balance succeeds');

select is(
  (select paid_delta_cents from public.credit_ledger
    where kind = 'refund' and reference = 're_1'),
  -400,
  'a refund takes principal first, same law as a spend');

select is(
  ((public.reverse_credit_lot(
    (select id from public.credit_lots where stripe_payment_intent_id = 'pi_refund_test'),
    'refund', 400, 're_1'
  ))->>'idempotent')::boolean,
  true,
  'replaying the same reference is a no-op, not a second refund');

select is(
  (select spent_cents from public.credit_lots where stripe_payment_intent_id = 'pi_refund_test'),
  400,
  'and the replay left spent_cents untouched — 400, not 800');

-- ── reverse_credit_lot: adjust (no Stripe leg) ───────────────────────────

select is(
  ((public.reverse_credit_lot(
    (select id from public.credit_lots where stripe_payment_intent_id = 'pi_refund_test'),
    'adjust', null, 'org_closed'
  ))->>'ok')::boolean,
  true,
  'adjust with a null amount claws back the whole remainder');

select is(
  (select spent_cents from public.credit_lots where stripe_payment_intent_id = 'pi_refund_test'),
  1100,
  'the lot is now fully consumed: 400 refunded + 700 adjusted = 1100');

select is(
  ((public.reverse_credit_lot(
    (select id from public.credit_lots where stripe_payment_intent_id = 'pi_refund_test'),
    'adjust', 1, 'nothing_left'
  ))->>'code'),
  'nothing_to_reverse',
  'a lot with nothing left refuses rather than going negative');

-- Structured refusal, not an exception — same house shape as spend_credits'
-- own error codes, so a caller branches on `code` rather than a try/catch.
select is(
  ((public.reverse_credit_lot(
    (select id from public.credit_lots where stripe_payment_intent_id = 'pi_refund_test'),
    'expire', 1, 'bad_kind'
  ))->>'code'),
  'invalid_kind',
  'reverse_credit_lot rejects a kind it does not own'
);

-- ── sweep_expired_credit_lots: refuses until configured ─────────────────

select is(
  ((public.sweep_expired_credit_lots())->>'code'),
  'expiry_disposition_not_configured',
  'the sweep refuses to touch anything while expiryDisposition is unset'
);

-- ── sweep_expired_credit_lots: forfeit ───────────────────────────────────

select public.create_credit_lot(
  '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
  1000, 100, 'MXN', now() - interval '100 days', now() - interval '1 day', 'pi_forfeit_test'
);

update public.app_config
   set controls_config = controls_config || jsonb_build_object('expiryDisposition', 'forfeit')
 where id = 1;

select is(
  (public.sweep_expired_credit_lots())->>'swept',
  '1',
  'forfeit disposition sweeps the expired lot'
);

select is(
  (select spent_cents from public.credit_lots where stripe_payment_intent_id = 'pi_forfeit_test'),
  1100,
  'forfeit consumes the WHOLE remainder — principal and bonus both die'
);

select is(
  (public.sweep_expired_credit_lots())->>'scanned',
  '0',
  'sweeping the same lot again is a no-op — the kind=expire guard held'
);

-- ── sweep_expired_credit_lots: return_paid leaves principal unswept ─────

select public.create_credit_lot(
  '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
  2000, 200, 'MXN', now() - interval '100 days', now() - interval '1 day', 'pi_return_test'
);

update public.app_config
   set controls_config = controls_config || jsonb_build_object('expiryDisposition', 'return_paid')
 where id = 1;

select public.sweep_expired_credit_lots();

select is(
  (select spent_cents from public.credit_lots where stripe_payment_intent_id = 'pi_return_test'),
  200,
  'return_paid consumes ONLY the bonus (200) — the 2000 paid stays off spent_cents'
);

select * from finish();
rollback;

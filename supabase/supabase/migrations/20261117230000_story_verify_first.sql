-- MESITA-4296: the Story voucher is verified BEFORE the guest pays.
--
-- Pato, 2026-11-17: "súbete historia, paga, y luego el bono… no puedes
-- borrar la story durante 3 horas… el bot va a checar que siga la story
-- arriba… pero sí quiero hacer la verificación de la historia antes".
--
--   1. The guest posts a story tagging @mesita (and the place, on trust).
--   2. consumer-web-check-story finds the mention under the guest's verified
--      handle; only then the sheet offers Pay.
--   3. The buy RESERVES that mention on the purchase (story_mention_id); the
--      credit CLAIMS it (story_mentions.purchase_id) in the same transaction
--      as the voucher entry, and the re-check is set to payment + 3 hours.
--      A mention lost between buy and credit never blocks the money: the
--      voucher lands, only the bonus is void (mention_lost).
--   4. The cron re-checks the story 3 hours after payment: still up → bonus;
--      gone after 3 tries → void; a story past its natural 24 hours →
--      bonus (it expired, it was not deleted).
--
-- Staff leave the flow: wallet_review_story, wallet_activate_story and
-- wallet_expire_stories are dropped (no live Story was waiting on staff when
-- this shipped; the migration voids any that does, reason expired).
--
--   story_rules()                 bonus_wait, credit_margin (60 min),
--                                 check_margin (90 min), recheck_meta
--   wallet_purchases.story_mention_id   the reservation (one live per mention)
--   story_claim(purchase)         the claim, called by wallet_credit_purchase
--   wallet_settle_story_recheck   no approval needed; natural-end release
--   wallet_override_story         release | void (release also lifts a void)
--   wallet_refund_purchase        a full refund frees the story
--   wallet_purge_story_mentions   the 24-hour cleanup, live reservations kept

-- ── 1. The rules ─────────────────────────────────────────────────────────────
update public.app_config
   set money_config = (coalesce(money_config, '{}'::jsonb) - 'story_approve_days' - 'story_expiry_anchor')
     || jsonb_build_object('story_credit_margin_sec', 3600, 'story_check_margin_sec', 5400)
 where id = 1;

drop function if exists public.story_rules();
create function public.story_rules()
 returns table (bonus_wait interval, credit_margin interval, check_margin interval, recheck_meta boolean)
 language sql
 stable
 set search_path to 'public'
as $function$
  select
    make_interval(secs => coalesce((c.money_config ->> 'story_bonus_wait_sec')::int, 10800)),
    make_interval(secs => coalesce((c.money_config ->> 'story_credit_margin_sec')::int, 3600)),
    make_interval(secs => coalesce((c.money_config ->> 'story_check_margin_sec')::int, 5400)),
    coalesce((c.money_config ->> 'story_recheck_meta')::boolean, false)
  from (select 1) one
  left join public.app_config c on c.id = 1;
$function$;
revoke all on function public.story_rules() from public, anon, authenticated;
grant execute on function public.story_rules() to service_role;

-- ── 2. Staff's functions go ──────────────────────────────────────────────────
drop function if exists public.wallet_review_story(text, uuid, boolean, text);
drop function if exists public.wallet_activate_story(text);
drop function if exists public.wallet_expire_stories(integer);

-- ── 3. The reservation ───────────────────────────────────────────────────────
alter table public.wallet_purchases
  add column story_mention_id uuid references public.story_mentions (id) on delete set null;

-- One LIVE reservation per mention: a failed, expired or refunded purchase
-- frees the story for another try.
create unique index wallet_purchases_story_mention_live_idx on public.wallet_purchases (story_mention_id)
  where story_mention_id is not null and status not in ('failed', 'expired', 'refunded');

comment on column public.wallet_purchases.story_mention_id is
  'MESITA-4296: the story the guest showed before paying (consumer-web-buy-voucher). One live purchase per mention (wallet_purchases_story_mention_live_idx). wallet_credit_purchase claims it (story_mentions.purchase_id); a full refund clears both.';
comment on column public.wallet_purchases.story_activated_at is
  'MESITA-3507, MESITA-4296: when the Story''s mention was claimed, which is the payment (story_claim). The re-check runs story_rules().bonus_wait after it.';
comment on column public.wallet_purchases.story_review is
  'MESITA-4264: staff''s old answer on a Story (approved | rejected). Retired by MESITA-4296: nothing writes it; history only.';

-- The void reasons: + mention_lost (the story went between buy and credit),
-- + no_mention (a Story credited with no reservation; the buy refuses that,
-- so this is only a safety net).
alter table public.wallet_purchases drop constraint if exists wallet_purchases_story_bonus_void_reason_check;
alter table public.wallet_purchases add constraint wallet_purchases_story_bonus_void_reason_check
  check (story_bonus_void_reason in ('unreachable', 'expired', 'refunded', 'operator', 'mention_lost', 'no_mention'));

-- The cron's rows: claimed (activated), bonus undecided.
drop index if exists public.wallet_purchases_story_recheck_idx;
create index wallet_purchases_story_recheck_idx on public.wallet_purchases (story_recheck_at)
  where story_activated_at is not null and story_bonus is null;

-- ── 4. Old Stories still waiting on staff: void (none were, on 2026-11-17) ──
update public.wallet_purchases
   set story_bonus = 'void', story_bonus_void_reason = 'expired', story_bonus_decided_at = now(), updated_at = now()
 where voucher = 'voucher_story' and status = 'paid' and story_activated_at is null and story_bonus is null;

-- ── 5. The claim ─────────────────────────────────────────────────────────────
-- Called by wallet_credit_purchase with the purchase row and the guest/place
-- lock held. Claims the reserved mention when it still fits; otherwise voids
-- the bonus. Never refuses: the money already arrived.
create or replace function public.story_claim(p_purchase uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_purchases;
  m public.story_mentions;
  r record;
  v_handle text;
  v_now timestamptz := now();
  v_reason text;
begin
  select * into v from public.wallet_purchases where id = p_purchase;
  if v.story_mention_id is null then
    v_reason := 'no_mention';
  else
    select * into r from public.story_rules();
    select * into m from public.story_mentions where id = v.story_mention_id for update;
    select lower(instagram_handle) into v_handle from public.consumers where id = v.consumer_id;
    if m.id is null then
      v_reason := 'mention_lost';
    elsif m.purchase_id is not null and m.purchase_id <> v.id then
      v_reason := 'mention_lost';
    elsif v_handle is null or m.ig_handle is distinct from v_handle then
      v_reason := 'mention_lost';
    elsif m.livemode <> v.livemode then
      v_reason := 'mention_lost';
    elsif m.mentioned_at + interval '24 hours' < v_now + r.bonus_wait + r.credit_margin then
      v_reason := 'mention_lost';
    end if;
  end if;

  if v_reason is not null then
    update public.wallet_purchases
       set story_bonus = 'void', story_bonus_void_reason = v_reason, story_bonus_decided_at = v_now, updated_at = v_now
     where id = v.id and story_bonus is null;
    return v_reason;
  end if;

  update public.story_mentions set purchase_id = v.id where id = m.id;
  update public.wallet_purchases
     set story_activated_at = v_now, story_recheck_at = v_now + r.bonus_wait, story_recheck_tries = 0, updated_at = v_now
   where id = v.id;
  return 'claimed';
end;
$function$;
revoke all on function public.story_claim(uuid) from public, anon, authenticated;
grant execute on function public.story_claim(uuid) to service_role;

-- ── 6. Crediting a Story: the voucher now, then the claim ────────────────────
create or replace function public.wallet_credit_purchase(
  p_purchase_id uuid, p_payment_intent text, p_available_at timestamptz default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_purchases;
  v_kind text;
  v_at timestamptz := coalesce(p_available_at, now());
  v_claim text;
begin
  select * into v from public.wallet_purchases where id = p_purchase_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.status in ('paid', 'refunded', 'partly_refunded', 'needs_review') then
    return jsonb_build_object('ok', true, 'outcome', 'already_paid');
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);

  -- An expired or failed purchase that Stripe nevertheless paid is still
  -- credited: the guest's money arrived.
  update public.wallet_purchases
     set status = 'paid', paid_at = now(), updated_at = now(),
         stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id)
   where id = p_purchase_id;

  -- A Story (MESITA-4296): what the guest paid Available now; NO bonus entry
  -- here. story_claim claims the story shown before paying and sets the
  -- re-check; wallet_settle_story_recheck writes the bonus 3 hours later.
  if v.voucher = 'voucher_story' then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'voucher', v.amount_cents, v.currency, v.id, v.livemode, least(v_at, now()));
    v_claim := public.story_claim(v.id);
    return jsonb_build_object('ok', true, 'outcome', 'credited', 'story', v_claim);
  end if;

  v_kind := case when v.voucher is null then 'prepay' else 'voucher' end;
  -- What the guest paid: Available now (MESITA-4214).
  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
  values (v.consumer_id, v.place_id, v_kind, v.amount_cents, v.currency, v.id, v.livemode, least(v_at, now()));
  -- The bonus: Available at p_available_at.
  if v.bonus_cents > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'bonus', v.bonus_cents, v.currency, v.id, v.livemode, v_at);
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'credited');
end;
$function$;
revoke all on function public.wallet_credit_purchase(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.wallet_credit_purchase(uuid, text, timestamptz) to service_role;

-- ── 7. The re-check's answer ─────────────────────────────────────────────────
create or replace function public.wallet_settle_story_recheck(p_purchase uuid, p_reachable boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_purchases;
  v_now timestamptz := now();
  v_tries integer;
  v_mentioned timestamptz;
  v_natural boolean := false;
begin
  select * into v from public.wallet_purchases where id = p_purchase and voucher = 'voucher_story' for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);

  if v.story_bonus is not null then
    return jsonb_build_object('ok', true, 'outcome', 'already_decided', 'bonus', v.story_bonus,
      'reason', v.story_bonus_void_reason);
  end if;
  if v.status <> 'paid' then
    return jsonb_build_object('ok', true, 'outcome', 'not_paid');
  end if;
  if v.story_activated_at is null then
    return jsonb_build_object('ok', false, 'code', 'not_claimed');
  end if;

  -- A story past its 24 hours ended on its own: Instagram took it down,
  -- the guest did not. That counts as kept up.
  if not p_reachable then
    select mentioned_at into v_mentioned from public.story_mentions where purchase_id = v.id;
    v_natural := v_mentioned is not null and v_mentioned + interval '24 hours' <= v_now;
  end if;

  if p_reachable or v_natural then
    if v.bonus_cents > 0 and not exists (
      select 1 from public.wallet_entries where purchase_id = v.id and kind = 'bonus') then
      insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
      values (v.consumer_id, v.place_id, 'bonus', v.bonus_cents, v.currency, v.id, v.livemode, v_now);
    end if;
    update public.wallet_purchases
       set story_bonus = 'released', story_bonus_decided_at = v_now, updated_at = v_now
     where id = v.id;
    return jsonb_build_object('ok', true, 'outcome', 'released', 'bonus_cents', v.bonus_cents,
      'natural_end', v_natural);
  end if;

  v_tries := v.story_recheck_tries + 1;
  if v_tries >= 3 then
    update public.wallet_purchases
       set story_recheck_tries = v_tries, story_bonus = 'void', story_bonus_void_reason = 'unreachable',
           story_bonus_decided_at = v_now, updated_at = v_now
     where id = v.id;
    return jsonb_build_object('ok', true, 'outcome', 'voided', 'reason', 'unreachable', 'tries', v_tries);
  end if;
  update public.wallet_purchases
     set story_recheck_tries = v_tries, story_recheck_at = v_now + interval '10 minutes', updated_at = v_now
   where id = v.id;
  return jsonb_build_object('ok', true, 'outcome', 'retry', 'tries', v_tries, 'recheck_at', v_now + interval '10 minutes');
end;
$function$;
revoke all on function public.wallet_settle_story_recheck(uuid, boolean) from public, anon, authenticated;
grant execute on function public.wallet_settle_story_recheck(uuid, boolean) to service_role;

-- ── 8. The operator's override: release | void ───────────────────────────────
drop function if exists public.wallet_override_story(uuid, text, uuid);
create function public.wallet_override_story(p_purchase uuid, p_action text, p_actor uuid default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_purchases;
  v_now timestamptz := now();
  v_live integer;
  v_unspent integer;
  v_rev integer;
begin
  if p_action is null or p_action not in ('release', 'void') then
    return jsonb_build_object('ok', false, 'code', 'bad_request');
  end if;
  select * into v from public.wallet_purchases where id = p_purchase and voucher = 'voucher_story' for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);

  if p_action = 'release' then
    if v.story_bonus = 'released' then
      return jsonb_build_object('ok', true, 'outcome', 'already_released');
    end if;
    if v.status <> 'paid' then
      return jsonb_build_object('ok', false, 'code', case when v.status in ('refunded', 'partly_refunded') then 'refunded' else 'not_paid' end);
    end if;
    -- A void that never paid a bonus can be lifted (mention_lost, no_mention,
    -- unreachable…); one that reversed a paid bonus cannot.
    if v.story_bonus = 'void' and exists (
      select 1 from public.wallet_entries where purchase_id = v.id and kind = 'bonus') then
      return jsonb_build_object('ok', false, 'code', 'already_decided');
    end if;
    if v.bonus_cents > 0 and not exists (
      select 1 from public.wallet_entries where purchase_id = v.id and kind = 'bonus') then
      insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
      values (v.consumer_id, v.place_id, 'bonus', v.bonus_cents, v.currency, v.id, v.livemode, v_now);
    end if;
    update public.wallet_purchases
       set story_bonus = 'released', story_bonus_void_reason = null, story_bonus_decided_at = v_now, updated_at = v_now
     where id = v.id;
    return jsonb_build_object('ok', true, 'outcome', 'released');
  end if;

  -- void
  if v.story_bonus = 'void' then
    return jsonb_build_object('ok', true, 'outcome', 'already_void', 'reason', v.story_bonus_void_reason);
  end if;
  v_rev := 0;
  if v.story_bonus = 'released' then
    -- Reverse what is left of the bonus, up to what the guest still holds.
    select coalesce(sum(amount_cents), 0) into v_live from public.wallet_entries
     where purchase_id = v.id and kind = 'bonus';
    v_live := v_live - coalesce((select -sum(amount_cents) from public.wallet_entries
                                 where purchase_id = v.id and kind = 'reversal' and reason = 'story_void'), 0);
    select greatest(available_cents + pending_cents, 0) into v_unspent
      from public.wallet_balance(v.consumer_id, v.place_id, v.currency, v.livemode, v_now);
    v_rev := least(greatest(v_live, 0), coalesce(v_unspent, 0));
    if v_rev > 0 then
      insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at, reason)
      values (v.consumer_id, v.place_id, 'reversal', -v_rev, v.currency, v.id, v.livemode, v_now, 'story_void');
    end if;
  end if;
  update public.wallet_purchases
     set story_bonus = 'void', story_bonus_void_reason = 'operator', story_bonus_decided_at = v_now, updated_at = v_now
   where id = v.id;
  return jsonb_build_object('ok', true, 'outcome', 'voided', 'reversed_cents', v_rev);
end;
$function$;
revoke all on function public.wallet_override_story(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.wallet_override_story(uuid, text, uuid) to service_role;

-- ── 9. Refunds: a full refund frees the story ────────────────────────────────
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
  v_story boolean;
  v_voucher_held boolean;
  v_bonus_held integer := 0;
  v_story_void integer := 0;
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

  -- What should be gone in total once this refund is applied: the refunded
  -- principal plus the bonus's share of it (all of the bonus on a full
  -- refund). What is already gone: earlier reversals plus what could not be
  -- reversed. The difference is this call's reversal, whatever order the
  -- events arrived in.
  -- A STORY (MESITA-4264) counts only what its ledger holds: the principal
  -- when its voucher entry exists, the bonus's share only of bonus entries
  -- that exist and were not voided by the operator, plus any such void.
  v_story := v.voucher = 'voucher_story';
  if v_story then
    v_voucher_held := exists (select 1 from public.wallet_entries where purchase_id = v.id and kind = 'voucher');
    select coalesce(sum(amount_cents), 0) into v_bonus_held from public.wallet_entries
     where purchase_id = v.id and kind = 'bonus';
    select coalesce(-sum(amount_cents), 0) into v_story_void from public.wallet_entries
     where purchase_id = v.id and kind = 'reversal' and reason = 'story_void';
    v_target := (case when v_voucher_held then v_new_refunded else 0 end)
      + (greatest(v_bonus_held - v_story_void, 0) * v_new_refunded) / v.amount_cents
      + v_story_void;
  else
    v_target := v_new_refunded + (v.bonus_cents * v_new_refunded) / v.amount_cents;
  end if;
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

  -- Any refund before the Story's bonus is decided voids it, so the re-check
  -- never releases a bonus the refund did not count.
  if v_story and v.story_bonus is null and v_bonus_held = 0 then
    update public.wallet_purchases
       set story_bonus = 'void', story_bonus_void_reason = 'refunded', story_bonus_decided_at = now(),
           story_recheck_at = null
     where id = v.id;
  end if;
  -- MESITA-4296: a FULL refund before any bonus was paid frees the story, so
  -- the guest can show it again on a new purchase.
  if v_story and v_new_refunded >= v.amount_cents and v_bonus_held = 0 then
    update public.story_mentions set purchase_id = null where purchase_id = v.id;
    update public.wallet_purchases set story_mention_id = null, story_recheck_at = null where id = v.id;
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'applied', 'delta_cents', v_delta,
    'reversed_cents', v_reversed, 'uncovered_cents', v_to_reverse - v_reversed, 'status', v_status);
end;
$function$;
revoke all on function public.wallet_refund_purchase(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.wallet_refund_purchase(uuid, integer, text) to service_role;

-- ── 10. The 24-hour cleanup keeps live reservations ──────────────────────────
create or replace function public.wallet_purge_story_mentions(p_before timestamptz)
 returns integer
 language sql
 security definer
 set search_path to 'public'
as $function$
  with gone as (
    delete from public.story_mentions m
     where m.purchase_id is null and m.mentioned_at < p_before
       and not exists (
         select 1 from public.wallet_purchases p
          where p.story_mention_id = m.id and p.status not in ('failed', 'expired', 'refunded'))
    returning 1
  )
  select count(*)::int from gone;
$function$;
revoke all on function public.wallet_purge_story_mentions(timestamptz) from public, anon, authenticated;
grant execute on function public.wallet_purge_story_mentions(timestamptz) to service_role;

comment on table public.story_mentions is
  'MESITA-4264, MESITA-4296: one Instagram story that tagged @mesita (Meta''s story_mention webhook, or the test-mode emulator). Belongs to a handle: consumer-web-check-story shows it to the guest of that verified handle before they pay, the buy reserves it (wallet_purchases.story_mention_id) and the credit claims it (purchase_id; one story pays one bonus). Unclaimed, unreserved rows are deleted after 24 hours (wallet_purge_story_mentions). EF-only.';
comment on function public.story_claim(uuid) is
  'MESITA-4296: claims a paid Story''s reserved mention when it is unclaimed, of the guest''s current verified handle, of the same livemode and young enough to outlive the re-check (mentioned_at + 24 h >= now + bonus_wait + credit_margin); sets story_activated_at = now and story_recheck_at = now + bonus_wait. Otherwise voids the bonus: no_mention (nothing reserved) or mention_lost. Answers claimed | no_mention | mention_lost. Called by wallet_credit_purchase under its locks. Service role only.';
comment on function public.wallet_settle_story_recheck(uuid, boolean) is
  'MESITA-4296: the re-check''s answer on a claimed Story: reachable, or a story past its own 24 hours, writes the bonus entry Available now (released); unreachable retries in 10 minutes, voiding (unreachable) at the third failure. Does nothing once the bonus is decided or the purchase is not paid. Service role only.';
comment on function public.wallet_override_story(uuid, text, uuid) is
  'MESITA-4296: the operator''s release | void of one Story. release also lifts a void that never paid a bonus; void after release reverses the bonus (reason story_void), capped at what the guest holds. Service role only.';
comment on function public.wallet_purge_story_mentions(timestamptz) is
  'MESITA-4296: deletes unclaimed mentions older than p_before that no live purchase reserves. Answers how many. Service role only.';

-- ── 11. Post-flight ──────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_proc where proname in ('wallet_review_story', 'wallet_activate_story', 'wallet_expire_stories')
             and pronamespace = 'public'::regnamespace) then
    raise exception 'a retired staff Story function is still there';
  end if;
  if exists (select 1 from public.wallet_purchases
              where voucher = 'voucher_story' and status = 'paid' and story_activated_at is null and story_bonus is null) then
    raise exception 'a paid Story is still waiting on staff';
  end if;
end;
$$;

-- MESITA-4717 — THE OFFERS STEPS ARE THE MONEY'S STEPS. Pato, 2026-11-23:
--   Prepay  1. Pay X  2. Wait 3 hours  3. Receive Y ("all in one run")
--   Pay     1. Pay X  2. Wait 1 hour   3. Receive the cashback
--           (only on what was paid by cash or card, never credit)
--   Post    1. Post a story tagging the place  2. Check it  3. Wait 10 hours
--           4. Recheck it  5. Receive the credit ("ALL AUTOMATIC NO HUMANS")
--
-- 1. wallet_credit_purchase: what the guest paid lands with the bonus at
--    p_available_at (paid time + 3 hours), no longer at once (MESITA-4214).
-- 2. wallet_refund_purchase: while no line of the purchase has landed, its
--    reversal lands with them, so a refund inside the 3 hours never eats the
--    guest's other credit at the place. Otherwise it lands now, as before.
-- 3. pay_tab_grant_cashback: Pending 1 hour (was 3). Still cash + card only.
-- 4. Post: story_mentions gains `verified` and recheck_at. story_reward_grant
--    (the first check) writes no money: it sets verified and recheck_at =
--    least(+10 h, posted + 23 h) (emulator: +2 min). story_reward_pay (the
--    recheck) writes the one story entry, Available at once, the amount
--    stored at the first check; Loyalty Cards or the reward Off by then, or a
--    deleted guest, rejects instead. story_reward_reject also closes a
--    verified story (reason `removed`: gone at the recheck). The cron
--    (supabase-cron-verify-stories) claims due rechecks through
--    story_recheck_claim.
--
-- Rollback: re-run the bodies from 20261122180000 (credit, refund),
-- 20261123050000 (cashback) and 20261123060000 (story functions); verified
-- rows must be paid or rejected first, then the constraints restored.

-- ── 4a. The story's new state ───────────────────────────────────────────────
alter table public.story_mentions add column if not exists recheck_at timestamptz;
comment on column public.story_mentions.recheck_at is
  'MESITA-4717: when the second check runs (first check + 10 hours, at most 23 hours after posting; an emulator story 2 minutes). Set from verified on.';

alter table public.story_mentions drop constraint if exists story_mentions_state_check;
alter table public.story_mentions add constraint story_mentions_state_check
  check (state in ('checking', 'verified', 'rewarded', 'rejected'));

alter table public.story_mentions drop constraint if exists story_mentions_reject_reason_check;
alter table public.story_mentions add constraint story_mentions_reject_reason_check
  check (reject_reason in ('no_guest', 'no_tag', 'several_places', 'not_a_story', 'video',
                           'unreadable', 'off', 'repeat', 'expired', 'removed'));

alter table public.story_mentions drop constraint if exists story_mentions_decided_chk;
alter table public.story_mentions add constraint story_mentions_decided_chk
  check ((state in ('checking', 'verified')) = (decided_at is null));

alter table public.story_mentions drop constraint if exists story_mentions_rewarded_chk;
alter table public.story_mentions add constraint story_mentions_rewarded_chk
  check (state not in ('verified', 'rewarded')
         or (reward_cents is not null and consumer_id is not null and place_id is not null and recheck_at is not null));

alter table public.story_mentions drop constraint if exists story_mentions_recheck_chk;
alter table public.story_mentions add constraint story_mentions_recheck_chk
  check (recheck_at is null or state in ('verified', 'rewarded', 'rejected'));

create index if not exists story_mentions_recheck_idx
  on public.story_mentions (recheck_at) where state = 'verified';

-- ── 1–4. The writers ────────────────────────────────────────────────────────
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
begin
  select * into v from public.wallet_purchases where id = p_purchase_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.status in ('paid', 'refunded', 'partly_refunded', 'needs_review') then
    return jsonb_build_object('ok', true, 'outcome', 'already_paid');
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);

  update public.wallet_purchases
     set status = 'paid', paid_at = now(), updated_at = now(),
         stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id)
   where id = p_purchase_id;

  v_kind := case when v.voucher is null then 'prepay' else 'voucher' end;
  -- MESITA-4717: what the guest paid lands with the bonus, at p_available_at
  -- (paid time + 3 hours): "Pay X, wait 3 hours, receive Y".
  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
  values (v.consumer_id, v.place_id, v_kind, v.amount_cents, v.currency, v.id, v.livemode, v_at);
  -- A retired Story purchase (MESITA-4642) earned its bonus only through a
  -- verified story; one paid now gets what the guest paid, never the bonus.
  if v.bonus_cents > 0 and v.voucher is distinct from 'voucher_story' then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'bonus', v.bonus_cents, v.currency, v.id, v.livemode, v_at);
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'credited');
end;
$function$;

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
  v_lands timestamptz;
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

  -- What should be gone in total once this refund is applied, minus what is
  -- already gone. A STORY counts only what its ledger holds (MESITA-4264):
  -- kept after MESITA-4642 so a refund or lost dispute of a historical Story
  -- purchase never reverses a bonus that was never credited.
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

  -- MESITA-4717: while nothing of this purchase has landed yet, the reversal
  -- lands with it, so a refund inside the 3 hours never eats other credit.
  -- Once any of it is available, the reversal is available now.
  v_lands := now();
  if not exists (select 1 from public.wallet_entries
                  where purchase_id = v.id and amount_cents > 0 and available_at <= now()) then
    select coalesce(max(available_at), now()) into v_lands from public.wallet_entries
     where purchase_id = v.id and amount_cents > 0;
    v_lands := greatest(v_lands, now());
  end if;
  if v_reversed > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at, reason)
    values (v.consumer_id, v.place_id, 'reversal', -v_reversed, v.currency, v.id, v.livemode, v_lands, p_reason);
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
    'reversed_cents', v_reversed, 'uncovered_cents', v_to_reverse - v_reversed, 'status', v_status);
end;
$function$;

create or replace function public.pay_tab_grant_cashback(p_tab_id uuid, p_now timestamptz default now())
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  t public.pay_tabs;
  v_earn integer;
  v_welcome boolean;
  v_bps integer;
  v_cap integer;
  r record;
  v_amount integer;
  v_day date;
begin
  select * into t from public.pay_tabs where id = p_tab_id;
  if not found or t.status <> 'paid' or t.consumer_id is null then
    return 0;
  end if;
  -- The part not paid with credit, never the tip.
  v_earn := coalesce(t.cash_bill_cents, 0) + coalesce(t.card_bill_cents, 0);
  if v_earn <= 0 then
    return 0;
  end if;
  -- New credit is born only where Loyalty Cards is On (the signed agreement).
  if not exists (select 1 from public.place_payment_settings s
                  where s.place_id = t.place_id and s.loyalty_cards) then
    return 0;
  end if;

  perform public.wallet_lock(t.consumer_id, t.place_id);

  if exists (select 1 from public.wallet_entries e where e.tab_id = t.id and e.kind = 'cashback') then
    return 0;
  end if;
  -- One per guest per place per Monterrey day.
  v_day := (coalesce(t.paid_at, p_now) at time zone 'America/Monterrey')::date;
  if exists (select 1 from public.wallet_entries e
              where e.consumer_id = t.consumer_id and e.place_id = t.place_id
                and e.livemode = t.livemode and e.kind = 'cashback'
                and (e.created_at at time zone 'America/Monterrey')::date = v_day) then
    return 0;
  end if;

  -- Welcome: no earlier paid bill here. Otherwise Returning.
  v_welcome := not exists (
    select 1 from public.pay_tabs o
     where o.consumer_id = t.consumer_id and o.place_id = t.place_id
       and o.livemode = t.livemode and o.status = 'paid' and o.id <> t.id
       and o.paid_at < coalesce(t.paid_at, p_now));

  select * into r from public.place_cashback_rates(t.place_id);
  v_bps := case when v_welcome then r.welcome_bps else r.returning_bps end;
  v_cap := r.cap_cents;
  if v_bps <= 0 or v_cap <= 0 then
    return 0;
  end if;
  v_amount := least((v_earn::bigint * v_bps / 10000)::integer, v_cap);
  if v_amount <= 0 then
    return 0;
  end if;

  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, tab_id, livemode, available_at, reason)
  values (t.consumer_id, t.place_id, 'cashback', v_amount, lower(t.currency), t.id, t.livemode,
          coalesce(t.paid_at, p_now) + interval '1 hour',
          case when v_welcome then 'welcome' else 'returning' end);
  return v_amount;
end;
$function$;

create or replace function public.story_reward_reject(p_mention uuid, p_reason text, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  m public.story_mentions;
begin
  select * into m from public.story_mentions where id = p_mention for update;
  if m.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if m.state not in ('checking', 'verified') then
    return jsonb_build_object('ok', true, 'outcome', m.state, 'already', true);
  end if;
  update public.story_mentions
     set state = 'rejected', reject_reason = p_reason, decided_at = p_now, ai_claimed_at = null
   where id = m.id;
  return jsonb_build_object('ok', true, 'outcome', 'rejected', 'reason', p_reason);
end;
$function$;

create or replace function public.story_reward_grant(p_mention uuid, p_place uuid, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  m public.story_mentions;
  v_consumer uuid;
  v_cents integer;
  v_recheck timestamptz;
begin
  select * into m from public.story_mentions where id = p_mention for update;
  if m.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if m.state <> 'checking' then
    return jsonb_build_object('ok', true, 'outcome', m.state, 'already', true);
  end if;

  -- The guest: matched at intake, else by the verified handle now.
  v_consumer := m.consumer_id;
  if v_consumer is null and m.ig_handle is not null then
    select c.id into v_consumer
      from public.consumers c
     where lower(c.instagram_handle) = m.ig_handle
       and c.instagram_verified_at is not null and c.deleted_at is null
     order by c.instagram_verified_at desc
     limit 1;
  end if;
  if v_consumer is null then
    update public.story_mentions set place_id = p_place where id = m.id;
    return public.story_reward_reject(m.id, 'no_guest', p_now);
  end if;
  update public.story_mentions set consumer_id = v_consumer, place_id = p_place where id = m.id;

  -- New credit is born only where Loyalty Cards is On, and the reward is not Off.
  if p_place is null or not exists (select 1 from public.place_payment_settings s
                                     where s.place_id = p_place and s.loyalty_cards) then
    return public.story_reward_reject(m.id, 'off', p_now);
  end if;
  select r.story_reward_cents into v_cents from public.place_cashback_rates(p_place) r;
  if coalesce(v_cents, 0) <= 0 then
    return public.story_reward_reject(m.id, 'off', p_now);
  end if;

  perform public.wallet_lock(v_consumer, p_place);
  -- At most one per guest per place per 7 days: a paid story, or another
  -- story of this guest here already checked and waiting (MESITA-4717).
  if exists (select 1 from public.wallet_entries e
              where e.consumer_id = v_consumer and e.place_id = p_place
                and e.livemode = m.livemode and e.kind = 'story'
                and e.created_at > p_now - interval '7 days')
     or exists (select 1 from public.story_mentions o
                 where o.consumer_id = v_consumer and o.place_id = p_place
                   and o.livemode = m.livemode and o.id <> m.id
                   and o.state in ('verified', 'rewarded')
                   and o.mentioned_at > p_now - interval '7 days') then
    return public.story_reward_reject(m.id, 'repeat', p_now);
  end if;
  -- MESITA-4717: no money yet. Checked now, checked again 10 hours later
  -- (never past the story's 23rd hour, while an honest story is still up);
  -- a test-mode emulator story rechecks after 2 minutes.
  v_recheck := case when m.source = 'emulator' then p_now + interval '2 minutes'
                    else least(p_now + interval '10 hours', m.mentioned_at + interval '23 hours') end;
  update public.story_mentions
     set state = 'verified', reward_cents = v_cents, recheck_at = v_recheck, ai_claimed_at = null
   where id = m.id;
  return jsonb_build_object('ok', true, 'outcome', 'verified', 'amount_cents', v_cents,
    'recheck_at', v_recheck, 'consumer_id', v_consumer, 'place_id', p_place);
end;
$function$;
-- ── 4b. The second check pays ──────────────────────────────────────────────
-- THE ONE WRITER of a story's money now. Called by the cron once the story
-- answered "still up" at recheck_at (or outlived its 24 hours).
create or replace function public.story_reward_pay(p_mention uuid, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  m public.story_mentions;
  v_currency text;
  v_cents integer;
begin
  select * into m from public.story_mentions where id = p_mention for update;
  if m.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if m.state <> 'verified' then
    return jsonb_build_object('ok', true, 'outcome', m.state, 'already', true);
  end if;
  if m.recheck_at > p_now then
    return jsonb_build_object('ok', false, 'code', 'not_due', 'recheck_at', m.recheck_at);
  end if;
  perform public.wallet_lock(m.consumer_id, m.place_id);
  if not exists (select 1 from public.consumers c where c.id = m.consumer_id and c.deleted_at is null) then
    return public.story_reward_reject(m.id, 'no_guest', p_now);
  end if;
  -- The place still pays for stories (Loyalty Cards On, the reward not Off).
  select r.story_reward_cents into v_cents from public.place_cashback_rates(m.place_id) r;
  if coalesce(v_cents, 0) <= 0 or not exists (select 1 from public.place_payment_settings s
                                               where s.place_id = m.place_id and s.loyalty_cards) then
    return public.story_reward_reject(m.id, 'off', p_now);
  end if;
  -- The amount promised at the first check.
  select lower(coalesce(pr.currency, 'mxn')) into v_currency from public.profiles pr where pr.id = m.place_id;
  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, story_mention_id, livemode, available_at)
  values (m.consumer_id, m.place_id, 'story', m.reward_cents, coalesce(v_currency, 'mxn'), m.id, m.livemode, p_now)
  on conflict do nothing;
  update public.story_mentions
     set state = 'rewarded', decided_at = p_now, ai_claimed_at = null
   where id = m.id;
  return jsonb_build_object('ok', true, 'outcome', 'rewarded', 'amount_cents', m.reward_cents,
    'available_at', p_now, 'consumer_id', m.consumer_id, 'place_id', m.place_id);
end;
$function$;

-- Claims up to p_limit verified stories whose recheck is due (a 5-minute
-- lease, like story_ai_claim).
create or replace function public.story_recheck_claim(p_limit integer)
 returns table (id uuid, source text, media_url text, mentioned_at timestamptz)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
#variable_conflict use_column
begin
  return query
  with due as (
    select m.id
      from public.story_mentions m
     where m.state = 'verified' and m.recheck_at <= now()
       and (m.ai_claimed_at is null or m.ai_claimed_at < now() - interval '5 minutes')
     order by m.recheck_at
     limit greatest(least(p_limit, 50), 1)
     for update skip locked
  )
  update public.story_mentions m
     set ai_claimed_at = now()
    from due
   where m.id = due.id
  returning m.id, m.source, m.media_url, m.mentioned_at;
end;
$function$;

-- ── Access: service_role only, as every story and wallet writer ────────────
revoke all on function public.wallet_credit_purchase(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.wallet_credit_purchase(uuid, text, timestamptz) to service_role;
revoke all on function public.wallet_refund_purchase(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.wallet_refund_purchase(uuid, integer, text) to service_role;
revoke all on function public.pay_tab_grant_cashback(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_tab_grant_cashback(uuid, timestamptz) to service_role;
revoke all on function public.story_reward_reject(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.story_reward_reject(uuid, text, timestamptz) to service_role;
revoke all on function public.story_reward_grant(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.story_reward_grant(uuid, uuid, timestamptz) to service_role;
revoke all on function public.story_reward_pay(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.story_reward_pay(uuid, timestamptz) to service_role;
revoke all on function public.story_recheck_claim(integer) from public, anon, authenticated;
grant execute on function public.story_recheck_claim(integer) to service_role;

comment on function public.pay_tab_grant_cashback(uuid, timestamptz) is
  'MESITA-4698, MESITA-4709, MESITA-4717: one paid bill''s cashback: the Welcome (first paid bill here) or Returning rate of the place on cash_bill_cents + card_bill_cents, capped, Pending 1 hour; none where Loyalty Cards is Off, on a bill that already has one, or on a second bill the same Monterrey day. Reason = the line. Internal.';
comment on function public.story_reward_grant(uuid, uuid, timestamptz) is
  'MESITA-4714, MESITA-4717: a story''s first check passed: verified, no money yet; recheck_at = +10 h (at most 23 h after posting; emulator +2 min); rejected (no_guest, off, repeat) instead when it cannot pay. Internal.';
comment on function public.story_reward_pay(uuid, timestamptz) is
  'MESITA-4717: a verified story still up at its recheck: one story entry of the amount stored at the first check, Available at once; rejected (off, no_guest) instead. Internal.';
comment on function public.story_recheck_claim(integer) is
  'MESITA-4717: up to p_limit verified stories whose recheck is due, leased 5 minutes. Internal.';

-- MESITA-4527: Stories audit fixes (money). Pato, 2026-11-21: "Audit Stories
-- end to end", then "Yes, fix all". The AI verification bot is a separate PR.
--
--   1. story_drop takes the re-check's lock order and checks the ticket's
--      purchase again after locking; a voucher freed by a delete takes a
--      story already found at that place (story_create).
--   2. story_settle reads the mention: a story deleted mid-check is void.
--   3. wallet_override_story acts on the voucher's live ticket, not any
--      ticket; release on a voucher with no ticket pays the bonus once.
--   4. A refund void keeps mention_id, and the purge keeps every mention a
--      ticket holds, void included, so one story never pays two vouchers.
--   5. story_review refuses a ticket no voucher holds.

-- 1.
create or replace function public.story_drop(p_mention uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  m public.story_mentions;
  s public.stories;
  v public.wallet_purchases;
  v_purchase uuid;
  v_try integer := 0;
  v_res jsonb;
begin
  select * into m from public.story_mentions where id = p_mention for update;
  if m.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if m.deleted_at is null then
    update public.story_mentions set deleted_at = now() where id = m.id;
  end if;
  -- MESITA-4527: the same lock order as story_settle (purchase, wallet_lock,
  -- story), so a delete and the re-check never deadlock. The ticket's
  -- purchase is read first, locked, then checked again under the story lock.
  loop
    select purchase_id into v_purchase from public.stories where mention_id = m.id;
    if v_purchase is not null then
      select * into v from public.wallet_purchases where id = v_purchase for update;
      perform public.wallet_lock(v.consumer_id, v.place_id);
    end if;
    select * into s from public.stories where mention_id = m.id for update;
    exit when s.id is null or s.purchase_id is not distinct from v_purchase;
    v_try := v_try + 1;
    if v_try >= 2 then
      return jsonb_build_object('ok', false, 'code', 'conflict', 'story_id', s.id);
    end if;
  end loop;
  if s.id is null then
    return jsonb_build_object('ok', true, 'outcome', 'deleted', 'mention_id', m.id);
  end if;
  if s.state = 'approved' and s.purchase_id is not null then
    v_res := public.story_settle(s.id, false, true);
    -- The voucher is free again: a story already found at that place takes it.
    perform public.story_create(s.purchase_id);
    return v_res;
  end if;
  if s.state in ('waiting_post', 'found') then
    update public.stories
       set state = 'void', void_reason = 'deleted', decided_at = now(), updated_at = now()
     where id = s.id;
    return jsonb_build_object('ok', true, 'outcome', 'voided', 'reason', 'deleted', 'story_id', s.id, 'purchase_id', s.purchase_id);
  end if;
  return jsonb_build_object('ok', true, 'outcome', 'unchanged', 'state', s.state, 'story_id', s.id);
end;
$function$;
revoke all on function public.story_drop(uuid) from public, anon, authenticated;
grant execute on function public.story_drop(uuid) to service_role;

-- 2.
create or replace function public.story_settle(p_story uuid, p_reachable boolean, p_deleted boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_purchase uuid;
  v public.wallet_purchases;
  s public.stories;
  v_now timestamptz := now();
  v_tries integer;
  v_deleted boolean := coalesce(p_deleted, false);
begin
  select purchase_id into v_purchase from public.stories where id = p_story;
  if v_purchase is null then
    return jsonb_build_object('ok', false, 'code', 'not_attached');
  end if;
  select * into v from public.wallet_purchases where id = v_purchase for update;
  perform public.wallet_lock(v.consumer_id, v.place_id);
  select * into s from public.stories where id = p_story for update;

  if s.state in ('released', 'void') then
    return jsonb_build_object('ok', true, 'outcome', 'already_decided', 'state', s.state, 'reason', s.void_reason);
  end if;
  if s.state <> 'approved' then
    return jsonb_build_object('ok', false, 'code', 'not_approved');
  end if;
  if v.status <> 'paid' then
    return jsonb_build_object('ok', true, 'outcome', 'not_paid');
  end if;
  -- MESITA-4527: a story deleted while the re-check fetched it is deleted,
  -- whatever the fetch said. Read under the purchase and story locks.
  if s.mention_id is not null and exists (
    select 1 from public.story_mentions where id = s.mention_id and deleted_at is not null) then
    v_deleted := true;
  end if;

  if p_reachable and not v_deleted then
    if s.bonus_cents > 0 and not exists (
      select 1 from public.wallet_entries where purchase_id = v.id and kind = 'bonus') then
      insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
      values (v.consumer_id, v.place_id, 'bonus', s.bonus_cents, v.currency, v.id, v.livemode, v_now);
    end if;
    update public.stories set state = 'released', decided_at = v_now, updated_at = v_now where id = s.id;
    return jsonb_build_object('ok', true, 'outcome', 'released', 'bonus_cents', s.bonus_cents,
      'story_id', s.id, 'purchase_id', s.purchase_id, 'place_id', s.place_id, 'livemode', s.livemode);
  end if;

  if v_deleted then
    update public.stories set state = 'void', void_reason = 'deleted', decided_at = v_now, updated_at = v_now where id = s.id;
    return jsonb_build_object('ok', true, 'outcome', 'voided', 'reason', 'deleted',
      'story_id', s.id, 'purchase_id', s.purchase_id, 'place_id', s.place_id, 'livemode', s.livemode);
  end if;

  v_tries := s.recheck_tries + 1;
  if v_tries >= 3 then
    update public.stories
       set recheck_tries = v_tries, state = 'void', void_reason = 'unreachable', decided_at = v_now, updated_at = v_now
     where id = s.id;
    return jsonb_build_object('ok', true, 'outcome', 'voided', 'reason', 'unreachable', 'tries', v_tries,
      'story_id', s.id, 'purchase_id', s.purchase_id, 'place_id', s.place_id, 'livemode', s.livemode);
  end if;
  update public.stories
     set recheck_tries = v_tries, recheck_at = v_now + interval '10 minutes', updated_at = v_now
   where id = s.id;
  return jsonb_build_object('ok', true, 'outcome', 'retry', 'tries', v_tries, 'recheck_at', v_now + interval '10 minutes',
    'story_id', s.id);
end;
$function$;
revoke all on function public.story_settle(uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function public.story_settle(uuid, boolean, boolean) to service_role;

-- 3.
create or replace function public.wallet_override_story(p_purchase uuid, p_action text, p_actor uuid default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_purchases;
  s public.stories;
  v_now timestamptz := now();
  v_live integer;
  v_unspent integer;
  v_rev integer := 0;
begin
  if p_action is null or p_action not in ('release', 'void') then
    return jsonb_build_object('ok', false, 'code', 'bad_request');
  end if;
  select * into v from public.wallet_purchases where id = p_purchase and voucher = 'voucher_story' for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);
  -- MESITA-4527: a voucher can hold several tickets (voided ones and one
  -- live one). Act on the live ticket, else the newest.
  select * into s from public.stories
   where purchase_id = v.id
   order by (state <> 'void') desc, created_at desc
   limit 1
   for update;
  if s.id is null then
    if p_action = 'void' then
      return jsonb_build_object('ok', false, 'code', 'no_story');
    end if;
    if v.status <> 'paid' then
      return jsonb_build_object('ok', false, 'code', case when v.status in ('refunded', 'partly_refunded') then 'refunded' else 'not_paid' end);
    end if;
    -- Release with no ticket: pay the bonus once and record a released ticket.
    if v.bonus_cents > 0 and not exists (
      select 1 from public.wallet_entries where purchase_id = v.id and kind = 'bonus') then
      insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
      values (v.consumer_id, v.place_id, 'bonus', v.bonus_cents, v.currency, v.id, v.livemode, v_now);
    end if;
    insert into public.stories (purchase_id, consumer_id, place_id, livemode, state, deadline_at, first_bound_at, decided_at, bonus_cents)
    values (v.id, v.consumer_id, v.place_id, v.livemode, 'released', 'infinity', v_now, v_now, v.bonus_cents)
    returning * into s;
    return jsonb_build_object('ok', true, 'outcome', 'released', 'story_id', s.id, 'place_id', s.place_id, 'livemode', s.livemode);
  end if;

  if p_action = 'release' then
    if s.state = 'released' then
      return jsonb_build_object('ok', true, 'outcome', 'already_released', 'story_id', s.id);
    end if;
    if v.status <> 'paid' then
      return jsonb_build_object('ok', false, 'code', case when v.status in ('refunded', 'partly_refunded') then 'refunded' else 'not_paid' end);
    end if;
    -- A void that reversed a paid bonus cannot be lifted.
    if s.state = 'void' and exists (select 1 from public.wallet_entries where purchase_id = v.id and kind = 'bonus') then
      return jsonb_build_object('ok', false, 'code', 'already_decided');
    end if;
    if s.bonus_cents > 0 and not exists (
      select 1 from public.wallet_entries where purchase_id = v.id and kind = 'bonus') then
      insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
      values (v.consumer_id, v.place_id, 'bonus', s.bonus_cents, v.currency, v.id, v.livemode, v_now);
    end if;
    update public.stories
       set state = 'released', void_reason = null, decided_at = v_now, updated_at = v_now
     where id = s.id;
    return jsonb_build_object('ok', true, 'outcome', 'released', 'story_id', s.id, 'place_id', s.place_id, 'livemode', s.livemode);
  end if;

  if s.state = 'void' then
    return jsonb_build_object('ok', true, 'outcome', 'already_void', 'reason', s.void_reason, 'story_id', s.id);
  end if;
  if s.state = 'released' then
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
  update public.stories
     set state = 'void', void_reason = 'operator', decided_at = v_now, updated_at = v_now
   where id = s.id;
  return jsonb_build_object('ok', true, 'outcome', 'voided', 'reversed_cents', v_rev, 'story_id', s.id,
    'place_id', s.place_id, 'livemode', s.livemode);
end;
$function$;
revoke all on function public.wallet_override_story(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.wallet_override_story(uuid, text, uuid) to service_role;

-- 4 and 5.
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

  -- What should be gone in total once this refund is applied, minus what is
  -- already gone. A STORY counts only what its ledger holds (MESITA-4264).
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

  -- Any refund before the bonus is decided voids the Story, so the re-check
  -- never releases a bonus the refund did not count. MESITA-4527: the void
  -- keeps mention_id, so the same story never attaches to another voucher.
  if v_story then
    update public.stories
       set state = 'void', void_reason = 'refunded', decided_at = now(), updated_at = now()
     where purchase_id = v.id and state in ('waiting_post', 'found', 'approved');
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'applied', 'delta_cents', v_delta,
    'reversed_cents', v_reversed, 'uncovered_cents', v_to_reverse - v_reversed, 'status', v_status);
end;
$function$;
revoke all on function public.wallet_refund_purchase(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.wallet_refund_purchase(uuid, integer, text) to service_role;

create or replace function public.story_review(p_token text, p_place uuid, p_approve boolean, p_device_hash text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_mid uuid;
  s public.stories;
  m public.story_mentions;
  r record;
  v_now timestamptz := now();
begin
  select id into v_mid from public.story_mentions where review_token = p_token;
  if v_mid is null then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  select * into s from public.stories where mention_id = v_mid for update;
  select * into m from public.story_mentions where id = v_mid for update;
  if m.id is null then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  if m.review_place_id is distinct from p_place then
    return jsonb_build_object('ok', false, 'code', 'wrong_place');
  end if;
  if m.review = 'approved' and p_approve then
    return jsonb_build_object('ok', true, 'outcome', 'already_approved', 'mention_id', m.id, 'reviewed_at', m.reviewed_at, 'story_id', s.id);
  end if;
  if m.review = 'rejected' and not p_approve then
    return jsonb_build_object('ok', true, 'outcome', 'already_rejected', 'mention_id', m.id, 'reviewed_at', m.reviewed_at);
  end if;
  if m.review is not null then
    return jsonb_build_object('ok', false, 'code', 'already_decided', 'review', m.review);
  end if;
  if s.id is null or s.state <> 'found' or s.deadline_at <= v_now then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  -- MESITA-4527: a waiter never approves a story no voucher holds.
  if s.purchase_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_attached');
  end if;
  select * into r from public.story_rules();
  if p_approve and m.mentioned_at + interval '24 hours' < v_now + r.bonus_wait + r.check_margin then
    return jsonb_build_object('ok', false, 'code', 'story_too_old');
  end if;

  update public.story_mentions
     set review = case when p_approve then 'approved' else 'rejected' end,
         reviewed_at = v_now,
         review_device_hash = p_device_hash
   where id = m.id;
  if p_approve then
    update public.stories
       set state = 'approved', approved_at = v_now, approved_device_hash = p_device_hash,
           recheck_at = v_now + public.story_wait_for(s.livemode, m.id), wait_sec = extract(epoch from public.story_wait_for(s.livemode, m.id))::int,
           recheck_tries = 0, updated_at = v_now
     where id = s.id
     returning * into s;
  else
    update public.stories
       set state = 'waiting_post', mention_id = null, updated_at = v_now
     where id = s.id
     returning * into s;
  end if;
  return jsonb_build_object('ok', true, 'outcome', case when p_approve then 'approved' else 'rejected' end,
    'mention_id', m.id, 'reviewed_at', v_now, 'story_id', s.id, 'purchase_id', s.purchase_id,
    'place_id', s.place_id, 'livemode', s.livemode, 'state', s.state, 'recheck_at', s.recheck_at, 'wait_sec', s.wait_sec);
end;
$function$;
revoke all on function public.story_review(text, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.story_review(text, uuid, boolean, text) to service_role;

create or replace function public.wallet_purge_story_mentions(p_before timestamptz)
 returns integer
 language sql
 security definer
 set search_path to 'public'
as $function$
  with gone as (
    delete from public.story_mentions m
     where m.purchase_id is null and m.mentioned_at < p_before
       and not exists (select 1 from public.stories s where s.mention_id = m.id)
       and not exists (
         select 1 from public.wallet_purchases p
          where p.story_mention_id = m.id and p.status not in ('failed', 'expired', 'refunded'))
    returning 1
  )
  select count(*)::int from gone;
$function$;
revoke all on function public.wallet_purge_story_mentions(timestamptz) from public, anon, authenticated;
grant execute on function public.wallet_purge_story_mentions(timestamptz) to service_role;

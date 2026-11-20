-- MESITA-4484: the story ticket is born when a story is detected, not when
-- the voucher is paid. The bonus clock starts at publication.
--
-- Pato, 2026-11-20: pay, credit now, post one story tagging @mesita and the
-- restaurant and keep it up, cashback by itself. No screenshot, no check-in.
-- 30 seconds only for an emulator story; 3 hours from publication otherwise.
-- A deleted story frees the voucher for another post, on that post's clock.
-- No 12-hour post window and no 24-hour mention gate on this path.
-- Other vouchers are untouched (wallet_credit_purchase's non-story branch).

alter table public.stories alter column purchase_id drop not null;
alter table public.stories alter column place_id drop not null;
-- A voided ticket keeps its purchase_id for the audit, and must not block the
-- next story on the same voucher (MESITA-4484). PostgreSQL unique allows
-- many nulls, so unattached tickets are fine.
alter table public.stories drop constraint if exists stories_purchase_id_key;
create unique index if not exists stories_live_purchase_idx
  on public.stories (purchase_id)
  where purchase_id is not null and state <> 'void';
alter table public.story_mentions
  add column if not exists tagged_place_id uuid references public.places (id);

comment on column public.story_mentions.tagged_place_id is
  'MESITA-4484: the restaurant this story tagged, alongside @mesita. The emulator sets it; Meta does not send it until the webhook can.';
comment on column public.stories.deadline_at is
  'MESITA-4484: no post deadline. New tickets use infinity. A finite deadline is a legacy row the expire sweep may still void.';

-- ── Detect: one ticket per mention, attach to an open voucher ───────────────
create or replace function public.story_detect(p_mention uuid, p_place uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  m public.story_mentions;
  s public.stories;
  v public.wallet_purchases;
  v_consumer uuid;
  v_wait interval;
  v_now timestamptz := now();
begin
  select * into m from public.story_mentions where id = p_mention for update;
  if m.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  select * into s from public.stories where mention_id = m.id;
  if s.id is not null then
    return jsonb_build_object('ok', true, 'outcome', 'duplicate', 'story_id', s.id,
      'state', s.state, 'purchase_id', s.purchase_id, 'recheck_at', s.recheck_at, 'wait_sec', s.wait_sec);
  end if;

  if p_place is not null then
    update public.story_mentions
       set tagged_place_id = p_place
     where id = m.id and (tagged_place_id is null or tagged_place_id = p_place);
    m.tagged_place_id := p_place;
  end if;

  select c.id into v_consumer
    from public.consumers c
   where c.instagram_handle = m.ig_handle and c.deleted_at is null
   limit 1;

  v_wait := public.story_wait_for(m.livemode, m.id);

  if m.deleted_at is not null then
    insert into public.stories (
      consumer_id, place_id, livemode, state, deadline_at, mention_id, first_bound_at,
      decided_at, void_reason, bonus_cents)
    values (
      v_consumer, m.tagged_place_id, m.livemode, 'void', 'infinity', m.id, v_now,
      v_now, 'deleted', 0)
    returning * into s;
    return jsonb_build_object('ok', true, 'outcome', 'voided', 'reason', 'deleted',
      'story_id', s.id, 'state', s.state, 'purchase_id', s.purchase_id);
  end if;

  if v_consumer is not null and m.tagged_place_id is not null then
    select p.* into v
      from public.wallet_purchases p
     where p.consumer_id = v_consumer
       and p.place_id = m.tagged_place_id
       and p.voucher = 'voucher_story'
       and p.livemode = m.livemode
       and p.status = 'paid'
       and not exists (
         select 1 from public.stories o
          where o.purchase_id = p.id and o.state <> 'void')
     order by p.paid_at nulls last, p.created_at
     limit 1
     for update of p skip locked;
  end if;

  begin
    if v.id is not null then
      insert into public.stories (
        purchase_id, consumer_id, place_id, livemode, state, deadline_at,
        mention_id, first_bound_at, approved_at, recheck_at, wait_sec, bonus_cents)
      values (
        v.id, v.consumer_id, v.place_id, v.livemode, 'approved', 'infinity',
        m.id, v_now, m.mentioned_at, m.mentioned_at + v_wait,
        extract(epoch from v_wait)::int, v.bonus_cents)
      returning * into s;
    else
      insert into public.stories (
        consumer_id, place_id, livemode, state, deadline_at,
        mention_id, first_bound_at, bonus_cents)
      values (
        v_consumer, m.tagged_place_id, m.livemode, 'found', 'infinity',
        m.id, v_now, 0)
      returning * into s;
    end if;
  exception when unique_violation then
    select * into s from public.stories where mention_id = m.id;
    return jsonb_build_object('ok', true, 'outcome', 'duplicate', 'story_id', s.id,
      'state', s.state, 'purchase_id', s.purchase_id);
  end;

  return jsonb_build_object('ok', true,
    'outcome', case when v.id is not null then 'attached' else 'unattached' end,
    'story_id', s.id, 'state', s.state, 'purchase_id', s.purchase_id,
    'recheck_at', s.recheck_at, 'wait_sec', s.wait_sec);
end;
$function$;
revoke all on function public.story_detect(uuid, uuid) from public, anon, authenticated;
grant execute on function public.story_detect(uuid, uuid) to service_role;

-- The webhook still calls this. It has no restaurant tag, so the ticket is
-- recorded and left unattached until a later detect names the place.
create or replace function public.story_bind_handle(p_mention uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r jsonb;
begin
  r := public.story_detect(p_mention, null);
  if coalesce(r ->> 'ok', 'false') <> 'true' or r ->> 'story_id' is null then
    return r;
  end if;
  return r || jsonb_build_object('outcome', 'found');
end;
$function$;

-- Paying the voucher does not create a story ticket. If a detected story is
-- already waiting for this guest at this restaurant, it attaches now and
-- keeps the clock it was given at publication.
create or replace function public.story_create(p_purchase uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_purchases;
  s public.stories;
  m public.story_mentions;
  v_wait interval;
  v_now timestamptz := now();
begin
  select * into v from public.wallet_purchases where id = p_purchase for update;
  if v.id is null or v.voucher is distinct from 'voucher_story' then
    return jsonb_build_object('ok', false, 'code', 'not_story');
  end if;
  select * into s from public.stories
   where purchase_id = v.id and state <> 'void'
   order by created_at desc
   limit 1;
  if s.id is not null then
    return jsonb_build_object('ok', true, 'outcome', 'exists', 'story_id', s.id, 'state', s.state, 'purchase_id', s.purchase_id);
  end if;

  select s2.* into s
    from public.stories s2
    join public.story_mentions mm on mm.id = s2.mention_id
   where s2.purchase_id is null
     and s2.state = 'found'
     and s2.consumer_id = v.consumer_id
     and s2.place_id = v.place_id
     and s2.livemode = v.livemode
     and mm.deleted_at is null
   order by mm.mentioned_at desc
   limit 1
   for update of s2 skip locked;
  if s.id is null then
    return jsonb_build_object('ok', true, 'outcome', 'voucher_only');
  end if;
  select * into m from public.story_mentions where id = s.mention_id;
  v_wait := public.story_wait_for(v.livemode, m.id);
  update public.stories
     set purchase_id = v.id,
         state = 'approved',
         approved_at = m.mentioned_at,
         recheck_at = m.mentioned_at + v_wait,
         wait_sec = extract(epoch from v_wait)::int,
         bonus_cents = v.bonus_cents,
         updated_at = v_now
   where id = s.id
   returning * into s;
  return jsonb_build_object('ok', true, 'outcome', 'attached', 'story_id', s.id,
    'state', s.state, 'purchase_id', s.purchase_id, 'recheck_at', s.recheck_at, 'wait_sec', s.wait_sec);
end;
$function$;

-- Credit still pays the voucher now. The returned story is voucher_only
-- until a mention attaches, or the attached story's state.
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
  v_story jsonb;
begin
  select * into v from public.wallet_purchases where id = p_purchase_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.status in ('paid', 'refunded', 'partly_refunded', 'needs_review') then
    return jsonb_build_object('ok', true, 'outcome', 'already_paid');
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);

  if v.voucher = 'voucher_story' and v.story_mention_id is not null and v.status in ('failed', 'expired')
     and exists (select 1 from public.wallet_purchases o
                  where o.story_mention_id = v.story_mention_id and o.id <> v.id
                    and o.status not in ('failed', 'expired', 'refunded')) then
    update public.wallet_purchases set story_mention_id = null where id = v.id;
  end if;

  update public.wallet_purchases
     set status = 'paid', paid_at = now(), updated_at = now(),
         stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id)
   where id = p_purchase_id;

  if v.voucher = 'voucher_story' then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'voucher', v.amount_cents, v.currency, v.id, v.livemode, least(v_at, now()));
    v_story := public.story_create(v.id);
    return jsonb_build_object('ok', true, 'outcome', 'credited',
      'story', coalesce(v_story ->> 'state', 'voucher_only'),
      'story_id', v_story ->> 'story_id');
  end if;

  v_kind := case when v.voucher is null then 'prepay' else 'voucher' end;
  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
  values (v.consumer_id, v.place_id, v_kind, v.amount_cents, v.currency, v.id, v.livemode, least(v_at, now()));
  if v.bonus_cents > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'bonus', v.bonus_cents, v.currency, v.id, v.livemode, v_at);
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'credited');
end;
$function$;
revoke all on function public.wallet_credit_purchase(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.wallet_credit_purchase(uuid, text, timestamptz) to service_role;

-- Delete frees the voucher at once. The bonus is not paid.
create or replace function public.story_drop(p_mention uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  m public.story_mentions;
  s public.stories;
begin
  select * into m from public.story_mentions where id = p_mention for update;
  if m.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if m.deleted_at is null then
    update public.story_mentions set deleted_at = now() where id = m.id;
  end if;
  select * into s from public.stories where mention_id = m.id for update;
  if s.id is null then
    return jsonb_build_object('ok', true, 'outcome', 'deleted', 'mention_id', m.id);
  end if;
  if s.state = 'approved' and s.purchase_id is not null then
    return public.story_settle(s.id, false, true);
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

-- The re-check no longer treats a 24-hour-old story as still up.
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

  if p_reachable and not p_deleted then
    if s.bonus_cents > 0 and not exists (
      select 1 from public.wallet_entries where purchase_id = v.id and kind = 'bonus') then
      insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
      values (v.consumer_id, v.place_id, 'bonus', s.bonus_cents, v.currency, v.id, v.livemode, v_now);
    end if;
    update public.stories set state = 'released', decided_at = v_now, updated_at = v_now where id = s.id;
    return jsonb_build_object('ok', true, 'outcome', 'released', 'bonus_cents', s.bonus_cents,
      'story_id', s.id, 'purchase_id', s.purchase_id, 'place_id', s.place_id, 'livemode', s.livemode);
  end if;

  if p_deleted then
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

create or replace function public.story_settle_emulated_due(p_story uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_purchase uuid;
  v public.wallet_purchases;
  s public.stories;
  m public.story_mentions;
begin
  select * into s from public.stories where id = p_story;
  if s.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if s.purchase_id is null or s.state <> 'approved' or s.livemode or s.recheck_at is null or s.recheck_at > now() then
    return jsonb_build_object('ok', true, 'outcome', 'not_due', 'state', s.state);
  end if;
  v_purchase := s.purchase_id;
  select * into v from public.wallet_purchases where id = v_purchase for update;
  perform public.wallet_lock(v.consumer_id, v.place_id);
  select * into s from public.stories where id = p_story for update;
  select * into m from public.story_mentions where id = s.mention_id;
  if s.state <> 'approved' or s.livemode or s.recheck_at > now()
     or not public.story_emulator_on() or m.id is null or m.source <> 'emulator' then
    return jsonb_build_object('ok', true, 'outcome', 'not_due', 'state', s.state);
  end if;
  return public.story_settle(s.id, m.deleted_at is null, m.deleted_at is not null);
end;
$function$;

-- A paid Story voucher with no story yet is waiting for a post, not a broken
-- legacy row. The one-time move skips it.
create or replace function public.stories_move_legacy()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  p record;
  r record;
  m public.story_mentions;
  v_state text;
  v_reason text;
  v_n integer := 0;
begin
  select * into r from public.story_rules();
  for p in
    select w.* from public.wallet_purchases w
     where w.voucher = 'voucher_story'
       and w.status in ('paid', 'refunded', 'partly_refunded', 'needs_review')
       and not exists (select 1 from public.stories s where s.purchase_id = w.id)
     order by w.paid_at nulls last, w.id
  loop
    select * into m from public.story_mentions where purchase_id = p.id;
    v_reason := null;
    if p.story_bonus = 'released' then
      v_state := 'released';
    elsif p.story_bonus = 'void' then
      v_state := 'void';
      v_reason := case
        when p.story_bonus_void_reason in ('unreachable', 'expired', 'refunded', 'operator') then p.story_bonus_void_reason
        when p.story_bonus_void_reason in ('no_mention', 'mention_lost', 'not_verified') then 'operator'
      end;
      if v_reason is null then
        raise exception 'stories_move_legacy: purchase % has void reason %', p.id, p.story_bonus_void_reason;
      end if;
    elsif p.story_activated_at is not null and m.id is not null then
      v_state := 'approved';
    else
      continue;
    end if;
    insert into public.stories (purchase_id, consumer_id, place_id, livemode, state, deadline_at, mention_id, first_bound_at,
                                approved_at, approved_device_hash, recheck_at, recheck_tries, decided_at, void_reason, bonus_cents,
                                created_at)
    values (p.id, p.consumer_id, p.place_id, p.livemode, v_state,
            'infinity',
            m.id,
            case when m.id is not null then coalesce(p.story_activated_at, p.paid_at, now()) end,
            case when m.id is not null or v_state = 'approved' then coalesce(m.reviewed_at, p.story_activated_at) end,
            m.review_device_hash,
            case when v_state = 'approved' then coalesce(p.story_recheck_at, now()) end,
            coalesce(p.story_recheck_tries, 0),
            case when v_state in ('released', 'void') then coalesce(p.story_bonus_decided_at, now()) end,
            v_reason,
            p.bonus_cents,
            coalesce(p.paid_at, p.created_at));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$function$;

comment on function public.story_detect(uuid, uuid) is
  'MESITA-4484: one story ticket per mention. Attaches it to the oldest paid Story voucher of that handle at the tagged restaurant that has no live story. The bonus clock is mentioned_at + story_wait_for (30 s for an emulator mention in emulator mode, otherwise 3 h). A second call is duplicate. Service role only.';
comment on function public.story_drop(uuid) is
  'MESITA-4484: marks the mention deleted and voids the ticket (deleted) so the voucher can take another story. Service role only.';
comment on function public.story_create(uuid) is
  'MESITA-4484: the credit does not create a story ticket. Attaches an already detected story of this guest at this restaurant, keeping its publication clock. Otherwise voucher_only. Service role only.';

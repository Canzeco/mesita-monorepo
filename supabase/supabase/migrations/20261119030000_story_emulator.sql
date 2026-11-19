-- MESITA-4426 — Stories emulator mode: test every Story workflow in minutes.
--
-- Admin › Configurations › Stories gets an Emulator card. Three new
-- money_config keys, written only through money_config_merge_story:
--   story_emulator                   boolean, default false
--   story_emulator_bonus_wait_sec    whole seconds, clamped 10..600 (30)
--   story_emulator_post_window_sec   whole seconds, clamped 60..3600 (120)
--
-- The emulator is EFFECTIVE only while payments are in Stripe test mode and
-- Meta is off (the EFs decide that: storyEligibilityContext). In SQL, every
-- emulator rule ALSO requires a non-livemode Story, so real money never gets
-- an emulator wait or window whatever the switch says:
--   story_post_window_for(livemode)  the deadline window at purchase
--   story_wait_for(livemode, mention) the bonus wait at approval: the
--                                    emulator wait only for a mention whose
--                                    source is 'emulator'
-- A Story keeps the wait and window it was given (deadline_at and the new
-- stories.wait_sec are stored), so flipping the switch never moves one.
--
-- The Story screen's poll (consumer-web-check-story) can now finish a test
-- Story itself instead of waiting for the 10-minute cron:
--   story_settle_emulated_due(story) releases or voids an approved, due,
--     non-livemode Story bound to an emulator mention, with the switch on.
--     It takes story_settle's locks in story_settle's order (the purchase
--     row, wallet_lock, then the Story) before checking, then calls
--     story_settle, so it can never deadlock against the cron. Anything
--     else answers not_due and changes nothing.
--   story_expire_one(story) is story_expire_sweep for one Story.

-- ── 1. The Story's own wait ──────────────────────────────────────────────────
alter table public.stories add column if not exists wait_sec integer;
comment on column public.stories.wait_sec is
  'MESITA-4426: the bonus wait this Story was given at approval (story_wait_for), so the screen states it and a later switch flip never moves it.';

-- ── 2. The rules ─────────────────────────────────────────────────────────────
create or replace function public.story_emulator_on()
 returns boolean
 language sql
 stable
 set search_path to 'public'
as $function$
  select coalesce((select jsonb_typeof(c.money_config -> 'story_emulator') = 'boolean' and (c.money_config ->> 'story_emulator')::boolean
                     from public.app_config c where c.id = 1), false);
$function$;

create or replace function public.story_post_window_for(p_livemode boolean)
 returns interval
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare
  v jsonb;
begin
  if not coalesce(p_livemode, true) and public.story_emulator_on() then
    select c.money_config -> 'story_emulator_post_window_sec' into v from public.app_config c where c.id = 1;
    return make_interval(secs => least(greatest(case when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric else 120 end, 60), 3600));
  end if;
  return (select r.post_window from public.story_rules() r);
end;
$function$;

create or replace function public.story_wait_for(p_livemode boolean, p_mention uuid)
 returns interval
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare
  v jsonb;
begin
  if not coalesce(p_livemode, true) and public.story_emulator_on()
     and exists (select 1 from public.story_mentions m where m.id = p_mention and m.source = 'emulator') then
    select c.money_config -> 'story_emulator_bonus_wait_sec' into v from public.app_config c where c.id = 1;
    return make_interval(secs => least(greatest(case when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric else 30 end, 10), 600));
  end if;
  return (select r.bonus_wait from public.story_rules() r);
end;
$function$;

revoke all on function public.story_emulator_on() from public, anon, authenticated;
revoke all on function public.story_post_window_for(boolean) from public, anon, authenticated;
revoke all on function public.story_wait_for(boolean, uuid) from public, anon, authenticated;
grant execute on function public.story_emulator_on() to service_role;
grant execute on function public.story_post_window_for(boolean) to service_role;
grant execute on function public.story_wait_for(boolean, uuid) to service_role;

-- ── 3. Create and review use them (otherwise unchanged) ─────────────────────
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
  r record;
  v_handle text;
  v_now timestamptz := now();
begin
  select * into v from public.wallet_purchases where id = p_purchase;
  if v.id is null or v.voucher is distinct from 'voucher_story' then
    return jsonb_build_object('ok', false, 'code', 'not_story');
  end if;
  select * into s from public.stories where purchase_id = v.id;
  if s.id is not null then
    return jsonb_build_object('ok', true, 'outcome', 'exists', 'story_id', s.id, 'state', s.state);
  end if;
  select * into r from public.story_rules();
  insert into public.stories (purchase_id, consumer_id, place_id, livemode, state, deadline_at, bonus_cents)
  values (v.id, v.consumer_id, v.place_id, v.livemode, 'waiting_post', coalesce(v.paid_at, v_now) + public.story_post_window_for(v.livemode), v.bonus_cents)
  returning * into s;

  if v.story_mention_id is not null then
    select * into m from public.story_mentions where id = v.story_mention_id for update;
    select lower(instagram_handle) into v_handle from public.consumers where id = v.consumer_id;
    if m.id is not null and v_handle is not null and m.ig_handle = v_handle and m.livemode = v.livemode
       and m.review = 'approved' and m.review_place_id = v.place_id
       and m.mentioned_at + interval '24 hours' >= v_now + r.bonus_wait + r.credit_margin
       and not exists (select 1 from public.stories o where o.mention_id = m.id) then
      update public.stories
         set state = 'approved', mention_id = m.id, first_bound_at = v_now, approved_at = coalesce(m.reviewed_at, v_now), approved_device_hash = m.review_device_hash,
             recheck_at = v_now + public.story_wait_for(v.livemode, m.id), wait_sec = extract(epoch from public.story_wait_for(v.livemode, m.id))::int,
             recheck_tries = 0, updated_at = v_now
       where id = s.id
       returning * into s;
      return jsonb_build_object('ok', true, 'outcome', 'created', 'story_id', s.id, 'state', s.state);
    end if;
    if m.id is not null then
      return jsonb_build_object('ok', true, 'outcome', 'created', 'story_id', s.id,
        'state', (public.story_bind(s.id, m.id) ->> 'state'));
    end if;
  end if;
  return jsonb_build_object('ok', true, 'outcome', 'created', 'story_id', s.id, 'state', s.state);
end;
$function$;
revoke all on function public.story_create(uuid) from public, anon, authenticated;
grant execute on function public.story_create(uuid) to service_role;

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

-- ── 4. The merge RPC takes the emulator keys ───────────────────────────────
create or replace function public.money_config_merge_story(p_patch jsonb, p_updated_by uuid default null)
 returns jsonb
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_story_keys constant text[] := array['story_min_followers', 'story_emulator', 'story_emulator_bonus_wait_sec',
                                        'story_emulator_post_window_sec', 'story_bonus_wait_sec', 'story_post_window_sec',
                                        'story_credit_margin_sec', 'story_check_margin_sec', 'story_recheck_meta'];
  v_old jsonb;
  v_new jsonb;
  v_clean jsonb := '{}'::jsonb;
  v_key text;
  v_val jsonb;
  v_num numeric;
  v_lo numeric;
  v_hi numeric;
  v_at timestamptz;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'patch must be a JSON object' using errcode = '22023';
  end if;
  for v_key, v_val in select * from jsonb_each(p_patch) loop
    if v_key = 'story_emulator' then
      if jsonb_typeof(v_val) <> 'boolean' then
        raise exception 'story_emulator must be true or false' using errcode = '22023';
      end if;
      v_clean := v_clean || jsonb_build_object(v_key, v_val);
      continue;
    end if;
    case v_key
      when 'story_min_followers' then v_lo := 0; v_hi := 1000000;
      when 'story_emulator_bonus_wait_sec' then v_lo := 10; v_hi := 600;
      when 'story_emulator_post_window_sec' then v_lo := 60; v_hi := 3600;
      else raise exception 'unknown key %', v_key using errcode = '22023';
    end case;
    if jsonb_typeof(v_val) <> 'number' then
      raise exception '% must be a whole number', v_key using errcode = '22023';
    end if;
    v_num := (v_val #>> '{}')::numeric;
    if v_num <> trunc(v_num) then
      raise exception '% must be a whole number', v_key using errcode = '22023';
    end if;
    v_clean := v_clean || jsonb_build_object(v_key, least(greatest(v_num, v_lo), v_hi)::int);
  end loop;
  if v_clean = '{}'::jsonb then
    raise exception 'nothing to save' using errcode = '22023';
  end if;

  select coalesce(money_config, '{}'::jsonb) into v_old from public.app_config where id = 1 for update;
  if not found then
    raise exception 'app_config missing' using errcode = 'P0002';
  end if;
  update public.app_config
     set money_config = v_old || v_clean,
         updated_by = p_updated_by,
         updated_at = now()
   where id = 1
   returning money_config, updated_at into v_new, v_at;

  return jsonb_build_object(
    'before', (select coalesce(jsonb_object_agg(k, v_old -> k), '{}'::jsonb) from unnest(v_story_keys) k where v_old ? k),
    'after', (select coalesce(jsonb_object_agg(k, v_new -> k), '{}'::jsonb) from unnest(v_story_keys) k where v_new ? k),
    'updated_at', v_at
  );
end;
$function$;
revoke all on function public.money_config_merge_story(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.money_config_merge_story(jsonb, uuid) to service_role;

-- ── 5. The screen settles a due test Story ───────────────────────────────────
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
  -- A cheap look first: most polls are not due and take no lock.
  select * into s from public.stories where id = p_story;
  if s.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if s.state <> 'approved' or s.livemode or s.recheck_at is null or s.recheck_at > now() then
    return jsonb_build_object('ok', true, 'outcome', 'not_due', 'state', s.state);
  end if;
  -- story_settle's lock order: the purchase row, wallet_lock, then the Story.
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
revoke all on function public.story_settle_emulated_due(uuid) from public, anon, authenticated;
grant execute on function public.story_settle_emulated_due(uuid) to service_role;

-- ── 6. The screen expires its own Story past the deadline ───────────────────
-- story_expire_sweep for one Story: one late bind (a story posted in time
-- counts as posted), then void expired. Money is untouched: the credit stays.
create or replace function public.story_expire_one(p_story uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  s public.stories;
  v_now timestamptz := now();
begin
  select * into s from public.stories where id = p_story;
  if s.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if s.state not in ('waiting_post', 'found') or s.deadline_at > v_now then
    return jsonb_build_object('ok', true, 'outcome', 'not_due', 'state', s.state);
  end if;
  perform public.story_bind(s.id, null, true);
  select * into s from public.stories where id = p_story for update;
  if s.state not in ('waiting_post', 'found') or s.deadline_at > v_now then
    return jsonb_build_object('ok', true, 'outcome', 'not_due', 'state', s.state);
  end if;
  update public.stories
     set state = 'void', void_reason = 'expired', decided_at = v_now, updated_at = v_now
   where id = s.id;
  return jsonb_build_object('ok', true, 'outcome', 'expired', 'story_id', s.id, 'purchase_id', s.purchase_id,
    'place_id', s.place_id, 'livemode', s.livemode, 'was_bound', s.first_bound_at is not null);
end;
$function$;
revoke all on function public.story_expire_one(uuid) from public, anon, authenticated;
grant execute on function public.story_expire_one(uuid) to service_role;

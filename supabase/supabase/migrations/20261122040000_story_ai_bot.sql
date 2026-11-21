-- MESITA-4535: the AI bot verifies every story in the background.
-- Pato, 2026-11-21: "THE STORIES MUST BE AUTOMATICALLY VERIFIED BY AN AI BOT
-- IN THE BACKGROUND." Approved plan (autoplan, gate `rec`).
--
-- Meta's story_mention event proves @mesita; the bot's job is the
-- restaurant. The cron claims unchecked Meta mentions, the model answers
-- whether the restaurant of the guest's open Story voucher is tagged (an
-- @handle or a location sticker), and story_ai_verdict decides here, in SQL:
-- one place → the ticket attaches (clock from publication); none → rejected
-- with a reason; several → ambiguous. A story the bot cannot read is never
-- paid without a person. Videos are rejected with "post a photo story"
-- until frames are built (MESITA-4539).

-- ── 1. Columns ───────────────────────────────────────────────────────────────
alter table public.story_mentions
  add column if not exists ai_media_path text,
  add column if not exists ai_tries integer not null default 0,
  add column if not exists ai_claimed_at timestamptz,
  add column if not exists ai_checked_at timestamptz,
  add column if not exists ai_outcome text,
  add column if not exists ai_reason text,
  add column if not exists ai_verdict jsonb,
  add column if not exists ai_model text,
  add column if not exists ai_last_error text,
  add column if not exists reachable_at_bonus boolean,
  add column if not exists probed_at timestamptz,
  add column if not exists ai_reviewed_at timestamptz,
  add column if not exists media_purged_at timestamptz;

alter table public.story_mentions drop constraint if exists story_mentions_ai_outcome_check;
alter table public.story_mentions add constraint story_mentions_ai_outcome_check
  check (ai_outcome is null or ai_outcome in ('matched', 'rejected', 'ambiguous', 'unreadable'));
alter table public.story_mentions drop constraint if exists story_mentions_ai_tries_check;
alter table public.story_mentions add constraint story_mentions_ai_tries_check check (ai_tries >= 0);

create index if not exists story_mentions_ai_queue_idx
  on public.story_mentions (mentioned_at)
  where ai_checked_at is null and source = 'meta';
create index if not exists story_mentions_ai_claimed_idx
  on public.story_mentions (ai_claimed_at)
  where ai_claimed_at is not null and ai_checked_at is null;

-- A found ticket no voucher takes within the stale window ends 'stale'.
alter table public.stories drop constraint if exists stories_void_reason_check;
alter table public.stories add constraint stories_void_reason_check
  check (void_reason = any (array['expired', 'deleted', 'unreachable', 'refunded', 'operator', 'stale']));

comment on column public.story_mentions.ai_outcome is
  'MESITA-4535: the bot''s decision. matched (attached at tagged_place_id), rejected (ai_reason says why), ambiguous (several places, none decided), unreadable (never paid without an operator).';
comment on column public.story_mentions.ai_media_path is
  'MESITA-4535: the private story-media copy of the story, kept until the retention window after the ticket is decided.';

-- ── 2. The private bucket ───────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('story-media', 'story-media', false)
on conflict (id) do nothing;

-- ── 3. Helpers ──────────────────────────────────────────────────────────────
-- The SQL twin of _shared/place-instagram.ts instagramHandleOfUrl; the same
-- fixtures pin both (story-handle-twin.test.ts and pgTAP).
create or replace function public.instagram_handle_of_url(p_url text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select lower((regexp_match(btrim(p_url),
    '^(?:https?://)?(?:www\.)?instagram\.com/([A-Za-z0-9._]{1,30})/?(?:[?#].*)?$', 'i'))[1]);
$function$;

-- Lowercase, accents stripped, everything but letters and digits removed.
create or replace function public.story_norm(p text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select regexp_replace(
    translate(lower(coalesce(p, '')), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
    '[^a-z0-9]', '', 'g');
$function$;

-- The Story-selling places whose open paid Story voucher this mention's guest
-- holds, in the mention's mode: the narrow question's candidates.
create or replace function public.story_ai_candidates(p_mention uuid)
 returns table (place_id uuid, handle text, name text, google_name text)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select distinct p.place_id, public.instagram_handle_of_url(pr.instagram_url), pr.name, pp.google_name
    from public.story_mentions m
    join public.consumers c on c.instagram_handle = m.ig_handle and c.deleted_at is null
    join public.wallet_purchases p on p.consumer_id = c.id
     and p.voucher = 'voucher_story' and p.status = 'paid' and p.livemode = m.livemode
     and not exists (select 1 from public.stories o where o.purchase_id = p.id and o.state <> 'void')
    left join public.profiles pr on pr.id = p.place_id
    left join public.place_profiles pp on pp.id = p.place_id
   where m.id = p_mention and m.ig_handle is not null;
$function$;
revoke all on function public.story_ai_candidates(uuid) from public, anon, authenticated;
grant execute on function public.story_ai_candidates(uuid) to service_role;

-- ── 4. Config: the bot's switches and limits ────────────────────────────────
create or replace function public.money_config_merge_story(p_patch jsonb, p_updated_by uuid default null)
 returns jsonb
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_story_keys constant text[] := array['story_min_followers', 'story_emulator', 'story_emulator_bonus_wait_sec',
                                        'story_emulator_post_window_sec', 'story_bonus_wait_sec', 'story_post_window_sec',
                                        'story_credit_margin_sec', 'story_check_margin_sec', 'story_recheck_meta',
                                        'story_ai_enabled', 'story_ai_batch', 'story_ai_max_tries', 'story_desk_hours',
                                        'story_media_retention_hours', 'story_stale_days'];
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
    if v_key in ('story_emulator', 'story_ai_enabled', 'story_recheck_meta') then
      if jsonb_typeof(v_val) <> 'boolean' then
        raise exception '% must be true or false', v_key using errcode = '22023';
      end if;
      v_clean := v_clean || jsonb_build_object(v_key, v_val);
      continue;
    end if;
    case v_key
      when 'story_min_followers' then v_lo := 0; v_hi := 1000000;
      when 'story_emulator_bonus_wait_sec' then v_lo := 10; v_hi := 600;
      when 'story_emulator_post_window_sec' then v_lo := 60; v_hi := 3600;
      when 'story_ai_batch' then v_lo := 1; v_hi := 50;
      when 'story_ai_max_tries' then v_lo := 1; v_hi := 10;
      when 'story_desk_hours' then v_lo := 1; v_hi := 168;
      when 'story_media_retention_hours' then v_lo := 24; v_hi := 720;
      when 'story_stale_days' then v_lo := 1; v_hi := 90;
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

-- Defaults for the new keys (kept where already set). story_recheck_meta is
-- turned on: a real story is fetched at its bonus time, never paid blind.
update public.app_config
   set money_config = jsonb_build_object(
         'story_ai_enabled', true, 'story_ai_batch', 20, 'story_ai_max_tries', 3,
         'story_desk_hours', 48, 'story_media_retention_hours', 72, 'story_stale_days', 30)
       || coalesce(money_config, '{}'::jsonb)
       || jsonb_build_object('story_recheck_meta', true)
 where id = 1;

-- ── 5. story_detect: a found ticket with no voucher is upgraded ─────────────
-- The webhook makes a found ticket with no restaurant. When the bot (or the
-- emulator) names the restaurant, the same ticket is upgraded: place and
-- guest set, then the oldest open paid Story voucher of that guest there
-- takes it, on the clock from publication.
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
  v_upgrade boolean := false;
begin
  select * into m from public.story_mentions where id = p_mention for update;
  if m.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  select * into s from public.stories where mention_id = m.id for update;
  if s.id is not null then
    if p_place is null or s.state <> 'found' or s.purchase_id is not null then
      return jsonb_build_object('ok', true, 'outcome', 'duplicate', 'story_id', s.id,
        'state', s.state, 'purchase_id', s.purchase_id, 'recheck_at', s.recheck_at, 'wait_sec', s.wait_sec);
    end if;
    v_upgrade := true;
  end if;

  if p_place is not null then
    update public.story_mentions set tagged_place_id = p_place where id = m.id;
    m.tagged_place_id := p_place;
  end if;

  select c.id into v_consumer
    from public.consumers c
   where c.instagram_handle = m.ig_handle and c.deleted_at is null
   order by c.instagram_verified_at desc nulls last
   limit 1;

  v_wait := public.story_wait_for(m.livemode, m.id);

  if not v_upgrade and m.deleted_at is not null then
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

  if v_consumer is not null and m.tagged_place_id is not null and m.deleted_at is null then
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

  if v_upgrade then
    if v.id is not null then
      update public.stories
         set purchase_id = v.id, consumer_id = v.consumer_id, place_id = v.place_id,
             state = 'approved', approved_at = m.mentioned_at, recheck_at = m.mentioned_at + v_wait,
             wait_sec = extract(epoch from v_wait)::int, bonus_cents = v.bonus_cents, updated_at = v_now
       where id = s.id
       returning * into s;
    else
      update public.stories
         set consumer_id = coalesce(v_consumer, consumer_id), place_id = m.tagged_place_id, updated_at = v_now
       where id = s.id
       returning * into s;
    end if;
  else
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
  end if;

  return jsonb_build_object('ok', true,
    'outcome', case when v.id is not null then 'attached' else 'unattached' end,
    'story_id', s.id, 'state', s.state, 'purchase_id', s.purchase_id,
    'recheck_at', s.recheck_at, 'wait_sec', s.wait_sec);
end;
$function$;
revoke all on function public.story_detect(uuid, uuid) from public, anon, authenticated;
grant execute on function public.story_detect(uuid, uuid) to service_role;

-- ── 6. Claim, unclaim, fail ─────────────────────────────────────────────────
-- Claims spend a try at claim time; claims older than 15 minutes are
-- claimable again; a mention at its last try becomes unreadable here, in the
-- same transaction, so no race can retry it past the limit.
create or replace function public.story_ai_claim(p_limit integer, p_max_tries integer)
 returns setof public.story_mentions
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update public.story_mentions
     set ai_checked_at = now(), ai_outcome = 'unreadable', ai_claimed_at = null,
         ai_reason = coalesce(ai_last_error, 'max_tries')
   where ai_checked_at is null and source = 'meta' and ai_tries >= greatest(p_max_tries, 1)
     and (ai_claimed_at is null or ai_claimed_at < now() - interval '15 minutes');
  return query
  update public.story_mentions m
     set ai_tries = m.ai_tries + 1, ai_claimed_at = now()
   where m.id in (
     select x.id from public.story_mentions x
      where x.ai_checked_at is null and x.source = 'meta' and x.deleted_at is null
        and x.ai_tries < greatest(p_max_tries, 1)
        and (x.ai_claimed_at is null or x.ai_claimed_at < now() - interval '15 minutes')
      order by x.mentioned_at
      limit greatest(least(p_limit, 50), 0)
      for update skip locked)
  returning m.*;
end;
$function$;
revoke all on function public.story_ai_claim(integer, integer) from public, anon, authenticated;
grant execute on function public.story_ai_claim(integer, integer) to service_role;

-- A claim the budget never started gives its try back.
create or replace function public.story_ai_unclaim(p_ids uuid[])
 returns integer
 language sql
 security definer
 set search_path to 'public'
as $function$
  with u as (
    update public.story_mentions
       set ai_tries = greatest(ai_tries - 1, 0), ai_claimed_at = null
     where id = any(p_ids) and ai_checked_at is null and ai_claimed_at is not null
    returning 1)
  select count(*)::int from u;
$function$;
revoke all on function public.story_ai_unclaim(uuid[]) from public, anon, authenticated;
grant execute on function public.story_ai_unclaim(uuid[]) to service_role;

-- A failed try records why; a final failure is unreadable at once.
create or replace function public.story_ai_fail(p_mention uuid, p_error text, p_final boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update public.story_mentions
     set ai_last_error = left(p_error, 300),
         ai_claimed_at = null,
         ai_checked_at = case when p_final then now() else ai_checked_at end,
         ai_outcome = case when p_final then 'unreadable' else ai_outcome end,
         ai_reason = case when p_final then left(p_error, 120) else ai_reason end
   where id = p_mention and ai_checked_at is null;
  return jsonb_build_object('ok', found);
end;
$function$;
revoke all on function public.story_ai_fail(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.story_ai_fail(uuid, text, boolean) to service_role;

-- ── 7. The verdict ──────────────────────────────────────────────────────────
-- p_verdict is the model's answer, stored raw. Modes:
--   narrow: {"mode":"narrow","looks_like_story":b,"candidates":[{"place_id","handle_visible","location_visible"}]}
--   open:   {"mode":"open","looks_like_story":b,"place_handles":[…],"location_names":[…]}
--   video:  {"mode":"video"}   (rejected: post a photo story)
-- SQL decides; `notes` is never read.
create or replace function public.story_ai_verdict(p_mention uuid, p_verdict jsonb, p_model text, p_force boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  m public.story_mentions;
  s public.stories;
  v_mode text := coalesce(p_verdict ->> 'mode', 'open');
  v_looks boolean := coalesce((p_verdict ->> 'looks_like_story')::boolean, true);
  v_places uuid[];
  v_open uuid[];
  v_place uuid;
  v_outcome text;
  v_reason text;
  v_detect jsonb;
begin
  if p_verdict is null or jsonb_typeof(p_verdict) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'bad_verdict');
  end if;
  select * into m from public.story_mentions where id = p_mention for update;
  if m.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  select * into s from public.stories where mention_id = m.id;
  if m.ai_checked_at is not null and not coalesce(p_force, false) then
    return jsonb_build_object('ok', true, 'outcome', 'already_checked', 'ai_outcome', m.ai_outcome);
  end if;
  if coalesce(p_force, false) and s.id is not null and (s.purchase_id is not null or s.state in ('released', 'void')) then
    return jsonb_build_object('ok', false, 'code', 'locked', 'state', s.state);
  end if;

  select coalesce(array_agg(c.place_id), '{}') into v_open from public.story_ai_candidates(m.id) c;

  if v_mode = 'video' then
    v_outcome := 'rejected'; v_reason := 'video';
  elsif not v_looks then
    v_outcome := 'rejected'; v_reason := 'not_a_story';
  elsif v_mode = 'narrow' then
    select coalesce(array_agg(distinct (e ->> 'place_id')::uuid), '{}') into v_places
      from jsonb_array_elements(coalesce(p_verdict -> 'candidates', '[]'::jsonb)) e
     where ((e ->> 'handle_visible')::boolean is true or (e ->> 'location_visible')::boolean is true)
       and (e ->> 'place_id') ~ '^[0-9a-f-]{36}$'
       and (e ->> 'place_id')::uuid = any(v_open);
  else
    -- Open extraction: Story-selling places by handle or location name.
    select coalesce(array_agg(distinct x.place_id), '{}') into v_places
      from (
        select ps.place_id
          from public.place_payment_settings ps
          join public.profiles pr on pr.id = ps.place_id
          left join public.place_profiles pp on pp.id = ps.place_id
         where ps.voucher_story
           and (
             public.instagram_handle_of_url(pr.instagram_url) in (
               select lower(ltrim(h, '@')) from jsonb_array_elements_text(coalesce(p_verdict -> 'place_handles', '[]'::jsonb)) h)
             or exists (
               select 1 from jsonb_array_elements_text(coalesce(p_verdict -> 'location_names', '[]'::jsonb)) l,
                      unnest(array[public.story_norm(pr.name), public.story_norm(pp.google_name)]) n
                where n <> '' and (public.story_norm(l) = n
                       or (length(n) >= 8 and position(n in public.story_norm(l)) > 0)))
           )
      ) x;
    -- Several places: the one where the guest holds an open voucher decides.
    if cardinality(v_places) > 1 and cardinality(array(select unnest(v_places) intersect select unnest(v_open))) = 1 then
      v_places := array(select unnest(v_places) intersect select unnest(v_open));
      v_reason := 'several_places_one_voucher';
    end if;
  end if;

  if v_outcome is null then
    if cardinality(v_places) = 1 then
      v_outcome := 'matched'; v_place := v_places[1];
    elsif cardinality(v_places) > 1 then
      v_outcome := 'ambiguous'; v_reason := 'several_places';
    else
      v_outcome := 'rejected'; v_reason := 'no_tag';
    end if;
  end if;

  update public.story_mentions
     set ai_verdict = p_verdict, ai_model = left(p_model, 80), ai_checked_at = now(),
         ai_outcome = v_outcome, ai_reason = v_reason, ai_claimed_at = null
   where id = m.id;

  if v_outcome = 'matched' then
    v_detect := public.story_detect(m.id, v_place);
  end if;

  return jsonb_build_object('ok', true, 'outcome', v_outcome, 'reason', v_reason,
    'place_id', v_place, 'detect', v_detect);
end;
$function$;
revoke all on function public.story_ai_verdict(uuid, jsonb, text, boolean) from public, anon, authenticated;
grant execute on function public.story_ai_verdict(uuid, jsonb, text, boolean) to service_role;

-- ── 8. Sweeps the cron runs ─────────────────────────────────────────────────
-- Desk time limit: an ambiguous or unreadable story nobody attached within
-- the desk hours is rejected (an unreadable story is never paid unread).
create or replace function public.story_ai_desk_sweep(p_hours integer)
 returns integer
 language sql
 security definer
 set search_path to 'public'
as $function$
  with u as (
    update public.story_mentions m
       set ai_outcome = 'rejected', ai_reason = 'desk_timeout_' || m.ai_outcome
     where m.ai_outcome in ('ambiguous', 'unreadable')
       and m.ai_checked_at < now() - make_interval(hours => greatest(p_hours, 1))
       and not exists (select 1 from public.stories s where s.mention_id = m.id and s.purchase_id is not null)
    returning 1)
  select count(*)::int from u;
$function$;
revoke all on function public.story_ai_desk_sweep(integer) from public, anon, authenticated;
grant execute on function public.story_ai_desk_sweep(integer) to service_role;

-- Stale: a found ticket no voucher took ends 'stale'; a mention only void
-- tickets hold keeps (source, ig_story_id) and loses the guest's handle.
create or replace function public.story_ai_stale_sweep(p_days integer)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  n integer;
begin
  update public.stories s
     set state = 'void', void_reason = 'stale', decided_at = now(), updated_at = now()
   where s.state = 'found' and s.purchase_id is null
     and s.created_at < now() - make_interval(days => greatest(p_days, 1));
  get diagnostics n = row_count;
  update public.story_mentions m
     set ig_handle = null, sender_igsid = null
   where m.mentioned_at < now() - make_interval(days => greatest(p_days, 1))
     and (m.ig_handle is not null or m.sender_igsid is not null)
     and not exists (select 1 from public.stories s where s.mention_id = m.id and s.state <> 'void');
  return n;
end;
$function$;
revoke all on function public.story_ai_stale_sweep(integer) from public, anon, authenticated;
grant execute on function public.story_ai_stale_sweep(integer) to service_role;

-- Media past retention: decided tickets after p_hours, unattached mentions
-- after the stale window. The cron deletes the files, then marks them gone.
create or replace function public.story_ai_media_due(p_hours integer, p_days integer, p_limit integer)
 returns table (mention_id uuid, path text)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select m.id, m.ai_media_path
    from public.story_mentions m
    left join public.stories s on s.mention_id = m.id
   where m.ai_media_path is not null and m.media_purged_at is null
     and (
       (s.decided_at is not null and s.decided_at < now() - make_interval(hours => greatest(p_hours, 1)))
       or m.mentioned_at < now() - make_interval(days => greatest(p_days, 1))
     )
   order by m.mentioned_at
   limit greatest(p_limit, 0);
$function$;
revoke all on function public.story_ai_media_due(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.story_ai_media_due(integer, integer, integer) to service_role;

-- Still-up probe for stories nobody attached by their bonus time, so a late
-- operator attach settles on what was true then (Instagram drops a story
-- after 24 hours).
create or replace function public.story_ai_probe_due(p_limit integer)
 returns setof public.story_mentions
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select m.*
    from public.story_mentions m
   where m.source = 'meta' and m.probed_at is null and m.deleted_at is null and m.media_url is not null
     and m.mentioned_at + public.story_wait_for(m.livemode, m.id) <= now()
     and m.mentioned_at > now() - interval '24 hours'
     and not exists (select 1 from public.stories s where s.mention_id = m.id and s.purchase_id is not null)
   order by m.mentioned_at
   limit greatest(p_limit, 0);
$function$;
revoke all on function public.story_ai_probe_due(integer) from public, anon, authenticated;
grant execute on function public.story_ai_probe_due(integer) to service_role;

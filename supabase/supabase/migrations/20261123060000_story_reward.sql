-- MESITA-4714 — POST: A PLACE PAYS A GUEST FOR AN INSTAGRAM STORY. Pato,
-- 2026-11-23: "20 OR 50, can setup in business console". The Offers page's
-- third tab (Prepay · Pay · Post). No purchase and no voucher: the guest posts
-- a story tagging @mesita and the place; Meta tells Mesita (story_mention);
-- the AI checks the place is tagged; the place's story reward lands as credit
-- 3 hours later. The Story voucher (MESITA-4641/4642, tag `stories-final`)
-- tied a story to a paid purchase; that model is gone, its rows are test-only
-- and outdated ("don't persist outdated data"), so both old tables go.
--
-- 1. place_cashback_settings.story_reward_cents and cashback_defaults
--    .story_reward_cents: one of 0 (Off) · 2000 · 5000, default 2000 (MX$20).
--    place_cashback_rates returns it (same fallback order: the place's row,
--    else cashback_defaults, else 2000).
-- 2. public.stories (one per Story purchase) and the old public.story_mentions
--    are dropped; a new public.story_mentions holds one row per story that
--    tagged @mesita (Meta's webhook, or the test-mode emulator): its sender,
--    the guest it matched, the place the check found, and its state
--    checking → rewarded | rejected.
-- 3. wallet_entries.story_mention_id and the kind 'story' (one per mention,
--    tied to it the way 'cashback' is tied to its bill through tab_id).
-- 4. story_reward_grant: the one writer (security definer, service_role
--    only). A story pays the place's story_reward_cents at verification
--    time, Pending 3 hours, only where Loyalty Cards is On and the reward is
--    not Off, at most one per guest per place per 7 days. story_reward_reject
--    closes a mention without money. The AI queue: story_ai_claim,
--    story_ai_fail, story_ai_verdict (matches the handles and location names
--    the model read to the places that pay for stories) and
--    story_mentions_expire.
-- 5. The cron `verify-stories` calls supabase-cron-verify-stories every 10
--    minutes. Kill switch: select cron.unschedule('verify-stories');
--
-- Rollback: unschedule the cron; drop the functions, the kind (no 'story'
-- entry may exist), wallet_entries.story_mention_id, story_mentions and the
-- two story_reward_cents columns; place_cashback_rates from 20261123050000.

-- ── 1. The reward an owner sets ─────────────────────────────────────────────
alter table public.place_cashback_settings
  add column if not exists story_reward_cents integer not null default 2000
  constraint place_cashback_settings_story_reward_check check (story_reward_cents in (0, 2000, 5000));
alter table public.cashback_defaults
  add column if not exists story_reward_cents integer not null default 2000
  constraint cashback_defaults_story_reward_check check (story_reward_cents in (0, 2000, 5000));

comment on column public.place_cashback_settings.story_reward_cents is
  'MESITA-4714: what a verified Instagram story tagging @mesita and this place pays the guest, in the place''s currency cents: 0 (Off), 2000 or 5000. Paid only where Loyalty Cards is On (story_reward_grant).';
comment on column public.cashback_defaults.story_reward_cents is
  'MESITA-4714: the story reward every place without its own place_cashback_settings row reads: 0 (Off), 2000 or 5000 cents.';

drop function if exists public.place_cashback_rates(uuid);
create function public.place_cashback_rates(p_place_id uuid)
 returns table (welcome_bps integer, returning_bps integer, cap_cents integer, story_reward_cents integer)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select coalesce(s.welcome_bps, d.welcome_bps, 1000), coalesce(s.returning_bps, d.returning_bps, 500),
         coalesce(s.cap_cents, d.cap_cents, 20000), coalesce(s.story_reward_cents, d.story_reward_cents, 2000)
    from (select 1) one
    left join public.cashback_defaults d on d.id
    left join public.place_cashback_settings s on s.place_id = p_place_id;
$function$;
revoke all on function public.place_cashback_rates(uuid) from public, anon, authenticated;
grant execute on function public.place_cashback_rates(uuid) to service_role;
comment on function public.place_cashback_rates(uuid) is
  'MESITA-4698, MESITA-4700, MESITA-4709, MESITA-4714: what binds a place now (Welcome, Returning, cap, story reward): its own row, else cashback_defaults, else 10/5 %, MX$200, MX$20. Internal.';

-- ── 2. The mentions ─────────────────────────────────────────────────────────
-- Test-only, outdated rows of the Story voucher: nothing reads them.
drop table if exists public.stories cascade;
drop table if exists public.story_mentions cascade;

create table public.story_mentions (
  id             uuid primary key default gen_random_uuid(),
  source         text not null check (source in ('meta', 'emulator')),
  ig_story_id    text not null check (length(ig_story_id) between 1 and 512),
  sender_igsid   text,
  ig_handle      text check (ig_handle is null or ig_handle = lower(ig_handle)),
  consumer_id    uuid references public.consumers (id) on delete set null,
  place_id       uuid references public.places (id) on delete set null,
  media_url      text check (media_url is null or media_url ~ '^https://'),
  media_kind     text not null default 'image' check (media_kind in ('image', 'video')),
  mentioned_at   timestamptz not null default now(),
  livemode       boolean not null,
  state          text not null default 'checking' check (state in ('checking', 'rewarded', 'rejected')),
  reject_reason  text check (reject_reason in (
                   'no_guest', 'no_tag', 'several_places', 'not_a_story', 'video',
                   'unreadable', 'off', 'repeat', 'expired')),
  reward_cents   integer check (reward_cents is null or reward_cents > 0),
  decided_at     timestamptz,
  ai_tries       integer not null default 0 check (ai_tries >= 0),
  ai_claimed_at  timestamptz,
  ai_checked_at  timestamptz,
  ai_model       text,
  ai_verdict     jsonb,
  ai_last_error  text,
  created_at     timestamptz not null default now(),
  unique (source, ig_story_id),
  constraint story_mentions_rejected_chk check ((state = 'rejected') = (reject_reason is not null)),
  constraint story_mentions_decided_chk check ((state = 'checking') = (decided_at is null)),
  constraint story_mentions_rewarded_chk check ((state = 'rewarded') = (reward_cents is not null and consumer_id is not null and place_id is not null))
);

create index story_mentions_checking_idx on public.story_mentions (mentioned_at) where state = 'checking';
create index story_mentions_handle_idx on public.story_mentions (ig_handle) where state = 'checking';
create index story_mentions_guest_idx on public.story_mentions (consumer_id, place_id, mentioned_at desc);

alter table public.story_mentions enable row level security;
revoke all on table public.story_mentions from public, anon, authenticated;
grant all on table public.story_mentions to service_role;

comment on table public.story_mentions is
  'MESITA-4714: one Instagram story that tagged @mesita (Meta''s story_mention webhook, or the test-mode emulator). Matched to the guest whose verified instagram_handle posted it, checked by the AI (supabase-cron-verify-stories) for the place''s tag, then rewarded (one wallet_entries row of kind story) or rejected with a reason. EF-only.';

-- ── 3. The ledger learns the story reward ──────────────────────────────────
alter table public.wallet_entries add column if not exists story_mention_id uuid
  references public.story_mentions (id) on delete restrict;
comment on column public.wallet_entries.story_mention_id is
  'MESITA-4714: the verified Instagram story (story_mentions) a story entry was earned on; null for every other kind.';

alter table public.wallet_entries drop constraint wallet_entries_kind_chk;
alter table public.wallet_entries drop constraint wallet_entries_kind_shape_chk;
alter table public.wallet_entries add constraint wallet_entries_kind_chk check (kind = any (array[
  'prepay', 'voucher', 'bonus', 'extra', 'cashback', 'story', 'spend', 'reversal', 'refund', 'gift_out', 'gift_in', 'gift_back']));
alter table public.wallet_entries add constraint wallet_entries_kind_shape_chk check (
case kind
    when 'prepay' then ((amount_cents > 0) and (purchase_id is not null) and (payment_id is null) and (gift_id is null))
    when 'voucher' then ((amount_cents > 0) and (purchase_id is not null) and (payment_id is null) and (gift_id is null))
    when 'bonus' then ((amount_cents > 0) and (purchase_id is not null) and (payment_id is null) and (gift_id is null))
    -- 'extra': legacy credit from the cashback retired by MESITA-4194; nothing writes it.
    when 'extra' then ((amount_cents > 0) and ((payment_id is null) <> (purchase_id is null)) and (gift_id is null))
    -- 'cashback' (MESITA-4698): earned on one paid bill.
    when 'cashback' then ((amount_cents > 0) and (tab_id is not null) and (purchase_id is null) and (payment_id is null) and (gift_id is null))
    -- 'story' (MESITA-4714): earned on one verified Instagram story.
    when 'story' then ((amount_cents > 0) and (story_mention_id is not null) and (tab_id is null) and (purchase_id is null) and (payment_id is null) and (gift_id is null))
    when 'spend' then ((amount_cents < 0) and (payment_id is not null) and (purchase_id is null) and (gift_id is null))
    when 'reversal' then ((amount_cents < 0) and ((purchase_id is not null) or (payment_id is not null)) and (gift_id is null))
    when 'refund' then ((amount_cents > 0) and (payment_id is not null) and (purchase_id is null) and (gift_id is null))
    when 'gift_out' then ((amount_cents < 0) and (gift_id is not null) and (purchase_id is null) and (payment_id is null))
    when 'gift_in' then ((amount_cents > 0) and (gift_id is not null) and (purchase_id is null) and (payment_id is null))
    when 'gift_back' then ((amount_cents > 0) and (gift_id is not null) and (purchase_id is null) and (payment_id is null))
    else false
end);

-- Only a story entry names a story.
alter table public.wallet_entries add constraint wallet_entries_story_only_chk
  check (story_mention_id is null or kind = 'story');

-- One reward per story, enforced where two checks could race.
create unique index if not exists wallet_entries_story_once_idx
  on public.wallet_entries (story_mention_id) where kind = 'story';
-- The 7-day window's read.
create index if not exists wallet_entries_story_guest_idx
  on public.wallet_entries (consumer_id, place_id, created_at desc) where kind = 'story';

-- ── 4. Paying it ───────────────────────────────────────────────────────────
-- A place's Instagram username from its profile URL (kept from MESITA-4535).
create or replace function public.instagram_handle_of_url(p_url text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select lower((regexp_match(btrim(p_url),
    '^(?:https?://)?(?:www\.)?instagram\.com/([A-Za-z0-9._]{1,30})/?(?:[?#].*)?$', 'i'))[1]);
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
  if m.state <> 'checking' then
    return jsonb_build_object('ok', true, 'outcome', m.state, 'already', true);
  end if;
  update public.story_mentions
     set state = 'rejected', reject_reason = p_reason, decided_at = p_now, ai_claimed_at = null
   where id = m.id;
  return jsonb_build_object('ok', true, 'outcome', 'rejected', 'reason', p_reason);
end;
$function$;
revoke all on function public.story_reward_reject(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.story_reward_reject(uuid, text, timestamptz) to service_role;

-- THE ONE WRITER. p_place is the place the check found (or the emulator's).
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
  v_currency text;
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

  -- At most one per guest per place per 7 days.
  if exists (select 1 from public.wallet_entries e
              where e.consumer_id = v_consumer and e.place_id = p_place
                and e.livemode = m.livemode and e.kind = 'story'
                and e.created_at > p_now - interval '7 days') then
    return public.story_reward_reject(m.id, 'repeat', p_now);
  end if;

  select lower(coalesce(pr.currency, 'mxn')) into v_currency from public.profiles pr where pr.id = p_place;

  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, story_mention_id, livemode, available_at)
  values (v_consumer, p_place, 'story', v_cents, coalesce(v_currency, 'mxn'), m.id, m.livemode, p_now + interval '3 hours');

  update public.story_mentions
     set state = 'rewarded', reward_cents = v_cents, decided_at = p_now, ai_claimed_at = null
   where id = m.id;
  return jsonb_build_object('ok', true, 'outcome', 'rewarded', 'amount_cents', v_cents,
    'available_at', p_now + interval '3 hours', 'consumer_id', v_consumer, 'place_id', p_place);
end;
$function$;
revoke all on function public.story_reward_grant(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.story_reward_grant(uuid, uuid, timestamptz) to service_role;
comment on function public.story_reward_grant(uuid, uuid, timestamptz) is
  'MESITA-4714: one verified story''s reward: the place''s story_reward_cents now, Pending 3 hours, one wallet_entries row of kind story tied to the mention; rejected (no_guest, off, repeat) when no verified guest posted it, Loyalty Cards is Off or the reward is Off, or the guest was rewarded at this place in the last 7 days. The one writer. Internal.';

-- ── The AI queue ───────────────────────────────────────────────────────────
-- Claims up to p_limit image mentions still checking whose sender is a
-- verified guest (strangers wait for the expiry sweep, never the model).
create or replace function public.story_ai_claim(p_limit integer, p_max_tries integer)
 returns table (id uuid, media_url text, media_kind text, ai_tries integer)
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
     where m.state = 'checking' and m.source = 'meta'
       and m.ai_tries < greatest(p_max_tries, 1)
       and (m.ai_claimed_at is null or m.ai_claimed_at < now() - interval '5 minutes')
       and (m.consumer_id is not null or exists (
             select 1 from public.consumers c
              where lower(c.instagram_handle) = m.ig_handle
                and c.instagram_verified_at is not null and c.deleted_at is null))
     order by m.mentioned_at
     limit greatest(least(p_limit, 50), 1)
     for update skip locked
  )
  update public.story_mentions m
     set ai_claimed_at = now(), ai_tries = m.ai_tries + 1,
         consumer_id = coalesce(m.consumer_id, (
           select c.id from public.consumers c
            where lower(c.instagram_handle) = m.ig_handle
              and c.instagram_verified_at is not null and c.deleted_at is null
            order by c.instagram_verified_at desc
            limit 1))
    from due
   where m.id = due.id
  returning m.id, m.media_url, m.media_kind, m.ai_tries;
end;
$function$;
revoke all on function public.story_ai_claim(integer, integer) from public, anon, authenticated;
grant execute on function public.story_ai_claim(integer, integer) to service_role;

create or replace function public.story_ai_fail(p_mention uuid, p_error text, p_final boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update public.story_mentions
     set ai_last_error = left(p_error, 300), ai_claimed_at = null
   where id = p_mention and state = 'checking';
  if p_final then
    return public.story_reward_reject(p_mention, 'unreadable');
  end if;
  return jsonb_build_object('ok', true, 'outcome', 'retry');
end;
$function$;
revoke all on function public.story_ai_fail(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.story_ai_fail(uuid, text, boolean) to service_role;

-- The model only reads; this decides. p_verdict: { mode: 'open' | 'video',
-- looks_like_story, place_handles[], location_names[] }.
create or replace function public.story_ai_verdict(p_mention uuid, p_verdict jsonb, p_model text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  m public.story_mentions;
  v_places uuid[];
begin
  if p_verdict is null or jsonb_typeof(p_verdict) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'bad_verdict');
  end if;
  select * into m from public.story_mentions where id = p_mention;
  if m.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if m.state <> 'checking' then
    return jsonb_build_object('ok', true, 'outcome', m.state, 'already', true);
  end if;
  update public.story_mentions
     set ai_verdict = p_verdict, ai_model = left(p_model, 80), ai_checked_at = now()
   where id = m.id;

  if coalesce(p_verdict ->> 'mode', 'open') = 'video' then
    return public.story_reward_reject(m.id, 'video');
  end if;
  if not coalesce((p_verdict ->> 'looks_like_story')::boolean, true) then
    return public.story_reward_reject(m.id, 'not_a_story');
  end if;

  -- The places that pay for stories, by @handle or a location sticker's name.
  select coalesce(array_agg(distinct pr.id), '{}') into v_places
    from public.profiles pr
    join public.place_payment_settings ps on ps.place_id = pr.id and ps.loyalty_cards
   where (select r.story_reward_cents from public.place_cashback_rates(pr.id) r) > 0
     and (
       public.instagram_handle_of_url(pr.instagram_url) in (
         select lower(ltrim(btrim(h), '@')) from jsonb_array_elements_text(coalesce(p_verdict -> 'place_handles', '[]'::jsonb)) h)
       or exists (
         select 1 from jsonb_array_elements_text(coalesce(p_verdict -> 'location_names', '[]'::jsonb)) l
          where length(btrim(coalesce(pr.name, ''))) >= 3
            and lower(btrim(l)) = lower(btrim(pr.name)))
     );

  if cardinality(v_places) = 1 then
    return public.story_reward_grant(m.id, v_places[1]);
  elsif cardinality(v_places) > 1 then
    return public.story_reward_reject(m.id, 'several_places');
  end if;
  return public.story_reward_reject(m.id, 'no_tag');
end;
$function$;
revoke all on function public.story_ai_verdict(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.story_ai_verdict(uuid, jsonb, text) to service_role;

-- A story lives 24 hours: one still checking after that is closed (no guest
-- linked the handle, or the check never read it).
create or replace function public.story_mentions_expire(p_now timestamptz default now())
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  n integer := 0;
begin
  for r in
    select m.id, m.consumer_id, m.ig_handle
      from public.story_mentions m
     where m.state = 'checking' and m.mentioned_at < p_now - interval '24 hours'
     order by m.mentioned_at
     limit 200
  loop
    perform public.story_reward_reject(r.id,
      case when r.consumer_id is null and not exists (
             select 1 from public.consumers c
              where lower(c.instagram_handle) = r.ig_handle and c.instagram_verified_at is not null)
           then 'no_guest' else 'expired' end, p_now);
    n := n + 1;
  end loop;
  return n;
end;
$function$;
revoke all on function public.story_mentions_expire(timestamptz) from public, anon, authenticated;
grant execute on function public.story_mentions_expire(timestamptz) to service_role;

-- ── 5. The cron ────────────────────────────────────────────────────────────
select cron.unschedule('verify-stories')
where exists (select 1 from cron.job where jobname = 'verify-stories');

select cron.schedule(
  'verify-stories',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://yjalywfzdelacdzccpgb.supabase.co/functions/v1/supabase-cron-verify-stories',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'scheduler_service_role_key'
      ),
      'X-Internal-Caller', 'pg_cron'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);

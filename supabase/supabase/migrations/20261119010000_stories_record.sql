-- MESITA-4405: the Story is a record of its own; the Story voucher is money.
--
-- Pato, 2026-11-18: "I think we need a different entity for vouchers and
-- stories to simplify … 1. Pay $X. 2. Get principal immediately. 3. Solve the
-- Story artifact (substeps). 4. Receive bonus." And: "it must be checked by a
-- human, right? Imagine it's not even in the place."
--
--   1. The Story voucher is bought like any voucher: the paid amount lands at
--      once, with no story gate before payment.
--   2. The credit creates one `stories` row, 1:1 with the purchase, in the
--      same transaction: waiting_post, deadline = paid_at + post window (12 h).
--   3. The guest posts; story_bind ties the newest fitting mention of their
--      verified handle to the Story (found) and mints its waiter QR token.
--   4. A waiter of the place approves (approved, recheck_at = approval +
--      bonus wait) or rejects (the mention is rejected AT THIS PLACE only, the
--      Story goes back to waiting_post; the guest posts again).
--   5. The cron re-checks an approved Story at recheck_at (story_settle):
--      released (bonus entry) | void deleted | void unreachable (3 tries).
--   6. A Story still before approved at its deadline turns void expired
--      (story_expire_sweep). A refund voids an open Story (refunded).
--
--   stories                       the Story record (state machine below)
--   story_rules()                 + post_window (money_config.story_post_window_sec,
--                                 default 12 h, clamped 2–24 h)
--   story_create(purchase)        the credit's Story row (+ the old buy's
--                                 reserved mention, for the deploy window)
--   story_bind(story, mention?)   waiting_post → found
--   story_bind_handle(mention)    the webhook's / emulator's auto-bind when
--                                 the handle has exactly one open Story
--   story_review(…)               same signature and codes: found → approved |
--                                 waiting_post (reject)
--   story_settle(story, reachable, deleted)   approved → released | void
--   story_expire_sweep(limit)     waiting_post | found past deadline → void expired
--   wallet_override_story         the operator's release | void, on the Story
--   wallet_refund_purchase        voids an open Story; clawback unchanged
--   wallet_settle_story_recheck   kept: forwards to story_settle
--   story_claim                   kept: forwards to story_create
--   wallet_purge_story_mentions   keeps every mention a non-void Story holds
--   stories_move_legacy()         the one-time data move from the purchase
--
-- States: waiting_post → found → approved → released | void. Terminal states
-- never move, except the operator's release lifting a void that paid nothing.
--
-- Lock order everywhere: the purchase row, then wallet_lock(guest, place),
-- then the Story row, then the mention row. story_bind and story_review take
-- only the Story then the mention.
--
-- The old purchase columns (story_activated_at, story_recheck_at,
-- story_recheck_tries, story_bonus*, story_mention_id) stay readable and
-- writable but nothing new writes them; they are dropped after a live Story
-- is released end to end (an unscheduled follow-up).

-- ── 1. The rules: + post_window ─────────────────────────────────────────────
update public.app_config
   set money_config = coalesce(money_config, '{}'::jsonb) || jsonb_build_object('story_post_window_sec', 43200)
 where id = 1 and not (coalesce(money_config, '{}'::jsonb) ? 'story_post_window_sec');

drop function if exists public.story_rules();
create function public.story_rules()
 returns table (bonus_wait interval, credit_margin interval, check_margin interval, recheck_meta boolean, post_window interval)
 language sql
 stable
 set search_path to 'public'
as $function$
  select
    make_interval(secs => coalesce((c.money_config ->> 'story_bonus_wait_sec')::int, 10800)),
    make_interval(secs => coalesce((c.money_config ->> 'story_credit_margin_sec')::int, 3600)),
    make_interval(secs => coalesce((c.money_config ->> 'story_check_margin_sec')::int, 5400)),
    coalesce((c.money_config ->> 'story_recheck_meta')::boolean, false),
    make_interval(secs => least(greatest(coalesce((c.money_config ->> 'story_post_window_sec')::int, 43200), 7200), 86400))
  from (select 1) one
  left join public.app_config c on c.id = 1;
$function$;
revoke all on function public.story_rules() from public, anon, authenticated;
grant execute on function public.story_rules() to service_role;

-- ── 2. The table ─────────────────────────────────────────────────────────────
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null unique references public.wallet_purchases (id) on delete cascade,
  consumer_id uuid references public.consumers (id) on delete set null,
  place_id uuid not null references public.places (id) on delete restrict,
  livemode boolean not null,
  state text not null default 'waiting_post'
    check (state in ('waiting_post', 'found', 'approved', 'released', 'void')),
  deadline_at timestamptz not null,
  mention_id uuid unique references public.story_mentions (id) on delete set null,
  first_bound_at timestamptz,
  approved_at timestamptz,
  approved_device_hash text,
  recheck_at timestamptz,
  recheck_tries integer not null default 0 check (recheck_tries >= 0),
  decided_at timestamptz,
  void_reason text check (void_reason in ('expired', 'deleted', 'unreachable', 'refunded', 'operator')),
  bonus_cents integer not null check (bonus_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stories_void_reason_chk check ((state = 'void') = (void_reason is not null)),
  constraint stories_decided_chk check ((state in ('released', 'void')) = (decided_at is not null)),
  constraint stories_found_has_mention_chk check (state not in ('found', 'approved') or mention_id is not null),
  constraint stories_approved_chk check (state <> 'approved' or (approved_at is not null and recheck_at is not null)),
  constraint stories_bound_chk check (mention_id is null or first_bound_at is not null)
);

create index stories_open_deadline_idx on public.stories (deadline_at) where state in ('waiting_post', 'found');
create index stories_recheck_idx on public.stories (recheck_at) where state = 'approved';
create index stories_consumer_idx on public.stories (consumer_id, created_at desc);
create index stories_place_idx on public.stories (place_id);

alter table public.stories enable row level security;
revoke all on table public.stories from public, anon, authenticated;
grant all on table public.stories to service_role;

comment on table public.stories is
  'MESITA-4405: one Story per Story-voucher purchase, created by wallet_credit_purchase with the money. waiting_post → found (story_bind ties a mention) → approved (a waiter of the place, story_review) → released (bonus entry, story_settle) | void (expired, deleted, unreachable, refunded, operator). mention_id is the only story-to-Story binding. EF-only.';
comment on column public.stories.deadline_at is
  'MESITA-4405: paid_at + story_rules().post_window. A Story still before approved then turns void expired (story_expire_sweep).';
comment on column public.stories.first_bound_at is
  'MESITA-4405: the first time any mention was bound; never cleared. An expired Story with none frees its visit slot (_shared/vouchers.ts).';
comment on column public.stories.approved_device_hash is
  'MESITA-4405: a hash of the waiter phone''s device id (story_mentions.review_device_hash). Never the staff token.';

-- ── 3. Create on credit ──────────────────────────────────────────────────────
-- Called by wallet_credit_purchase under its locks. Idempotent per purchase.
-- The deploy window: an old buy (before its EF redeployed) reserved a mention
-- on the purchase (story_mention_id); it is bound here, approved when a
-- waiter of this place already approved it, else found.
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
  values (v.id, v.consumer_id, v.place_id, v.livemode, 'waiting_post', coalesce(v.paid_at, v_now) + r.post_window, v.bonus_cents)
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
             recheck_at = v_now + r.bonus_wait, recheck_tries = 0, updated_at = v_now
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

-- ── 4. Bind: waiting_post → found ────────────────────────────────────────────
-- The newest mention of the guest's verified handle that no Story holds, not
-- rejected at THIS place, of the same livemode, not deleted, and young enough
-- to outlive the re-check. p_mention narrows it to one mention (the webhook's).
-- p_any_time lets the expiry sweep bind past the deadline (it then expires
-- the Story anyway; first_bound_at records that a story was posted).
-- Any conflict answers nothing_yet, never an error.
create or replace function public.story_bind(p_story uuid, p_mention uuid default null, p_any_time boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  s public.stories;
  m public.story_mentions;
  r record;
  v_handle text;
  v_now timestamptz := now();
begin
  select * into s from public.stories where id = p_story for update;
  if s.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if s.state <> 'waiting_post' then
    return jsonb_build_object('ok', true, 'outcome', 'unchanged', 'state', s.state, 'mention_id', s.mention_id);
  end if;
  if s.deadline_at <= v_now and not p_any_time then
    return jsonb_build_object('ok', true, 'outcome', 'past_deadline', 'state', s.state);
  end if;
  select lower(instagram_handle) into v_handle from public.consumers where id = s.consumer_id;
  if v_handle is null then
    return jsonb_build_object('ok', true, 'outcome', 'nothing_yet', 'state', s.state);
  end if;
  select * into r from public.story_rules();

  select mm.* into m
    from public.story_mentions mm
   where mm.ig_handle = v_handle
     and mm.livemode = s.livemode
     and (p_mention is null or mm.id = p_mention)
     and mm.deleted_at is null
     and mm.mentioned_at + interval '24 hours' >= v_now + r.bonus_wait + r.check_margin
     and (mm.review is distinct from 'rejected' or mm.review_place_id is distinct from s.place_id)
     and (mm.purchase_id is null or mm.purchase_id = s.purchase_id)
     and not exists (select 1 from public.stories o where o.mention_id = mm.id)
     and not exists (select 1 from public.wallet_purchases p
                      where p.story_mention_id = mm.id and p.id <> s.purchase_id
                        and p.status not in ('failed', 'expired', 'refunded'))
   order by mm.mentioned_at desc
   limit 1
   for update of mm skip locked;
  if m.id is null then
    return jsonb_build_object('ok', true, 'outcome', 'nothing_yet', 'state', s.state);
  end if;

  begin
    -- Point it at this place with a fresh decision; a reject elsewhere does
    -- not count here (Eng: per-place rejects).
    update public.story_mentions
       set review_place_id = s.place_id, review = null, reviewed_at = null, review_device_hash = null,
           review_token = coalesce(review_token, replace(gen_random_uuid()::text, '-', ''))
     where id = m.id
     returning * into m;
    update public.stories
       set state = 'found', mention_id = m.id, first_bound_at = coalesce(first_bound_at, v_now), updated_at = v_now
     where id = s.id
     returning * into s;
  exception when unique_violation then
    return jsonb_build_object('ok', true, 'outcome', 'nothing_yet', 'state', 'waiting_post');
  end;
  return jsonb_build_object('ok', true, 'outcome', 'found', 'state', s.state, 'mention_id', m.id, 'token', m.review_token);
end;
$function$;
revoke all on function public.story_bind(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.story_bind(uuid, uuid, boolean) to service_role;

-- The webhook's and the emulator's bind: the mention's handle has exactly one
-- open waiting_post Story in its livemode (before its deadline). With more,
-- the guest's Story screen binds it to the Story they are looking at.
create or replace function public.story_bind_handle(p_mention uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  m public.story_mentions;
  v_ids uuid[];
begin
  select * into m from public.story_mentions where id = p_mention;
  if m.id is null or m.ig_handle is null then
    return jsonb_build_object('ok', true, 'outcome', 'nothing_yet');
  end if;
  select array_agg(s.id) into v_ids
    from public.stories s
    join public.consumers c on c.id = s.consumer_id
   where lower(c.instagram_handle) = m.ig_handle
     and s.livemode = m.livemode
     and s.state = 'waiting_post'
     and s.deadline_at > now();
  if coalesce(array_length(v_ids, 1), 0) <> 1 then
    return jsonb_build_object('ok', true, 'outcome', case when v_ids is null then 'no_open_story' else 'several_open' end);
  end if;
  return public.story_bind(v_ids[1], m.id) || jsonb_build_object('story_id', v_ids[1]);
end;
$function$;
revoke all on function public.story_bind_handle(uuid) from public, anon, authenticated;
grant execute on function public.story_bind_handle(uuid) to service_role;

-- ── 5. The waiter's decision (signature and codes kept) ──────────────────────
-- found → approved | waiting_post. Locks the Story, then the mention.
-- Refuses gone (no such token, no Story holds it, past the deadline, or the
-- Story is no longer found), wrong_place, already_decided, story_too_old.
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
           recheck_at = v_now + r.bonus_wait, recheck_tries = 0, updated_at = v_now
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
    'place_id', s.place_id, 'livemode', s.livemode, 'state', s.state, 'recheck_at', s.recheck_at);
end;
$function$;
revoke all on function public.story_review(text, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.story_review(text, uuid, boolean, text) to service_role;

-- The old check's point-at-place (MESITA-4304), kept for the deploy window:
-- it never moves a mention a Story holds.
create or replace function public.story_review_open(p_mention uuid, p_place uuid)
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
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  if m.review_place_id is distinct from p_place
     and m.purchase_id is null
     and not exists (select 1 from public.stories s where s.mention_id = m.id)
     and not exists (select 1 from public.wallet_purchases p
                      where p.story_mention_id = m.id and p.status not in ('failed', 'expired', 'refunded')) then
    update public.story_mentions
       set review_place_id = p_place, review = null, reviewed_at = null, review_device_hash = null
     where id = m.id
     returning * into m;
  end if;
  if m.review_token is null then
    update public.story_mentions set review_token = replace(gen_random_uuid()::text, '-', '')
     where id = m.id
     returning * into m;
  end if;
  return jsonb_build_object('ok', true, 'token', m.review_token, 'place_id', m.review_place_id,
    'review', m.review, 'reviewed_at', m.reviewed_at);
end;
$function$;
revoke all on function public.story_review_open(uuid, uuid) from public, anon, authenticated;
grant execute on function public.story_review_open(uuid, uuid) to service_role;

-- ── 6. The re-check: approved → released | void ─────────────────────────────
-- p_deleted: the emulator's own delete flag (void deleted at once).
-- A story past its own 24 hours ended on its own: counts as kept up.
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
  v_mentioned timestamptz;
  v_natural boolean := false;
  v_tries integer;
begin
  select purchase_id into v_purchase from public.stories where id = p_story;
  if v_purchase is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
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

  if not p_reachable and not p_deleted then
    select mentioned_at into v_mentioned from public.story_mentions where id = s.mention_id;
    v_natural := v_mentioned is not null and v_mentioned + interval '24 hours' <= v_now;
  end if;

  if p_reachable or v_natural then
    if s.bonus_cents > 0 and not exists (
      select 1 from public.wallet_entries where purchase_id = v.id and kind = 'bonus') then
      insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
      values (v.consumer_id, v.place_id, 'bonus', s.bonus_cents, v.currency, v.id, v.livemode, v_now);
    end if;
    update public.stories set state = 'released', decided_at = v_now, updated_at = v_now where id = s.id;
    return jsonb_build_object('ok', true, 'outcome', 'released', 'bonus_cents', s.bonus_cents, 'natural_end', v_natural,
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
revoke all on function public.story_settle(uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function public.story_settle(uuid, boolean, boolean) to service_role;

-- The old cron's call (deploy window): forwards to the Story, so a bonus is
-- written exactly once whichever path calls.
create or replace function public.wallet_settle_story_recheck(p_purchase uuid, p_reachable boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_story uuid;
begin
  select id into v_story from public.stories where purchase_id = p_purchase;
  if v_story is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  return public.story_settle(v_story, p_reachable, false);
end;
$function$;
revoke all on function public.wallet_settle_story_recheck(uuid, boolean) from public, anon, authenticated;
grant execute on function public.wallet_settle_story_recheck(uuid, boolean) to service_role;

-- ── 7. The deadline ──────────────────────────────────────────────────────────
-- waiting_post | found past deadline_at → void expired. A waiting_post Story
-- first tries one bind (a story posted while the app was closed counts as
-- posted: first_bound_at). Takes the Story lock; an approved Story is left.
create or replace function public.story_expire_sweep(p_limit integer default 100)
 returns table (story_id uuid, purchase_id uuid, place_id uuid, livemode boolean, was_bound boolean)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
  s public.stories;
  v_now timestamptz := now();
begin
  for v_id in
    select x.id from public.stories x
     where x.state in ('waiting_post', 'found') and x.deadline_at <= v_now
     order by x.deadline_at
     limit greatest(coalesce(p_limit, 100), 1)
  loop
    perform public.story_bind(v_id, null, true);
    select * into s from public.stories x where x.id = v_id for update;
    if s.state not in ('waiting_post', 'found') or s.deadline_at > v_now then
      continue;
    end if;
    update public.stories x
       set state = 'void', void_reason = 'expired', decided_at = v_now, updated_at = v_now
     where x.id = s.id;
    story_id := s.id;
    purchase_id := s.purchase_id;
    place_id := s.place_id;
    livemode := s.livemode;
    was_bound := s.first_bound_at is not null;
    return next;
  end loop;
end;
$function$;
revoke all on function public.story_expire_sweep(integer) from public, anon, authenticated;
grant execute on function public.story_expire_sweep(integer) to service_role;

-- ── 8. The credit: the voucher now, then the Story ───────────────────────────
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

  -- The deploy window: an old Story buy that expired or failed, whose
  -- reserved story another live purchase holds since, gives it up before it
  -- turns paid (the one-live-reservation index would refuse the payment).
  if v.voucher = 'voucher_story' and v.story_mention_id is not null and v.status in ('failed', 'expired')
     and exists (select 1 from public.wallet_purchases o
                  where o.story_mention_id = v.story_mention_id and o.id <> v.id
                    and o.status not in ('failed', 'expired', 'refunded')) then
    update public.wallet_purchases set story_mention_id = null where id = v.id;
  end if;

  -- An expired or failed purchase that Stripe nevertheless paid is still
  -- credited: the guest's money arrived.
  update public.wallet_purchases
     set status = 'paid', paid_at = now(), updated_at = now(),
         stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id)
   where id = p_purchase_id;

  -- A Story (MESITA-4405): what the guest paid Available now, NO bonus entry
  -- here; the Story record carries the rest.
  if v.voucher = 'voucher_story' then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'voucher', v.amount_cents, v.currency, v.id, v.livemode, least(v_at, now()));
    v_story := public.story_create(v.id);
    return jsonb_build_object('ok', true, 'outcome', 'credited', 'story', v_story ->> 'state',
      'story_id', v_story ->> 'story_id');
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

-- The old claim's name, kept: it creates the Story.
create or replace function public.story_claim(p_purchase uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  return coalesce(public.story_create(p_purchase) ->> 'state', 'not_story');
end;
$function$;
revoke all on function public.story_claim(uuid) from public, anon, authenticated;
grant execute on function public.story_claim(uuid) to service_role;

-- ── 9. The operator's override: release | void, on the Story ─────────────────
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
  select * into s from public.stories where purchase_id = v.id for update;
  if s.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
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

-- ── 10. Refunds: an open Story turns void refunded ──────────────────────────
-- The clawback arithmetic is unchanged (MESITA-4264's story_void sums). The
-- purchase's story_* columns are no longer written.
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

  -- Any refund before the bonus is decided voids the Story and frees its
  -- story, so the re-check never releases a bonus the refund did not count.
  if v_story then
    update public.stories
       set state = 'void', void_reason = 'refunded', decided_at = now(), mention_id = null, updated_at = now()
     where purchase_id = v.id and state in ('waiting_post', 'found', 'approved');
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'applied', 'delta_cents', v_delta,
    'reversed_cents', v_reversed, 'uncovered_cents', v_to_reverse - v_reversed, 'status', v_status);
end;
$function$;
revoke all on function public.wallet_refund_purchase(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.wallet_refund_purchase(uuid, integer, text) to service_role;

-- ── 11. The 24-hour cleanup keeps what a Story holds ─────────────────────────
create or replace function public.wallet_purge_story_mentions(p_before timestamptz)
 returns integer
 language sql
 security definer
 set search_path to 'public'
as $function$
  with gone as (
    delete from public.story_mentions m
     where m.purchase_id is null and m.mentioned_at < p_before
       and not exists (select 1 from public.stories s where s.mention_id = m.id and s.state <> 'void')
       and not exists (
         select 1 from public.wallet_purchases p
          where p.story_mention_id = m.id and p.status not in ('failed', 'expired', 'refunded'))
    returning 1
  )
  select count(*)::int from gone;
$function$;
revoke all on function public.wallet_purge_story_mentions(timestamptz) from public, anon, authenticated;
grant execute on function public.wallet_purge_story_mentions(timestamptz) to service_role;

-- ── 12. The data move ────────────────────────────────────────────────────────
-- Every paid (or refunded) Story purchase without a Story gets one, from its
-- purchase columns: released | void as decided (legacy reasons no_mention,
-- mention_lost, not_verified read operator; any other raises); claimed and
-- undecided → approved. Idempotent. Answers how many it wrote.
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
      raise exception 'stories_move_legacy: purchase % is undecided with no claimed story', p.id;
    end if;
    insert into public.stories (purchase_id, consumer_id, place_id, livemode, state, deadline_at, mention_id, first_bound_at,
                                approved_at, approved_device_hash, recheck_at, recheck_tries, decided_at, void_reason, bonus_cents,
                                created_at)
    values (p.id, p.consumer_id, p.place_id, p.livemode, v_state,
            coalesce(p.paid_at, p.created_at) + r.post_window,
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
revoke all on function public.stories_move_legacy() from public, anon, authenticated;
grant execute on function public.stories_move_legacy() to service_role;

-- Measured on live 2026-11-18: ONE Story purchase (test mode, paid, bonus
-- released). A fresh database (CI) has none. Anything more means the world
-- moved since the plan: stop and look.
do $$
declare
  v_expected integer;
  v_moved integer;
begin
  select count(*) into v_expected from public.wallet_purchases
   where voucher = 'voucher_story' and status in ('paid', 'refunded', 'partly_refunded', 'needs_review');
  if v_expected > 1 then
    raise exception 'stories move: % Story purchases, measured 1 on 2026-11-18', v_expected;
  end if;
  v_moved := public.stories_move_legacy();
  if v_moved <> v_expected then
    raise exception 'stories move: wrote % of % Stories', v_moved, v_expected;
  end if;
end;
$$;

-- ── 13. Comments ─────────────────────────────────────────────────────────────
comment on function public.story_rules() is
  'MESITA-4405: the Story rules from app_config.money_config with defaults: bonus_wait (story_bonus_wait_sec, 3 h), credit_margin (1 h), check_margin (90 min), recheck_meta (false), post_window (story_post_window_sec, 12 h, clamped 2–24 h). Service role only.';
comment on function public.story_create(uuid) is
  'MESITA-4405: the credit''s Story row (waiting_post, deadline = paid_at + post_window), idempotent per purchase. Binds an old buy''s reserved mention (deploy window): approved when a waiter of this place approved it, else found. Service role only.';
comment on function public.story_bind(uuid, uuid, boolean) is
  'MESITA-4405: waiting_post → found. Binds the newest mention of the guest''s verified handle that no Story holds, not rejected at this place, same livemode, not deleted, with mentioned_at + 24 h >= now + bonus_wait + check_margin; points it at the place with a fresh decision and a QR token. Answers found | nothing_yet | unchanged | past_deadline; a conflict is nothing_yet. Service role only.';
comment on function public.story_bind_handle(uuid) is
  'MESITA-4405: the webhook''s and emulator''s bind: when the mention''s handle has exactly one open waiting_post Story in its livemode, story_bind on it. Service role only.';
comment on function public.story_review(text, uuid, boolean, text) is
  'MESITA-4304, MESITA-4405: the waiter''s approve / reject of the story behind a QR token at p_place. Approve: found → approved, recheck_at = now + bonus_wait. Reject: the mention is rejected at this place, the Story returns to waiting_post. Refuses gone (no Story found before its deadline), wrong_place, already_decided, story_too_old. Service role only.';
comment on function public.story_settle(uuid, boolean, boolean) is
  'MESITA-4405: the re-check''s answer on an approved Story: reachable (or past its own 24 hours) → released with the bonus entry (once per purchase); deleted → void deleted; unreachable → retry in 10 minutes, void unreachable at the third failure. Service role only.';
comment on function public.wallet_settle_story_recheck(uuid, boolean) is
  'MESITA-4405: the old cron''s call by purchase id; forwards to story_settle. Service role only.';
comment on function public.story_expire_sweep(integer) is
  'MESITA-4405: waiting_post | found past deadline_at → void expired, after one last bind try. Returns the Stories it expired. Service role only.';
comment on function public.story_claim(uuid) is
  'MESITA-4405: the old claim''s name; creates the Story (story_create). Service role only.';
comment on function public.wallet_override_story(uuid, text, uuid) is
  'MESITA-4405: the operator''s release | void of one Story by purchase id. release also lifts a void that never paid a bonus; void after release reverses the bonus (reason story_void), capped at what the guest holds. Service role only.';
comment on function public.wallet_purge_story_mentions(timestamptz) is
  'MESITA-4405: deletes unclaimed mentions older than p_before that no non-void Story and no live legacy reservation holds. Service role only.';
comment on function public.stories_move_legacy() is
  'MESITA-4405: the one-time move of Story purchases'' state from wallet_purchases.story_* into stories. Idempotent. Service role only.';
comment on column public.wallet_purchases.story_mention_id is
  'MESITA-4296: retired by MESITA-4405 (stories.mention_id binds a story); read only by story_create for the deploy window. Dropped in a follow-up.';
comment on column public.wallet_purchases.story_bonus is
  'MESITA-4264: retired by MESITA-4405 (stories.state); a frozen copy. Dropped in a follow-up.';

-- ── 14. Post-flight ──────────────────────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from unnest(array[
      'public.story_create(uuid)', 'public.story_bind(uuid, uuid, boolean)', 'public.story_bind_handle(uuid)',
      'public.story_settle(uuid, boolean, boolean)', 'public.story_expire_sweep(integer)', 'public.stories_move_legacy()',
      'public.story_review(text, uuid, boolean, text)', 'public.story_rules()'
    ]) f, unnest(array['anon', 'authenticated']) r
    where has_function_privilege(r, f, 'EXECUTE')) then
    raise exception 'a Story function is open to clients';
  end if;
  if has_table_privilege('authenticated', 'public.stories', 'SELECT') or has_table_privilege('anon', 'public.stories', 'SELECT') then
    raise exception 'stories is readable by clients';
  end if;
end;
$$;

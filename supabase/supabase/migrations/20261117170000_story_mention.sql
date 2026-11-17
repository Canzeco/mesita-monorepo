-- MESITA-4264: the Story voucher is verified from the @mesita mention.
--
-- Pato, 2026-11-17: the guest pays the Story voucher first and gets what they
-- paid at once; they post an Instagram story tagging @mesita and the place;
-- Meta tells Mesita about the mention; staff (waiter code) see the story on
-- their own phone and approve or reject it; 3 hours after approval Mesita
-- fetches the story again and releases the bonus if it still loads.
--
--   story_mentions                    every story that tagged @mesita, kept
--                                     under its sender's handle (a guest is
--                                     matched only when staff open a Story
--                                     token); unclaimed ones live 24 hours
--   wallet_purchases.story_*          the review, the re-check and the bonus
--                                     decision (released | void + reason)
--   wallet_credit_purchase            a Story writes its voucher entry at
--                                     payment (Available now), no bonus
--   wallet_record_story_mention       the webhook's and the emulator's write
--   wallet_review_story               staff's approve / reject
--   wallet_settle_story_recheck       the cron's answer 3 hours later
--   wallet_expire_stories             void bonuses nobody approved in 7 days
--   wallet_override_story             the operator's release / void / unapprove
--   wallet_activate_story             a wrapper that writes nothing (reload)
--   wallet_refund_purchase            Story reverses what the ledger holds
--
-- Every Story RPC locks the purchase row, then the (guest, place) pair, the
-- order wallet_refund_purchase and wallet_credit_purchase use, and re-checks
-- status paid and an undecided bonus under those locks.

-- ── 1. The rules, in app_config.money_config ─────────────────────────────────
update public.app_config
   set money_config = coalesce(money_config, '{}'::jsonb) || jsonb_build_object(
     'story_expiry_anchor', now(),
     'story_recheck_meta', false,
     'story_bonus_wait_sec', 10800,
     'story_approve_days', 7)
 where id = 1;

-- The Story rules with their defaults (a missing row or key reads the
-- default). The anchor: a Story's 7 days start no earlier than it.
create or replace function public.story_rules()
 returns table (bonus_wait interval, approve_window interval, expiry_anchor timestamptz, recheck_meta boolean)
 language sql
 stable
 set search_path to 'public'
as $function$
  select
    make_interval(secs => coalesce((c.money_config ->> 'story_bonus_wait_sec')::int, 10800)),
    make_interval(days => coalesce((c.money_config ->> 'story_approve_days')::int, 7)),
    coalesce((c.money_config ->> 'story_expiry_anchor')::timestamptz, '-infinity'::timestamptz),
    coalesce((c.money_config ->> 'story_recheck_meta')::boolean, false)
  from (select 1) one
  left join public.app_config c on c.id = 1;
$function$;

revoke all on function public.story_rules() from public, anon, authenticated;
grant execute on function public.story_rules() to service_role;

-- ── 2. The mentions ──────────────────────────────────────────────────────────
create table public.story_mentions (
  id uuid primary key default gen_random_uuid(),
  ig_handle text check (ig_handle is null or ig_handle = lower(ig_handle)),
  purchase_id uuid unique references public.wallet_purchases (id) on delete set null,
  ig_story_id text not null check (length(ig_story_id) between 1 and 512),
  media_url text check (media_url is null or media_url ~ '^https://'),
  media_kind text not null default 'image' check (media_kind in ('image', 'video')),
  source text not null check (source in ('meta', 'emulator')),
  sender_igsid text,
  mentioned_at timestamptz not null default now(),
  livemode boolean not null,
  handle_tries integer not null default 0,
  created_at timestamptz not null default now(),
  unique (source, ig_story_id)
);

create index story_mentions_handle_idx on public.story_mentions (ig_handle, mentioned_at desc)
  where purchase_id is null;

alter table public.story_mentions enable row level security;
revoke all on table public.story_mentions from public, anon, authenticated;
grant all on table public.story_mentions to service_role;

comment on table public.story_mentions is
  'MESITA-4264: one Instagram story that tagged @mesita (Meta''s story_mention webhook, or the test-mode emulator). Belongs to a handle, not a guest: staff match it to the purchase guest''s verified instagram_handle when they open a Story token. purchase_id is set when staff approve it on a purchase (one story pays one bonus). Unclaimed rows are deleted after 24 hours by supabase-cron-recheck-stories. EF-only.';

-- ── 3. The purchase's Story columns ──────────────────────────────────────────
alter table public.wallet_purchases
  add column story_review text check (story_review in ('approved', 'rejected')),
  add column story_reviewed_at timestamptz,
  add column story_reviewed_by_device text,
  add column story_recheck_at timestamptz,
  add column story_recheck_tries integer not null default 0,
  add column story_bonus text check (story_bonus in ('released', 'void')),
  add column story_bonus_void_reason text
    check (story_bonus_void_reason in ('unreachable', 'expired', 'refunded', 'operator')),
  add column story_bonus_decided_at timestamptz,
  add constraint wallet_purchases_story_void_reason_chk
    check ((story_bonus is distinct from 'void') = (story_bonus_void_reason is null));

create index wallet_purchases_story_recheck_idx on public.wallet_purchases (story_recheck_at)
  where story_review = 'approved' and story_bonus is null;

comment on column public.wallet_purchases.story_activated_at is
  'MESITA-3507, MESITA-4264: when staff APPROVED the Story (the credit itself lands at payment since MESITA-4264). Set by wallet_review_story.';
comment on column public.wallet_purchases.story_review is
  'MESITA-4264: staff''s answer on the Story: approved | rejected; null = not reviewed. A rejected Story can be reviewed again.';
comment on column public.wallet_purchases.story_recheck_at is
  'MESITA-4264: when supabase-cron-recheck-stories fetches the approved story again (approval + 3 hours, then every 10 minutes on a failed fetch).';
comment on column public.wallet_purchases.story_bonus is
  'MESITA-4264: the bonus decision: released (bonus entry written) | void (story_bonus_void_reason: unreachable, expired, refunded, operator); null = undecided.';
comment on column public.wallet_purchases.story_bonus_decided_at is
  'MESITA-4264: when story_bonus was decided; the Wallet keeps a decided Story listed 24 hours after it.';
comment on column public.wallet_purchases.story_reviewed_by_device is
  'MESITA-4264: the staff phone that reviewed, as staffDeviceHash of its waiter-code token''s device id; never the token.';

-- A void after release writes a reversal marked story_void.
alter table public.wallet_entries drop constraint if exists wallet_entries_reason_chk;
alter table public.wallet_entries add constraint wallet_entries_reason_chk check (
  reason is null or (kind = 'reversal' and reason in ('refund', 'dispute_lost', 'credit_refund', 'story_void'))
);

-- ── 4. Backfill: Stories bought under the old rules (status paid only) ──────
-- Paid, not activated: their voucher entry now, so the money is not stranded.
insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
select p.consumer_id, p.place_id, 'voucher', p.amount_cents, p.currency, p.id, p.livemode, now()
  from public.wallet_purchases p
 where p.voucher = 'voucher_story' and p.status = 'paid' and p.story_activated_at is null
   and not exists (select 1 from public.wallet_entries e where e.purchase_id = p.id and e.kind = 'voucher');

-- Activated: approved, bonus released (its bonus entry already exists).
update public.wallet_purchases
   set story_review = 'approved',
       story_reviewed_at = story_activated_at,
       story_bonus = 'released',
       story_bonus_decided_at = story_activated_at
 where voucher = 'voucher_story' and status = 'paid' and story_activated_at is not null;

-- ── 5. Crediting a Story: the voucher now, the bonus waits on the story ──────
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

  -- An expired or failed purchase that Stripe nevertheless paid is still
  -- credited: the guest's money arrived.
  update public.wallet_purchases
     set status = 'paid', paid_at = now(), updated_at = now(),
         stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id)
   where id = p_purchase_id;

  -- A Story (MESITA-4264): its token minted and what the guest paid Available
  -- now, like every voucher; NO bonus entry: wallet_settle_story_recheck
  -- writes it once the approved story is still up 3 hours later.
  if v.voucher = 'voucher_story' then
    update public.wallet_purchases
       set story_token = coalesce(story_token, replace(gen_random_uuid()::text, '-', ''))
     where id = p_purchase_id;
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'voucher', v.amount_cents, v.currency, v.id, v.livemode, least(v_at, now()));
    return jsonb_build_object('ok', true, 'outcome', 'credited');
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

-- ── 6. Recording a mention ───────────────────────────────────────────────────
create or replace function public.wallet_record_story_mention(
  p_handle text, p_source text, p_story_id text, p_media_url text, p_media_kind text,
  p_mentioned_at timestamptz, p_livemode boolean, p_sender_igsid text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if p_source is null or p_source not in ('meta', 'emulator') or p_story_id is null or p_livemode is null then
    return jsonb_build_object('ok', false, 'code', 'bad_request');
  end if;
  insert into public.story_mentions (ig_handle, purchase_id, ig_story_id, media_url, media_kind, source, sender_igsid, mentioned_at, livemode)
  values (nullif(lower(trim(p_handle)), ''), null, p_story_id,
          case when p_media_url ~ '^https://' then p_media_url end,
          case when p_media_kind = 'video' then 'video' else 'image' end,
          p_source, p_sender_igsid, coalesce(p_mentioned_at, now()), p_livemode)
  on conflict (source, ig_story_id) do nothing
  returning id into v_id;
  if v_id is not null then
    return jsonb_build_object('ok', true, 'outcome', 'recorded', 'id', v_id);
  end if;
  select id into v_id from public.story_mentions where source = p_source and ig_story_id = p_story_id;
  return jsonb_build_object('ok', true, 'outcome', 'duplicate', 'id', v_id);
end;
$function$;

-- ── 7. Staff's review ────────────────────────────────────────────────────────
create or replace function public.wallet_review_story(
  p_token text, p_mention uuid, p_approve boolean, p_device_hash text default null)
 returns jsonb
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
  v_claimed uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' or p_approve is null then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  select * into v from public.wallet_purchases
   where story_token = p_token and voucher = 'voucher_story'
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);
  select * into r from public.story_rules();

  if v.status in ('refunded', 'partly_refunded') then
    return jsonb_build_object('ok', false, 'code', 'refunded');
  end if;
  if v.status <> 'paid' then
    return jsonb_build_object('ok', false, 'code', 'not_paid');
  end if;

  if v.story_review = 'approved' then
    select id into v_claimed from public.story_mentions where purchase_id = v.id;
    if p_approve and p_mention is not null and v_claimed = p_mention then
      return jsonb_build_object('ok', true, 'outcome', 'already_approved', 'purchase_id', v.id,
        'approved_at', v.story_activated_at, 'recheck_at', v.story_recheck_at, 'mention_id', v_claimed);
    end if;
    return jsonb_build_object('ok', false, 'code', 'already_decided', 'approved_at', v.story_activated_at);
  end if;
  if v.story_bonus is not null then
    return jsonb_build_object('ok', false, 'code', 'already_decided');
  end if;
  -- Past the approve window and the cron has not voided it yet: void now.
  if greatest(v.paid_at, r.expiry_anchor) + r.approve_window < v_now then
    update public.wallet_purchases
       set story_bonus = 'void', story_bonus_void_reason = 'expired', story_bonus_decided_at = v_now, updated_at = v_now
     where id = v.id;
    return jsonb_build_object('ok', false, 'code', 'already_decided');
  end if;

  if not p_approve then
    update public.wallet_purchases
       set story_review = 'rejected', story_reviewed_at = v_now, story_reviewed_by_device = p_device_hash, updated_at = v_now
     where id = v.id;
    return jsonb_build_object('ok', true, 'outcome', 'rejected', 'purchase_id', v.id, 'reviewed_at', v_now);
  end if;

  if p_mention is null then
    return jsonb_build_object('ok', false, 'code', 'mention_expired');
  end if;
  select * into m from public.story_mentions where id = p_mention for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'mention_expired');
  end if;
  if m.purchase_id is not null then
    return jsonb_build_object('ok', false, 'code', 'mention_claimed');
  end if;
  if m.mentioned_at < v_now - interval '24 hours' then
    return jsonb_build_object('ok', false, 'code', 'mention_expired');
  end if;
  select lower(instagram_handle) into v_handle from public.consumers where id = v.consumer_id;
  if v_handle is null or m.ig_handle is distinct from v_handle then
    return jsonb_build_object('ok', false, 'code', 'handle_mismatch');
  end if;
  -- An emulator (test) story completes only a test purchase; a real one any.
  if not m.livemode and v.livemode then
    return jsonb_build_object('ok', false, 'code', 'livemode_mismatch');
  end if;

  update public.story_mentions set purchase_id = v.id where id = m.id;
  update public.wallet_purchases
     set story_review = 'approved', story_reviewed_at = v_now, story_activated_at = v_now,
         story_reviewed_by_device = p_device_hash,
         story_recheck_at = v_now + r.bonus_wait, story_recheck_tries = 0, updated_at = v_now
   where id = v.id;
  return jsonb_build_object('ok', true, 'outcome', 'approved', 'purchase_id', v.id,
    'approved_at', v_now, 'recheck_at', v_now + r.bonus_wait, 'mention_id', m.id);
end;
$function$;

-- The old staff tap: writes nothing (the credit lands at payment now). Kept
-- one release so a stale EF in the deploy window can never write a second
-- voucher entry; a later cleanup drops it.
create or replace function public.wallet_activate_story(p_token text)
 returns jsonb
 language sql
 security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object('ok', false, 'code', 'reload');
$function$;

-- ── 8. The re-check's answer ─────────────────────────────────────────────────
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
  if v.story_review is distinct from 'approved' then
    return jsonb_build_object('ok', false, 'code', 'not_approved');
  end if;

  if p_reachable then
    if v.bonus_cents > 0 and not exists (
      select 1 from public.wallet_entries where purchase_id = v.id and kind = 'bonus') then
      insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
      values (v.consumer_id, v.place_id, 'bonus', v.bonus_cents, v.currency, v.id, v.livemode, v_now);
    end if;
    update public.wallet_purchases
       set story_bonus = 'released', story_bonus_decided_at = v_now, updated_at = v_now
     where id = v.id;
    return jsonb_build_object('ok', true, 'outcome', 'released', 'bonus_cents', v.bonus_cents);
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

-- ── 9. Nobody approved it in 7 days ──────────────────────────────────────────
create or replace function public.wallet_expire_stories(p_limit integer default 50)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v public.wallet_purchases;
  v_id uuid;
  v_n integer := 0;
begin
  select * into r from public.story_rules();
  for v_id in
    select id from public.wallet_purchases
     where voucher = 'voucher_story' and status = 'paid' and story_bonus is null
       and story_review is distinct from 'approved'
       and greatest(paid_at, r.expiry_anchor) + r.approve_window < now()
     order by paid_at
     limit greatest(coalesce(p_limit, 50), 1)
  loop
    select * into v from public.wallet_purchases where id = v_id for update;
    perform public.wallet_lock(v.consumer_id, v.place_id);
    if v.status = 'paid' and v.story_bonus is null and v.story_review is distinct from 'approved'
       and greatest(v.paid_at, r.expiry_anchor) + r.approve_window < now() then
      update public.wallet_purchases
         set story_bonus = 'void', story_bonus_void_reason = 'expired', story_bonus_decided_at = now(), updated_at = now()
       where id = v.id;
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$function$;

-- ── 10. The operator's override ──────────────────────────────────────────────
create or replace function public.wallet_override_story(p_purchase uuid, p_action text, p_actor uuid default null)
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
  if p_action is null or p_action not in ('release', 'void', 'unapprove') then
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
    if v.story_bonus is not null then
      return jsonb_build_object('ok', false, 'code', 'already_decided');
    end if;
    if v.status <> 'paid' then
      return jsonb_build_object('ok', false, 'code', case when v.status in ('refunded', 'partly_refunded') then 'refunded' else 'not_paid' end);
    end if;
    if v.bonus_cents > 0 and not exists (
      select 1 from public.wallet_entries where purchase_id = v.id and kind = 'bonus') then
      insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
      values (v.consumer_id, v.place_id, 'bonus', v.bonus_cents, v.currency, v.id, v.livemode, v_now);
    end if;
    update public.wallet_purchases
       set story_bonus = 'released', story_bonus_decided_at = v_now, updated_at = v_now
     where id = v.id;
    return jsonb_build_object('ok', true, 'outcome', 'released');
  end if;

  if p_action = 'void' then
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
  end if;

  -- unapprove
  if v.story_bonus is not null then
    return jsonb_build_object('ok', false, 'code', 'already_decided');
  end if;
  if v.story_review is distinct from 'approved' then
    return jsonb_build_object('ok', false, 'code', 'not_approved');
  end if;
  update public.story_mentions set purchase_id = null where purchase_id = v.id;
  update public.wallet_purchases
     set story_review = null, story_reviewed_at = null, story_activated_at = null, story_reviewed_by_device = null,
         story_recheck_at = null, story_recheck_tries = 0, updated_at = v_now
   where id = v.id;
  return jsonb_build_object('ok', true, 'outcome', 'unapproved');
end;
$function$;

-- ── 11. Refunds: a Story reverses what the ledger holds ──────────────────────
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
  -- when its voucher entry exists (a Story refunded before MESITA-4264's
  -- backfill never had one), the bonus's share only of bonus entries that
  -- exist and were not voided by the operator, plus any such void.
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
       set story_bonus = 'void', story_bonus_void_reason = 'refunded', story_bonus_decided_at = now()
     where id = v.id;
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'applied', 'delta_cents', v_delta,
    'reversed_cents', v_reversed, 'uncovered_cents', v_to_reverse - v_reversed, 'status', v_status);
end;
$function$;

-- ── 12. Grants: service role only ────────────────────────────────────────────
revoke all on function public.wallet_record_story_mention(text, text, text, text, text, timestamptz, boolean, text) from public, anon, authenticated;
grant execute on function public.wallet_record_story_mention(text, text, text, text, text, timestamptz, boolean, text) to service_role;
revoke all on function public.wallet_review_story(text, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.wallet_review_story(text, uuid, boolean, text) to service_role;
revoke all on function public.wallet_activate_story(text) from public, anon, authenticated;
grant execute on function public.wallet_activate_story(text) to service_role;
revoke all on function public.wallet_settle_story_recheck(uuid, boolean) from public, anon, authenticated;
grant execute on function public.wallet_settle_story_recheck(uuid, boolean) to service_role;
revoke all on function public.wallet_expire_stories(integer) from public, anon, authenticated;
grant execute on function public.wallet_expire_stories(integer) to service_role;
revoke all on function public.wallet_override_story(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.wallet_override_story(uuid, text, uuid) to service_role;
revoke all on function public.wallet_refund_purchase(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.wallet_refund_purchase(uuid, integer, text) to service_role;
revoke all on function public.wallet_credit_purchase(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.wallet_credit_purchase(uuid, text, timestamptz) to service_role;

comment on function public.wallet_review_story(text, uuid, boolean, text) is
  'MESITA-4264: staff''s answer on a Story token. Approve claims one unclaimed mention under 24 hours old of the purchase guest''s verified handle (an emulator mention only for a test purchase), sets story_review approved and story_recheck_at = now + 3 hours; reject claims nothing and can be followed by an approve. Refuses: gone, refunded, not_paid, already_decided, mention_claimed, mention_expired, handle_mismatch, livemode_mismatch. A second approve of the same mention answers the stored time. Service role only.';
comment on function public.wallet_activate_story(text) is
  'MESITA-4264: retired; writes nothing and answers code reload (the credit lands at payment). Dropped by a later cleanup.';
comment on function public.wallet_settle_story_recheck(uuid, boolean) is
  'MESITA-4264: the re-check''s answer on an approved Story: reachable writes the bonus entry Available now (released); unreachable retries in 10 minutes, voiding (unreachable) at the third failure. Does nothing once the bonus is decided or the purchase is not paid. Service role only.';
comment on function public.wallet_override_story(uuid, text, uuid) is
  'MESITA-4264: the operator''s release | void | unapprove of one Story. void after release reverses the bonus (reason story_void), capped at what the guest holds. Service role only.';

-- ── 13. The emulator's images ────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('story-emulator', 'story-emulator', true, 2097152, array['image/jpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ── 14. The cron ─────────────────────────────────────────────────────────────
-- Every 10 minutes. Kill switch: select cron.unschedule('recheck-stories');
-- The function stops taking rows after 100 seconds, so the wait is longer
-- than bill-fees'.
select cron.unschedule('recheck-stories')
where exists (select 1 from cron.job where jobname = 'recheck-stories');

select cron.schedule(
  'recheck-stories',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://yjalywfzdelacdzccpgb.supabase.co/functions/v1/supabase-cron-recheck-stories',
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

-- ── 15. Post-flight ──────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from public.wallet_purchases p
              where p.voucher = 'voucher_story' and p.status = 'paid'
                and not exists (select 1 from public.wallet_entries e where e.purchase_id = p.id and e.kind = 'voucher')) then
    raise exception 'a paid Story has no voucher entry after the backfill';
  end if;
  if not exists (select 1 from storage.buckets where id = 'story-emulator') then
    raise exception 'story-emulator bucket is missing';
  end if;
end;
$$;

-- MESITA-4297: the waiter verifies the story first, then the guest pays.
--
-- Pato, 2026-11-17: "your story gets verified by waiter, and then you pay.
-- then receive instant principal. don't delete story for 3 hours and in 3
-- hours you receive your bonus." MESITA-4264 shipped pay → post → approve;
-- this turns it around:
--
--   1. the guest posts a story tagging @mesita and the place;
--   2. the guest shows a Story QR (a STORY CHECK, not a purchase); the waiter,
--      signed in with the waiter code, approves the story on their phone;
--   3. only an approved check lets the guest buy the Story voucher (2 hours);
--   4. what they paid lands Available at once (unchanged);
--   5. 3 hours after PAYMENT Mesita fetches the story again; still up → bonus.
--
--   story_checks                     one guest's approval at one place
--   story_mentions.check_id          the ONE link between a check and its story
--   wallet_purchases.story_check_id  the check a buy presented
--   story_rules()                    clamped; never raises (the money path reads it)
--   wallet_open_story_check          mint or return the guest's check
--   wallet_review_story_check        the waiter's approve / reject
--   wallet_reopen_story_check        a story removed before payment → open again
--   wallet_credit_purchase           a Story uses its check once, or voids the
--                                    bonus not_verified; the money always lands
--   wallet_sweep_stories             the cron: expire checks, delete old mentions
--   wallet_story_check_admin         the operator: expire_check | release_story
--   wallet_review_story              retired (answers reload)
--   wallet_expire_stories            retired (returns 0)
--   wallet_override_story            release | void (unapprove is gone)
--
-- Lock order everywhere: the purchase row, then wallet_lock, then the check
-- row, then the mention row.

-- ── 0. Guard: no paid Story may wait on the old purchase-level review ────────
create or replace function public.story_migration_guard()
 returns jsonb
 language sql
 stable
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'paid_unapproved', coalesce((select jsonb_agg(id order by id) from public.wallet_purchases
       where voucher = 'voucher_story' and status = 'paid' and story_bonus is null
         and story_review is distinct from 'approved'), '[]'::jsonb),
    -- Open Stories still paying: they credit their voucher, bonus not_verified.
    'open_unpaid', coalesce((select jsonb_agg(id order by id) from public.wallet_purchases
       where voucher = 'voucher_story' and status in ('opening', 'open')), '[]'::jsonb));
$function$;

revoke all on function public.story_migration_guard() from public, anon, authenticated;
grant execute on function public.story_migration_guard() to service_role;

do $$
declare
  g jsonb := public.story_migration_guard();
begin
  if jsonb_array_length(g -> 'paid_unapproved') > 0 then
    raise exception 'MESITA-4297: % paid Story purchase(s) wait on the old review: %. Settle each with admin-web-story-override (approve is gone: use release or void), then re-run.',
      jsonb_array_length(g -> 'paid_unapproved'), g -> 'paid_unapproved';
  end if;
end;
$$;

-- ── 1. The rules ─────────────────────────────────────────────────────────────
update public.app_config
   set money_config = (coalesce(money_config, '{}'::jsonb) - 'story_approve_days' - 'story_expiry_anchor')
       || jsonb_build_object('story_approve_valid_sec', 7200)
 where id = 1;

drop function if exists public.story_rules();

-- A money_config number, or null when it is not one (never raises).
create or replace function public.story_num(p text)
 returns integer
 language sql
 immutable
as $function$
  select case when p ~ '^\d{1,9}$' then p::integer end;
$function$;

-- Clamped, never raises: wallet_credit_purchase reads it on the money path.
-- max_story_age: a story approved at that age still loads when its last
-- re-check runs (24 h − the pay window − the bonus wait − 2 h 30 min for a
-- slow bank check, a late webhook, the cron tick and the retries).
create or replace function public.story_rules()
 returns table (bonus_wait interval, approve_valid interval, max_story_age interval, recheck_meta boolean)
 language sql
 stable
 set search_path to 'public'
as $function$
  with raw as (
    select
      least(greatest(coalesce(public.story_num(c.money_config ->> 'story_bonus_wait_sec'), 10800), 3600), 21600) as wait_s,
      least(greatest(coalesce(public.story_num(c.money_config ->> 'story_approve_valid_sec'), 7200), 1800), 14400) as valid_s,
      coalesce((c.money_config ->> 'story_recheck_meta') = 'true', false) as meta
    from (select 1) one
    left join public.app_config c on c.id = 1
  )
  select make_interval(secs => wait_s),
         make_interval(secs => valid_s),
         make_interval(secs => greatest(86400 - valid_s - wait_s - 9000, 3600)),
         meta
    from raw;
$function$;


revoke all on function public.story_rules() from public, anon, authenticated;
grant execute on function public.story_rules() to service_role;
revoke all on function public.story_num(text) from public, anon, authenticated;
grant execute on function public.story_num(text) to service_role;

-- ── 2. The checks ────────────────────────────────────────────────────────────
create table public.story_checks (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  place_id uuid not null references public.place_profiles (id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', '') check (token ~ '^[0-9a-f]{32}$'),
  livemode boolean not null,
  state text not null default 'open' check (state in ('open', 'approved', 'used', 'expired')),
  last_rejected_at timestamptz,
  approved_at timestamptz,
  approved_by_device text,
  reviewed_at timestamptz,
  used_by_purchase uuid unique references public.wallet_purchases (id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  constraint story_checks_approved_chk check ((state in ('approved', 'used')) = (approved_at is not null) or state = 'expired'),
  constraint story_checks_used_chk check ((state = 'used') = (used_by_purchase is not null))
);

create unique index story_checks_live_idx on public.story_checks (consumer_id, place_id, livemode)
  where state in ('open', 'approved');
create index story_checks_expiry_idx on public.story_checks (expires_at)
  where state in ('open', 'approved');

alter table public.story_checks enable row level security;
revoke all on table public.story_checks from public, anon, authenticated;
grant all on table public.story_checks to service_role;

comment on table public.story_checks is
  'MESITA-4297: one guest''s Story approval at one place. open (waiting for a story or the waiter; 24 hours) → approved (the waiter approved a story; good story_approve_valid_sec to start paying) → used (a paid Story voucher took it) | expired. The QR carries token. One open-or-approved check per guest, place and payments mode. EF-only.';

alter table public.story_mentions
  add column check_id uuid unique references public.story_checks (id) on delete set null;

comment on column public.story_mentions.check_id is
  'MESITA-4297: the check that claimed this story (the only check–story link). Set by an approve; cleared by wallet_reopen_story_check; moves to the guest''s next check when its old check expired unused.';

alter table public.wallet_purchases
  add column story_check_id uuid references public.story_checks (id) on delete restrict;

create index wallet_purchases_story_check_idx on public.wallet_purchases (story_check_id)
  where story_check_id is not null;

comment on column public.wallet_purchases.story_check_id is
  'MESITA-4297: the story check this Story buy presented. story_checks.used_by_purchase names the purchase that actually used it; any other credits its voucher and voids the bonus (not_verified).';

alter table public.wallet_purchases drop constraint if exists wallet_purchases_story_bonus_void_reason_check;
alter table public.wallet_purchases add constraint wallet_purchases_story_bonus_void_reason_check
  check (story_bonus_void_reason in ('unreachable', 'expired', 'refunded', 'operator', 'not_verified'));

-- ── 3. Open (or return) the guest's check ────────────────────────────────────
create or replace function public.wallet_open_story_check(p_consumer uuid, p_place uuid, p_livemode boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  c public.story_checks;
  v_now timestamptz := now();
begin
  if p_consumer is null or p_place is null or p_livemode is null then
    return jsonb_build_object('ok', false, 'code', 'bad_request');
  end if;
  -- The payments mode flipped: the other mode's live check is over.
  update public.story_checks set state = 'expired'
   where consumer_id = p_consumer and place_id = p_place and livemode <> p_livemode
     and state in ('open', 'approved');
  -- Past its time: expired now, not at the next cron tick.
  update public.story_checks set state = 'expired'
   where consumer_id = p_consumer and place_id = p_place and livemode = p_livemode
     and state in ('open', 'approved') and expires_at <= v_now;

  select * into c from public.story_checks
   where consumer_id = p_consumer and place_id = p_place and livemode = p_livemode
     and state in ('open', 'approved');
  if not found then
    insert into public.story_checks (consumer_id, place_id, livemode)
    values (p_consumer, p_place, p_livemode)
    on conflict do nothing;
    select * into c from public.story_checks
     where consumer_id = p_consumer and place_id = p_place and livemode = p_livemode
       and state in ('open', 'approved');
  end if;
  return jsonb_build_object('ok', true, 'check', to_jsonb(c));
end;
$function$;

-- ── 4. The waiter's review ───────────────────────────────────────────────────
create or replace function public.wallet_review_story_check(
  p_token text, p_mention uuid, p_approve boolean, p_device_hash text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  c public.story_checks;
  m public.story_mentions;
  held public.story_checks;
  r record;
  v_handle text;
  v_now timestamptz := now();
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' or p_approve is null then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  select * into c from public.story_checks where token = p_token for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  select * into r from public.story_rules();

  if c.state in ('open', 'approved') and c.expires_at <= v_now then
    update public.story_checks set state = 'expired' where id = c.id;
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  if c.state = 'expired' then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  if c.state = 'approved' then
    if p_approve and p_mention is not null
       and exists (select 1 from public.story_mentions where id = p_mention and check_id = c.id) then
      return jsonb_build_object('ok', true, 'outcome', 'already_approved', 'check_id', c.id,
        'approved_at', c.approved_at, 'expires_at', c.expires_at, 'mention_id', p_mention);
    end if;
    return jsonb_build_object('ok', false, 'code', 'already_decided', 'approved_at', c.approved_at);
  end if;
  if c.state = 'used' then
    return jsonb_build_object('ok', false, 'code', 'already_decided', 'approved_at', c.approved_at);
  end if;

  -- c.state = 'open'
  if not p_approve then
    update public.story_checks
       set last_rejected_at = v_now, reviewed_at = v_now, approved_by_device = p_device_hash
     where id = c.id;
    return jsonb_build_object('ok', true, 'outcome', 'rejected', 'check_id', c.id, 'reviewed_at', v_now);
  end if;

  if p_mention is null then
    return jsonb_build_object('ok', false, 'code', 'story_gone');
  end if;
  select * into m from public.story_mentions where id = p_mention for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'story_gone');
  end if;
  if m.purchase_id is not null then
    return jsonb_build_object('ok', false, 'code', 'story_claimed');
  end if;
  if m.check_id is not null and m.check_id <> c.id then
    -- Held by another check: only this guest's own expired, unused one lets go.
    select * into held from public.story_checks where id = m.check_id;
    if not (held.consumer_id = c.consumer_id and held.state = 'expired' and held.used_by_purchase is null) then
      return jsonb_build_object('ok', false, 'code', 'story_claimed');
    end if;
  end if;
  if m.mentioned_at < v_now - r.max_story_age then
    return jsonb_build_object('ok', false, 'code', 'story_too_old',
      'age_sec', floor(extract(epoch from v_now - m.mentioned_at))::int,
      'max_story_age_sec', floor(extract(epoch from r.max_story_age))::int);
  end if;
  select lower(instagram_handle) into v_handle from public.consumers where id = c.consumer_id;
  if v_handle is null or m.ig_handle is distinct from v_handle then
    return jsonb_build_object('ok', false, 'code', 'handle_mismatch');
  end if;
  -- An emulator (test) story approves only a test check; a real one any.
  if not m.livemode and c.livemode then
    return jsonb_build_object('ok', false, 'code', 'emulator_on_live');
  end if;

  update public.story_mentions set check_id = c.id where id = m.id;
  update public.story_checks
     set state = 'approved', approved_at = v_now, approved_by_device = p_device_hash,
         reviewed_at = v_now, expires_at = v_now + r.approve_valid
   where id = c.id;
  return jsonb_build_object('ok', true, 'outcome', 'approved', 'check_id', c.id,
    'approved_at', v_now, 'expires_at', v_now + r.approve_valid, 'mention_id', m.id);
end;
$function$;

-- ── 5. A story removed before payment: the check is open again ───────────────
-- Clears the check's claimed story link (the emulator deletes the row
-- itself; the operator's release_story only lets go). An approved, unused
-- check goes back to open with its first 24 hours.
create or replace function public.wallet_reopen_story_check(p_check uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  c public.story_checks;
begin
  select * into c from public.story_checks where id = p_check for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if c.state = 'used' then
    return jsonb_build_object('ok', false, 'code', 'used');
  end if;
  update public.story_mentions set check_id = null where check_id = c.id and purchase_id is null;
  if c.state = 'approved' then
    update public.story_checks
       set state = case when c.created_at + interval '24 hours' > now() then 'open' else 'expired' end,
           approved_at = null, expires_at = c.created_at + interval '24 hours'
     where id = c.id;
  end if;
  return jsonb_build_object('ok', true, 'outcome', 'reopened');
end;
$function$;

-- ── 6. Crediting a Story: the money now; the check decides the bonus ─────────
create or replace function public.wallet_credit_purchase(
  p_purchase_id uuid, p_payment_intent text, p_available_at timestamptz default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_purchases;
  c public.story_checks;
  r record;
  v_kind text;
  v_at timestamptz := coalesce(p_available_at, now());
  v_now timestamptz := now();
  v_why text;
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
     set status = 'paid', paid_at = v_now, updated_at = v_now,
         stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id)
   where id = p_purchase_id;

  if v.voucher = 'voucher_story' then
    -- What the guest paid: Available now, whatever happens to the bonus.
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'voucher', v.amount_cents, v.currency, v.id, v.livemode, least(v_at, v_now));

    -- The check counts when nobody used it, the waiter approved it (it may
    -- have expired since: the buy door checked the 2 hours), and it still
    -- holds its story.
    if v.story_check_id is not null then
      select * into c from public.story_checks where id = v.story_check_id for update;
    end if;
    v_why := case
      when v.story_check_id is null or c.id is null then 'no_check'
      when c.used_by_purchase is not null then 'used'
      when c.state not in ('approved', 'expired') or c.approved_at is null then 'not_approved'
      when not exists (select 1 from public.story_mentions where check_id = c.id) then 'no_story'
      else null end;

    if v_why is not null then
      update public.wallet_purchases
         set story_bonus = 'void', story_bonus_void_reason = 'not_verified', story_bonus_decided_at = v_now
       where id = v.id;
      raise log 'story_not_verified_void %', jsonb_build_object('purchase_id', v.id, 'check_id', v.story_check_id, 'why', v_why);
      return jsonb_build_object('ok', true, 'outcome', 'credited', 'story', 'not_verified', 'why', v_why);
    end if;

    select * into r from public.story_rules();
    update public.story_checks set state = 'used', used_by_purchase = v.id where id = c.id;
    update public.story_mentions set purchase_id = v.id where check_id = c.id;
    update public.wallet_purchases
       set story_review = 'approved', story_reviewed_at = c.approved_at, story_activated_at = c.approved_at,
           story_reviewed_by_device = c.approved_by_device,
           story_recheck_at = v_now + r.bonus_wait, story_recheck_tries = 0
     where id = v.id;
    return jsonb_build_object('ok', true, 'outcome', 'credited', 'story', 'waiting', 'recheck_at', v_now + r.bonus_wait);
  end if;

  v_kind := case when v.voucher is null then 'prepay' else 'voucher' end;
  -- What the guest paid: Available now (MESITA-4214).
  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
  values (v.consumer_id, v.place_id, v_kind, v.amount_cents, v.currency, v.id, v.livemode, least(v_at, v_now));
  -- The bonus: Available at p_available_at.
  if v.bonus_cents > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'bonus', v.bonus_cents, v.currency, v.id, v.livemode, v_at);
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'credited');
end;
$function$;

-- ── 7. The cron: checks past their time, mentions past 24 hours ──────────────
create or replace function public.wallet_sweep_stories(p_limit integer default 200)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_expired integer;
  v_deleted integer;
begin
  with due as (
    select id from public.story_checks
     where state in ('open', 'approved') and expires_at <= now()
     order by expires_at
     limit greatest(coalesce(p_limit, 200), 1)
     for update skip locked
  )
  update public.story_checks s set state = 'expired' from due where s.id = due.id;
  get diagnostics v_expired = row_count;

  -- A story nobody paid with: gone after 24 hours unless a live check holds it.
  with old as (
    select m.id from public.story_mentions m
      left join public.story_checks k on k.id = m.check_id
     where m.purchase_id is null and m.mentioned_at < now() - interval '24 hours'
       and (m.check_id is null or k.state = 'expired')
     limit greatest(coalesce(p_limit, 200), 1)
  )
  delete from public.story_mentions s using old where s.id = old.id;
  get diagnostics v_deleted = row_count;

  return jsonb_build_object('ok', true, 'expired', v_expired, 'deleted', v_deleted);
end;
$function$;

-- ── 8. The operator's escape hatch on a check ────────────────────────────────
create or replace function public.wallet_story_check_admin(p_check uuid, p_action text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  c public.story_checks;
begin
  if p_action is null or p_action not in ('expire_check', 'release_story') then
    return jsonb_build_object('ok', false, 'code', 'unknown_action');
  end if;
  select * into c from public.story_checks where id = p_check for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if c.state = 'used' then
    return jsonb_build_object('ok', false, 'code', 'used');
  end if;
  if p_action = 'expire_check' then
    update public.story_checks set state = 'expired' where id = c.id and state in ('open', 'approved');
    return jsonb_build_object('ok', true, 'outcome', 'expired');
  end if;
  return public.wallet_reopen_story_check(c.id);
end;
$function$;

-- ── 9. Retired: the purchase-level review and the 7-day expiry ───────────────
create or replace function public.wallet_review_story(
  p_token text, p_mention uuid, p_approve boolean, p_device_hash text default null)
 returns jsonb
 language sql
 security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object('ok', false, 'code', 'reload');
$function$;

create or replace function public.wallet_expire_stories(p_limit integer default 50)
 returns integer
 language sql
 security definer
 set search_path to 'public'
as $function$
  select 0;
$function$;

-- ── 10. The operator's override: release | void ──────────────────────────────
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
  if p_action is null or p_action not in ('release', 'void') then
    return jsonb_build_object('ok', false, 'code', 'unknown_action');
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

-- ── 11. Grants: service role only ────────────────────────────────────────────
revoke all on function public.wallet_open_story_check(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.wallet_open_story_check(uuid, uuid, boolean) to service_role;
revoke all on function public.wallet_review_story_check(text, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.wallet_review_story_check(text, uuid, boolean, text) to service_role;
revoke all on function public.wallet_reopen_story_check(uuid) from public, anon, authenticated;
grant execute on function public.wallet_reopen_story_check(uuid) to service_role;
revoke all on function public.wallet_sweep_stories(integer) from public, anon, authenticated;
grant execute on function public.wallet_sweep_stories(integer) to service_role;
revoke all on function public.wallet_story_check_admin(uuid, text) from public, anon, authenticated;
grant execute on function public.wallet_story_check_admin(uuid, text) to service_role;
revoke all on function public.wallet_credit_purchase(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.wallet_credit_purchase(uuid, text, timestamptz) to service_role;
revoke all on function public.wallet_review_story(text, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.wallet_review_story(text, uuid, boolean, text) to service_role;
revoke all on function public.wallet_expire_stories(integer) from public, anon, authenticated;
grant execute on function public.wallet_expire_stories(integer) to service_role;
revoke all on function public.wallet_override_story(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.wallet_override_story(uuid, text, uuid) to service_role;

comment on function public.wallet_review_story_check(text, uuid, boolean, text) is
  'MESITA-4297: the waiter''s answer on a Story check. Approve claims one story of the guest''s verified handle no older than story_rules().max_story_age (unclaimed, or held by this guest''s own expired unused check), an emulator story only on a test check; the check is good story_approve_valid_sec to start paying. Reject keeps the check open. Refuses: gone, already_decided, story_gone, story_claimed, story_too_old {age_sec, max_story_age_sec}, handle_mismatch, emulator_on_live. Service role only.';
comment on function public.wallet_credit_purchase(uuid, text, timestamptz) is
  'MESITA-4297: credits a paid purchase. A Story writes its voucher entry Available now and uses its check when unused, approved (or expired since) and still holding its story: the bonus re-check is paid_at + story_rules().bonus_wait. Otherwise the bonus is void (not_verified); the money always lands. Service role only.';
comment on function public.wallet_review_story(text, uuid, boolean, text) is
  'MESITA-4297: retired; writes nothing and answers code reload (the waiter reviews a story check before payment). Dropped by a later cleanup.';
comment on function public.wallet_expire_stories(integer) is
  'MESITA-4297: retired; returns 0 (no purchase waits on an approval any more). Dropped by a later cleanup.';
comment on function public.wallet_override_story(uuid, text, uuid) is
  'MESITA-4297: the operator''s release | void of one Story bonus (unapprove is gone: use wallet_story_check_admin expire_check before payment, void after). void after release reverses the bonus (reason story_void), capped at what the guest holds. Service role only.';

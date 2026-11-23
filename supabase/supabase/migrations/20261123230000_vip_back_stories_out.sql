-- MESITA-4766 — VIP IS BACK, INSTAGRAM STORIES ARE OUT. Pato, 2026-11-23:
-- "BRING BACK VIP CUSTOMERS. REMOVE INSTAGRAM STORIES. NOW THE PAY OFFERS ARE
-- Welcome Everyone, Returning Regular, Returning VIP … In order to be VIP, is
-- either invitation code or 5000 followers on instagram."
--
-- 1. Pay (Back) has three lines: Welcome Everyone (first paid bill here, VIP or
--    not), Returning Regular (a later bill, not VIP), Returning VIP (a later
--    bill, VIP). New returning_vip_bps (Off · 10 · 20 %), default 10 %;
--    existing places get 0 where their Returning is Off, else 10 %.
-- 2. VIP = an invitation code (consumers.vip_invited_at) OR a verified
--    Instagram with more than 5,000 followers. guest_class shows it (the
--    test-mode emulator counts); money asks consumer_is_vip_for_money, where
--    live mode counts only the real followers.
-- 3. consumer_redeem_vip_invitation comes back (dropped by 20261114080000),
--    setting vip_invited_at; the code is claimed atomically, failures are
--    logged and limited to 10 an hour per guest.
-- 4. Instagram Stories are removed: story_mentions, the story RPCs, the
--    verify-stories cron, the Monitor stories kind and
--    wallet_entries.story_mention_id. The one live story credit stays and
--    stays spendable; nothing can write a new story entry. story_reward_cents
--    stays (unread, 0) until the old functions are gone (follow-up issue).
--    Restore: git tag stories-final-2.

-- ── 1. Three Pay lines ─────────────────────────────────────────────────────
alter table public.place_cashback_settings
  add column if not exists returning_vip_bps integer not null default 1000;
alter table public.cashback_defaults
  add column if not exists returning_vip_bps integer not null default 1000;

-- An owner who switched repeat Back off is not opted in to VIP Back.
update public.place_cashback_settings set returning_vip_bps = 0 where returning_bps = 0;
update public.cashback_defaults set returning_vip_bps = 0 where returning_bps = 0;

alter table public.place_cashback_settings drop constraint if exists place_cashback_settings_returning_vip_bps_check;
alter table public.place_cashback_settings add constraint place_cashback_settings_returning_vip_bps_check
  check (returning_vip_bps in (0, 1000, 2000));
alter table public.cashback_defaults drop constraint if exists cashback_defaults_returning_vip_bps_check;
alter table public.cashback_defaults add constraint cashback_defaults_returning_vip_bps_check
  check (returning_vip_bps in (0, 1000, 2000));

comment on column public.place_cashback_settings.returning_bps is
  'Returning Regular (non-VIP later bills) since MESITA-4766. Off · 5 · 10 %.';
comment on column public.place_cashback_settings.returning_vip_bps is
  'MESITA-4766: Returning VIP — a later paid bill by a VIP guest (consumer_is_vip_for_money). Off · 10 · 20 %.';

-- story_reward_cents: kept this release so the old functions keep working
-- until they redeploy; 0 everywhere, read by nothing new.
alter table public.place_cashback_settings alter column story_reward_cents set default 0;
alter table public.cashback_defaults alter column story_reward_cents set default 0;
update public.place_cashback_settings set story_reward_cents = 0 where story_reward_cents <> 0;
update public.cashback_defaults set story_reward_cents = 0 where story_reward_cents <> 0;

-- place_cashback_rates: the three lines (its return type changes, so drop
-- it once its story callers are gone below; recreated after).

-- ── 2. VIP: code or followers ──────────────────────────────────────────────
alter table public.consumers
  add column if not exists vip_invited_at timestamptz,
  add column if not exists vip_invitation_code_id uuid
    references public.vip_invitation_codes (id) on delete set null;

alter table public.consumers
  alter column guest_class set expression as (
    case
      when vip_invited_at is not null then 'vip'
      when instagram_verified_at is not null
           and coalesce(instagram_followers_emulated, instagram_followers_count, 0) > 5000 then 'vip'
      else 'regular'
    end
  );

comment on column public.consumers.guest_class is
  'MESITA-4766: vip when an invitation code made the guest VIP (vip_invited_at) or a verified Instagram has more than 5,000 followers (the test-mode emulator counts here); else regular. What screens show. Money asks consumer_is_vip_for_money.';
comment on column public.consumers.vip_invited_at is
  'MESITA-4766: when an invitation code made this guest VIP (consumer_redeem_vip_invitation); null = not by code. Cleared by admin-web-save-vip-code removeVip.';
comment on column public.consumers.vip_invitation_code_id is
  'MESITA-4766: the code that made this guest VIP; the code stays used after a removal.';

-- The one money rule: who is paid the Returning VIP line. Live money counts
-- only real followers; test mode lets the emulator stand in.
create or replace function public.consumer_is_vip_for_money(p_consumer uuid, p_livemode boolean)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select coalesce((
    select c.vip_invited_at is not null
        or (c.instagram_verified_at is not null
            and (case when p_livemode then coalesce(c.instagram_followers_count, 0)
                      else coalesce(c.instagram_followers_emulated, c.instagram_followers_count, 0) end) > 5000)
      from public.consumers c
     where c.id = p_consumer
  ), false);
$function$;
revoke all on function public.consumer_is_vip_for_money(uuid, boolean) from public, anon, authenticated;
grant execute on function public.consumer_is_vip_for_money(uuid, boolean) to service_role;
comment on function public.consumer_is_vip_for_money(uuid, boolean) is
  'MESITA-4766: whether this guest is paid as VIP: invited by code, or a verified Instagram over 5,000 followers (live: real count only; test: the emulator may stand in). The one rule the cashback trigger, placeCashbackFor and admin read.';

-- ── 3. The redeem ──────────────────────────────────────────────────────────
create or replace function public.consumer_redeem_vip_invitation(p_consumer uuid, p_code text, p_livemode boolean)
 returns jsonb
 language plpgsql
 volatile
 security definer
 set search_path to 'public'
as $function$
declare
  v_last4 text;
  v_hash text;
  v_invited timestamptz;
  v_fails integer;
  v_oldest timestamptz;
  v_code_id uuid;
  v_miss text;
begin
  if p_code is null or p_code !~ '^[0-9]{12}$' then
    raise exception 'p_code must be twelve digits' using errcode = '22023';
  end if;
  v_last4 := right(p_code, 4);
  v_hash := encode(sha256(convert_to(p_code, 'UTF8')), 'hex');

  -- The guest's row, locked: two taps from one guest run one after the other.
  select c.vip_invited_at into v_invited
    from public.consumers c
   where c.id = p_consumer and c.deleted_at is null
   for update;
  if not found then
    return jsonb_build_object('outcome', 'consumer_not_found');
  end if;

  if v_invited is not null or public.consumer_is_vip_for_money(p_consumer, p_livemode) then
    insert into public.vip_invitation_attempts (consumer_id, code_last4, outcome)
    values (p_consumer, v_last4, 'already_vip');
    return jsonb_build_object('outcome', 'already_vip');
  end if;

  select count(*), min(a.created_at) into v_fails, v_oldest
    from public.vip_invitation_attempts a
   where a.consumer_id = p_consumer
     and a.outcome in ('invalid', 'used', 'revoked')
     and a.created_at > now() - interval '1 hour';
  if v_fails >= 10 then
    insert into public.vip_invitation_attempts (consumer_id, code_last4, outcome)
    values (p_consumer, v_last4, 'rate_limited');
    return jsonb_build_object('outcome', 'rate_limited',
      'retry_after_seconds', greatest(1, ceil(extract(epoch from (v_oldest + interval '1 hour' - now())))::integer));
  end if;

  -- One statement claims the code: two guests racing for it cannot both win.
  update public.vip_invitation_codes k
     set used_by = p_consumer, used_at = now()
   where k.code_hash = v_hash and k.used_at is null and k.revoked_at is null
  returning k.id into v_code_id;

  if v_code_id is null then
    select case when k.revoked_at is not null then 'revoked' else 'used' end into v_miss
      from public.vip_invitation_codes k where k.code_hash = v_hash;
    insert into public.vip_invitation_attempts (consumer_id, code_last4, outcome)
    values (p_consumer, v_last4, coalesce(v_miss, 'invalid'));
    return jsonb_build_object('outcome', 'invalid');
  end if;

  update public.consumers
     set vip_invited_at = now(), vip_invitation_code_id = v_code_id
   where id = p_consumer;
  insert into public.vip_invitation_attempts (consumer_id, code_last4, outcome)
  values (p_consumer, v_last4, 'joined');
  return jsonb_build_object('outcome', 'joined');
end;
$function$;
revoke all on function public.consumer_redeem_vip_invitation(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.consumer_redeem_vip_invitation(uuid, text, boolean) to service_role;
comment on function public.consumer_redeem_vip_invitation(uuid, text, boolean) is
  'MESITA-4766: one guest uses one VIP invitation code (consumer-web-redeem-vip-code). Outcomes: joined · already_vip (nothing used or set) · invalid (unknown, used or revoked read the same) · rate_limited (+ retry_after_seconds; 10 failures an hour) · consumer_not_found. Never raises on a wrong code, so the attempt log always commits.';

-- Admin › VIP › Remove VIP: only a code-made VIP; the code stays used.
create or replace function public.admin_remove_vip(p_consumer uuid)
 returns text
 language plpgsql
 volatile
 security definer
 set search_path to 'public'
as $function$
begin
  update public.consumers
     set vip_invited_at = null, vip_invitation_code_id = null
   where id = p_consumer and vip_invited_at is not null;
  if found then
    return 'removed';
  end if;
  if exists (select 1 from public.consumers where id = p_consumer) then
    return 'not_code_vip';
  end if;
  return 'consumer_not_found';
end;
$function$;
revoke all on function public.admin_remove_vip(uuid) from public, anon, authenticated;
grant execute on function public.admin_remove_vip(uuid) to service_role;
comment on function public.admin_remove_vip(uuid) is
  'MESITA-4766: clears an invitation-code VIP (admin-web-save-vip-code removeVip). removed · not_code_vip (a follower VIP or a Regular) · consumer_not_found. The code stays used.';

-- ── 4. Instagram Stories out ───────────────────────────────────────────────
do $$
begin
  perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'verify-stories';
exception when undefined_table or invalid_schema_name then
  null; -- no pg_cron here (a bare local DB): nothing to unschedule
end $$;

-- place_monitor_list without the stories kind (it read story_mention_id).
create or replace function public.place_monitor_list(p_place_id uuid, p_livemode boolean, p_kind text, p_customer text DEFAULT NULL::text, p_id uuid DEFAULT NULL::uuid, p_before jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_rank integer := coalesce((p_before ->> 'rank')::integer, 0);
  v_at timestamptz := (p_before ->> 'at')::timestamptz;
  v_id uuid := (p_before ->> 'id')::uuid;
  v_rows jsonb;
  v_next jsonb;
begin
  if p_kind not in ('visits', 'vouchers', 'gifts', 'payments', 'credits') then
    raise exception 'place_monitor_list: kind must be visits, vouchers, gifts, payments or credits';
  end if;

  with base as (
    -- Visits: the bills place_visit_rows keeps (MESITA-4682), with how each
    -- was settled read from the bill row itself; a split table carries its
    -- shares' total and count, and its shares are rows of their own.
    select t.id, t.at, 0 as rank,
           t.consumer_id, null::uuid as other_id,
           jsonb_build_object(
             'status', t.status,
             'bill_cents', t.bill_cents,
             'tip_cents', t.tip_cents,
             'card_cents', t.card_bill_cents,
             'credit_cents', t.credit_cents,
             'outside_cents', t.cash_bill_cents,
             'split', t.split_at is not null,
             'shares', t.shares,
             'shares_total_cents', t.shares_total_cents,
             'share', t.parent_tab_id is not null,
             'ticket', t.ticket,
             'waiter_name', t.waiter_name,
             -- MESITA-4703: the cashback this bill earned (MESITA-4698), 0 when none.
             'cashback_cents', coalesce((select sum(e.amount_cents) from public.wallet_entries e
                                          where e.tab_id = t.id and e.kind = 'cashback'), 0)) as payload,
           coalesce((select jsonb_agg(jsonb_build_object('kind', 'payment', 'id', p.id) order by p.created_at)
                       from public.wallet_payments p
                      where p.tab_id = t.id and p.paid_at is not null), '[]'::jsonb) as links
      from public.place_visit_rows(p_place_id, p_livemode) t
     where p_kind = 'visits'
    union all
    -- Vouchers: paid prepayments.
    select v.id, v.paid_at, 0, v.consumer_id, null::uuid,
           jsonb_build_object(
             'status', v.status,
             'voucher', v.voucher,
             'amount_cents', v.amount_cents,
             'bonus_cents', v.bonus_cents,
             'refunded_cents', v.refunded_cents,
             'currency', v.currency),
           coalesce((select jsonb_agg(jsonb_build_object('kind', 'credit', 'id', e.id) order by e.created_at)
                       from public.wallet_entries e where e.purchase_id = v.id), '[]'::jsonb)
      from public.wallet_purchases v
     where p_kind = 'vouchers'
       and v.place_id = p_place_id and v.livemode = p_livemode and v.paid_at is not null
    union all
    -- Payments (MESITA-4682, Pato: "just mention the Stripe Payments
    -- events"): card charges only. Cash and credit live on Visits.
    select p.id, p.paid_at, 0, p.consumer_id, null::uuid,
           jsonb_build_object(
             'status', p.status,
             'amount_cents', p.amount_cents,
             'credit_cents', p.credit_cents,
             'card_cents', p.card_cents,
             'outside_cents', p.outside_cents,
             'tip_cents', p.tip_cents,
             'refunded_cents', p.refunded_cents,
             'credit_refunded_cents', p.credit_refunded_cents,
             'currency', p.currency),
           (case when p.tab_id is not null then jsonb_build_array(jsonb_build_object('kind', 'visit', 'id', p.tab_id)) else '[]'::jsonb end)
           || coalesce((select jsonb_agg(jsonb_build_object('kind', 'credit', 'id', e.id) order by e.created_at)
                          from public.wallet_entries e where e.payment_id = p.id), '[]'::jsonb)
      from public.wallet_payments p
     where p_kind = 'payments'
       and p.place_id = p_place_id and p.livemode = p_livemode and p.paid_at is not null
       and p.card_cents > 0
    union all
    -- Credits: every wallet_entries row, the ledger itself.
    select e.id, e.created_at, 0, e.consumer_id,
           case e.kind when 'gift_out' then g.recipient_id
                       when 'gift_in' then g.sender_id
                       when 'gift_back' then g.recipient_id end,
           jsonb_build_object(
             'kind', e.kind,
             'reason', e.reason,
             'amount_cents', e.amount_cents,
             'currency', e.currency,
             'gift_status', g.status,
             'voucher', pu.voucher),
           (case when e.purchase_id is not null then jsonb_build_array(jsonb_build_object('kind', 'voucher', 'id', e.purchase_id)) else '[]'::jsonb end)
           || (case when e.payment_id is not null then jsonb_build_array(jsonb_build_object('kind', 'payment', 'id', e.payment_id)) else '[]'::jsonb end)
           || (case when pay.tab_id is not null then jsonb_build_array(jsonb_build_object('kind', 'visit', 'id', pay.tab_id)) else '[]'::jsonb end)
      from public.wallet_entries e
      left join public.wallet_gifts g on g.id = e.gift_id
      left join public.wallet_purchases pu on pu.id = e.purchase_id
      left join public.wallet_payments pay on pay.id = e.payment_id
     where p_kind = 'credits'
       and e.place_id = p_place_id and e.livemode = p_livemode
    union all
    -- Gifts (MESITA-4555): one row per gift link at the place: the sender is
    -- the row's guest, the friend who took it the other guest.
    select g.id, g.created_at, 0, g.sender_id, g.recipient_id,
           jsonb_build_object(
             'status', g.status,
             'amount_cents', g.amount_cents,
             'currency', g.currency,
             'claimed_at', g.claimed_at,
             'taken_back_at', g.taken_back_at),
           '[]'::jsonb
      from public.wallet_gifts g
     where p_kind = 'gifts'
       and g.place_id = p_place_id and g.livemode = p_livemode
  ), filtered as (
    select b.*
      from base b
     where (p_id is null or b.id = p_id
            or b.links @> jsonb_build_array(jsonb_build_object('id', p_id::text)))
       and (p_customer is null
            or public.place_customer_key(p_place_id, b.consumer_id) = p_customer
            or public.place_customer_key(p_place_id, b.other_id) = p_customer)
  ), page as (
    select f.*
      from filtered f
     where p_before is null
        or f.rank > v_rank
        or (f.rank = v_rank and (f.at, f.id) < (v_at, v_id))
     order by f.rank, f.at desc, f.id desc
     limit 51
  ), named as (
    select page.*,
           row_number() over (order by page.rank, page.at desc, page.id desc) as n,
           coalesce(nullif(btrim(c.full_name), ''), nullif(btrim(c.first_name), '')) as guest_name,
           u.email as guest_email,
           coalesce(nullif(btrim(oc.full_name), ''), nullif(btrim(oc.first_name), '')) as other_name,
           ou.email as other_email
      from page
      left join public.consumers c on c.id = page.consumer_id
      left join auth.users u on u.id = page.consumer_id
      left join public.consumers oc on oc.id = page.other_id
      left join auth.users ou on ou.id = page.other_id
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', n.id,
      'at', n.at,
      'rank', n.rank,
      'customer', public.place_customer_key(p_place_id, n.consumer_id),
      'other_customer', public.place_customer_key(p_place_id, n.other_id),
      'guest_name', n.guest_name,
      'guest_email', n.guest_email,
      'other_name', n.other_name,
      'other_email', n.other_email,
      'face', public.place_guest_face(n.consumer_id),
      'other_face', public.place_guest_face(n.other_id),
      'payload', n.payload,
      'links', n.links
    ) order by n.n) filter (where n.n <= 50), '[]'::jsonb),
    (select jsonb_build_object('rank', x.rank, 'at', x.at, 'id', x.id)
       from named x where x.n = 50 and exists (select 1 from named y where y.n = 51))
    into v_rows, v_next
    from named n;

  return jsonb_build_object('rows', v_rows, 'next', v_next);
end;
$function$;

-- The story RPCs, then the column, then the table. Never CASCADE: a reader we
-- missed fails this migration loudly instead of being dropped.
drop function if exists public.story_reward_reject(uuid, text, timestamptz);
drop function if exists public.story_reward_grant(uuid, uuid, timestamptz);
drop function if exists public.story_reward_pay(uuid, timestamptz);
drop function if exists public.story_ai_claim(integer, integer);
drop function if exists public.story_ai_fail(uuid, text, boolean);
drop function if exists public.story_ai_verdict(uuid, jsonb, text);
drop function if exists public.story_mentions_expire(timestamptz);
drop function if exists public.story_recheck_claim(integer);
drop function if exists public.instagram_handle_of_url(text);

alter table public.wallet_entries drop constraint if exists wallet_entries_kind_shape_chk;
alter table public.wallet_entries drop constraint if exists wallet_entries_story_only_chk;
alter table public.wallet_entries drop constraint if exists wallet_entries_story_mention_id_fkey;
alter table public.wallet_entries drop column if exists story_mention_id;

-- The shape check without story_mention_id: an old story entry keeps its
-- shape (a positive amount tied to nothing else).
alter table public.wallet_entries add constraint wallet_entries_kind_shape_chk check (
case kind
    when 'prepay' then ((amount_cents > 0) and (purchase_id is not null) and (payment_id is null) and (gift_id is null))
    when 'voucher' then ((amount_cents > 0) and (purchase_id is not null) and (payment_id is null) and (gift_id is null))
    when 'bonus' then ((amount_cents > 0) and (purchase_id is not null) and (payment_id is null) and (gift_id is null))
    when 'cashback' then ((amount_cents > 0) and (tab_id is not null) and (purchase_id is null) and (payment_id is null) and (gift_id is null))
    when 'story' then ((amount_cents > 0) and (tab_id is null) and (purchase_id is null) and (payment_id is null) and (gift_id is null))
    when 'spend' then ((amount_cents < 0) and (payment_id is not null) and (purchase_id is null) and (gift_id is null))
    when 'reversal' then ((amount_cents < 0) and ((purchase_id is not null) or (payment_id is not null)) and (gift_id is null))
    when 'refund' then ((amount_cents > 0) and (payment_id is not null) and (purchase_id is null) and (gift_id is null))
    when 'gift_out' then ((amount_cents < 0) and (gift_id is not null) and (purchase_id is null) and (payment_id is null))
    when 'gift_in' then ((amount_cents > 0) and (gift_id is not null) and (purchase_id is null) and (payment_id is null))
    when 'gift_back' then ((amount_cents > 0) and (gift_id is not null) and (purchase_id is null) and (payment_id is null))
    else false
end);

alter table public.wallet_entries drop constraint if exists wallet_entries_reason_chk;
alter table public.wallet_entries add constraint wallet_entries_reason_chk check (
  reason is null
  or (kind = 'reversal' and reason in ('refund', 'dispute_lost', 'credit_refund'))
  or (kind = 'cashback' and reason in ('welcome', 'returning', 'returning_vip'))
);

drop table if exists public.story_mentions;

-- Nothing writes a new story entry; the ones that exist stay.
create or replace function public.wallet_entries_refuse_story()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  raise exception 'wallet_entries kind ''story'' retired (MESITA-4766); restore from tag stories-final-2'
    using errcode = '23514';
end;
$function$;
drop trigger if exists wallet_entries_refuse_story on public.wallet_entries;
create trigger wallet_entries_refuse_story
  before insert on public.wallet_entries
  for each row when (new.kind = 'story')
  execute function public.wallet_entries_refuse_story();

-- ── 1 (cont). The rates and the grant ──────────────────────────────────────
drop function if exists public.place_cashback_rates(uuid);
create function public.place_cashback_rates(p_place_id uuid)
 returns table(welcome_bps integer, returning_bps integer, returning_vip_bps integer)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(s.welcome_bps, d.welcome_bps, 1000), coalesce(s.returning_bps, d.returning_bps, 500),
         coalesce(s.returning_vip_bps, d.returning_vip_bps, 1000)
    from (select 1) one
    left join public.cashback_defaults d on d.id
    left join public.place_cashback_settings s on s.place_id = p_place_id;
$function$;
revoke all on function public.place_cashback_rates(uuid) from public, anon, authenticated;
grant execute on function public.place_cashback_rates(uuid) to service_role;

create or replace function public.pay_tab_grant_cashback(p_tab_id uuid, p_now timestamptz default now())
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  t public.pay_tabs;
  v_earn integer;
  v_line text;
  v_bps integer;
  r record;
  v_amount integer;
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

  -- Welcome Everyone: no earlier paid bill here (VIP or not). Otherwise
  -- Returning VIP for a VIP (the bill's own money mode), else Returning Regular.
  if not exists (
    select 1 from public.pay_tabs o
     where o.consumer_id = t.consumer_id and o.place_id = t.place_id
       and o.livemode = t.livemode and o.status = 'paid' and o.id <> t.id
       and o.paid_at < coalesce(t.paid_at, p_now)) then
    v_line := 'welcome';
  elsif public.consumer_is_vip_for_money(t.consumer_id, t.livemode) then
    v_line := 'returning_vip';
  else
    v_line := 'returning';
  end if;

  select * into r from public.place_cashback_rates(t.place_id);
  v_bps := case v_line when 'welcome' then r.welcome_bps
                       when 'returning_vip' then r.returning_vip_bps
                       else r.returning_bps end;
  if v_bps <= 0 then
    return 0;
  end if;
  -- No ceiling (MESITA-4728): the rate on every peso paid by card or cash.
  v_amount := (v_earn::bigint * v_bps / 10000)::integer;
  if v_amount <= 0 then
    return 0;
  end if;

  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, tab_id, livemode, available_at, reason)
  values (t.consumer_id, t.place_id, 'cashback', v_amount, lower(t.currency), t.id, t.livemode,
          coalesce(t.paid_at, p_now) + interval '1 hour', v_line);
  return v_amount;
end;
$function$;

revoke all on function public.pay_tab_grant_cashback(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_tab_grant_cashback(uuid, timestamptz) to service_role;
comment on function public.pay_tab_grant_cashback(uuid, timestamptz) is
  'MESITA-4698, MESITA-4728, MESITA-4766: one paid bill''s Back: Welcome Everyone (first paid bill here), else Returning VIP (consumer_is_vip_for_money in the bill''s livemode) or Returning Regular, on cash_bill_cents + card_bill_cents, no cap, Pending 1 hour; none where Loyalty Cards is Off or on a bill that already has one. Reason = the line. Internal.';

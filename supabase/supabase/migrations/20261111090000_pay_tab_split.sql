-- MESITA-3695 — Pay at the table: friends split one bill.
--
-- The waiter bills the table once, as before. The guest holding that tab
-- taps Split: the tab becomes the TABLE (the parent) and every payer,
-- the guest included, gets a SHARE: an ordinary pay_tabs row under it
-- (parent_tab_id), billed with the share as its bill and its own part of the
-- tip suggestion. A share is paid exactly as a whole tab is paid today
-- (pay_tab_open_parts, the card part, the waiter's Received), so credits,
-- cashback, cards and cash stay per person. Friends join with the table's
-- join token (a QR on the guest's screen); the waiter's token never joins.
--
--   pay_tabs.parent_tab_id      a share's table (null on a table or a plain tab)
--   pay_tabs.split_at, split_ways, join_token_hash
--                               a table that was split, into how many, and
--                               the hash of its newest join QR
--   pay_tab_split(...)          the guest splits (or changes their share, or
--                               stops splitting while nothing is paid)
--   pay_tab_join(...)           a friend joins: a share of what is left
--   pay_tab_set_share(...)      a payer changes their share before paying
--   pay_tabs_split_guard        BEFORE UPDATE: a split table is never paid
--                               whole; a share starts paying only if it fits
--                               in what is left, under the table's row lock
--   pay_tabs_follow_shares      AFTER UPDATE: shares that cover the bill pay
--                               the table; every share's move keeps the
--                               table alive 30 more minutes
--
-- Additive: four nullable columns, the one-open index narrowed to tables,
-- pay_tab_open and pay_tab_bill taught about shares, three new functions,
-- two triggers. Old EFs keep working through the migration-before-functions
-- window: they never split, so no row they touch has a parent or a split.

-- ── 1. The columns ──────────────────────────────────────────────────────────
alter table public.pay_tabs
  add column parent_tab_id uuid references public.pay_tabs(id) on delete restrict,
  add column split_at timestamptz,
  add column split_ways smallint check (split_ways is null or split_ways between 2 and 20),
  add column join_token_hash text unique check (join_token_hash is null or join_token_hash ~ '^[0-9a-f]{64}$'),
  add constraint pay_tabs_share_not_split check (parent_tab_id is null or split_at is null);

create index pay_tabs_parent_idx on public.pay_tabs (parent_tab_id) where parent_tab_id is not null;

comment on column public.pay_tabs.parent_tab_id is
  'MESITA-3695: a share''s table. A share is an ordinary tab whose bill is the payer''s share of the table''s bill.';
comment on column public.pay_tabs.split_at is
  'MESITA-3695: when the guest split this table among friends. A split table is paid only by its shares.';
comment on column public.pay_tabs.join_token_hash is
  'MESITA-3695: the hash of the table''s newest join QR (friends scan it to take a share). Never the waiter''s token.';

-- One open TABLE per guest per place; shares are not counted (a friend may
-- hold a share at a place where they also opened their own tab).
drop index public.pay_tabs_one_open;
create unique index pay_tabs_one_open on public.pay_tabs (consumer_id, place_id, livemode)
  where status in ('waiting_bill', 'billed', 'paying') and parent_tab_id is null;

-- ── 2. Open (or reuse) never picks a share ─────────────────────────────────
create or replace function public.pay_tab_open(
  p_consumer_id uuid, p_place_id uuid, p_token_hash text, p_currency text, p_livemode boolean,
  p_ttl interval default interval '30 minutes', p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
begin
  if p_consumer_id is null or p_place_id is null or p_token_hash is null then
    raise exception 'pay_tab_open: consumer, place and token are required';
  end if;
  perform public.wallet_lock(p_consumer_id, p_place_id);

  -- A stale tab whose bill was paid (credits) and only a cash tip went
  -- unconfirmed reads paid; any other stale tab expires. A row still in
  -- flight keeps its tab open. A split table is left to its shares.
  update public.pay_tabs t
     set status = case when exists (select 1 from public.wallet_payments w where w.tab_id = t.id and w.paid_at is not null)
                       then 'paid' else 'expired' end,
         paid_at = case when exists (select 1 from public.wallet_payments w where w.tab_id = t.id and w.paid_at is not null)
                        then p_now end,
         updated_at = now()
   where t.consumer_id = p_consumer_id and t.place_id = p_place_id and t.livemode = p_livemode
     and t.status in ('waiting_bill', 'billed', 'paying') and t.expires_at <= p_now
     and t.split_at is null
     and not exists (select 1 from public.wallet_payments w
                      where w.tab_id = t.id and w.status in ('opening', 'open')
                        and (w.expires_at is null or w.expires_at > p_now));
  -- A stale split table with no share still in flight expires (its paid
  -- shares stay paid; the rest is paid to the waiter directly).
  update public.pay_tabs t
     set status = 'expired', updated_at = now()
   where t.consumer_id = p_consumer_id and t.place_id = p_place_id and t.livemode = p_livemode
     and t.status = 'billed' and t.split_at is not null and t.expires_at <= p_now
     and not exists (select 1 from public.pay_tabs s where s.parent_tab_id = t.id and s.status = 'paying');

  select * into v from public.pay_tabs
   where consumer_id = p_consumer_id and place_id = p_place_id and livemode = p_livemode
     and status in ('waiting_bill', 'billed', 'paying') and parent_tab_id is null
   for update;
  if found then
    if v.status = 'waiting_bill' then
      update public.pay_tabs set token_hash = p_token_hash, expires_at = p_now + p_ttl, updated_at = now()
       where id = v.id;
      return jsonb_build_object('ok', true, 'outcome', 'reused', 'tab_id', v.id, 'status', v.status,
        'token_rotated', true, 'expires_at', p_now + p_ttl);
    end if;
    return jsonb_build_object('ok', true, 'outcome', 'reused', 'tab_id', v.id, 'status', v.status,
      'token_rotated', false, 'expires_at', v.expires_at);
  end if;

  insert into public.pay_tabs (place_id, consumer_id, token_hash, currency, livemode, expires_at)
  values (p_place_id, p_consumer_id, p_token_hash, lower(p_currency), p_livemode, p_now + p_ttl)
  returning * into v;
  return jsonb_build_object('ok', true, 'outcome', 'opened', 'tab_id', v.id, 'status', v.status,
    'token_rotated', true, 'expires_at', v.expires_at);
end;
$function$;

-- ── 3. A split table's bill is locked ───────────────────────────────────────
create or replace function public.pay_tab_bill(
  p_token_hash text, p_staff_key_hash text, p_rekey boolean, p_bill_version integer,
  p_bill_cents integer, p_tip_cents integer, p_ticket text, p_waiter_name text,
  p_ttl interval default interval '30 minutes', p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
begin
  if p_bill_cents is null or p_bill_cents <= 0 or p_bill_cents > 10000000
     or p_tip_cents is null or p_tip_cents < 0 or p_tip_cents > 10000000 then
    return jsonb_build_object('ok', false, 'code', 'amount_required');
  end if;
  select * into v from public.pay_tabs where token_hash = p_token_hash for update;
  if not found or v.parent_tab_id is not null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.status in ('waiting_bill', 'billed') and v.expires_at <= p_now and v.split_at is null then
    update public.pay_tabs set status = 'expired', updated_at = now() where id = v.id;
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  if v.status in ('expired', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', v.status);
  end if;
  if v.status in ('paying', 'paid') then
    return jsonb_build_object('ok', false, 'code', 'paying', 'status', v.status);
  end if;
  if v.split_at is not null then
    -- Friends are paying shares of this bill: a mistake is a refund now.
    return jsonb_build_object('ok', false, 'code', 'split_locked');
  end if;
  if not p_rekey and (v.staff_key_hash is null or p_staff_key_hash is null or v.staff_key_hash <> p_staff_key_hash) then
    return jsonb_build_object('ok', false, 'code', 'staff_key');
  end if;
  if p_bill_version is distinct from v.bill_version then
    return jsonb_build_object('ok', false, 'code', 'stale', 'bill_version', v.bill_version);
  end if;

  update public.pay_tabs
     set status = 'billed', bill_cents = p_bill_cents, tip_cents = p_tip_cents,
         ticket = nullif(btrim(p_ticket), ''), waiter_name = nullif(btrim(p_waiter_name), ''),
         staff_key_hash = case when p_rekey then p_staff_key_hash else staff_key_hash end,
         bill_version = v.bill_version + 1, billed_at = p_now,
         expires_at = greatest(v.expires_at, p_now + p_ttl), updated_at = now()
   where id = v.id;
  return jsonb_build_object('ok', true, 'outcome', 'billed', 'tab_id', v.id, 'bill_version', v.bill_version + 1,
    'bill_cents', p_bill_cents, 'tip_cents', p_tip_cents);
end;
$function$;

-- ── 4. What is left of a table ──────────────────────────────────────────────
-- p_reserving: count billed shares too (a share being chosen) or only those
-- paying or paid (what can actually still be paid).
create or replace function public.pay_tab_left(p_table_id uuid, p_reserving boolean, p_except uuid default null)
 returns integer
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select t.bill_cents - coalesce((
    select sum(s.bill_cents)::int from public.pay_tabs s
     where s.parent_tab_id = t.id and s.id is distinct from p_except
       and (s.status in ('paying', 'paid') or (p_reserving and s.status = 'billed' and s.expires_at > now()))), 0)
    from public.pay_tabs t where t.id = p_table_id;
$function$;

-- A share's own part of the waiter's tip suggestion.
create or replace function public.pay_tab_share_tip(p_tip_cents integer, p_bill_cents integer, p_share_cents integer)
 returns integer
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case when coalesce(p_bill_cents, 0) <= 0 then 0
              else round(coalesce(p_tip_cents, 0)::numeric * p_share_cents / p_bill_cents)::int end;
$function$;

-- A new share under a locked table (the caller holds the table's row lock).
create or replace function public.pay_tab_new_share(
  t public.pay_tabs, p_consumer_id uuid, p_token_hash text, p_share_cents integer, p_now timestamptz)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  insert into public.pay_tabs (place_id, consumer_id, token_hash, status, currency, livemode,
                               bill_cents, tip_cents, ticket, bill_version, waiter_name, staff_key_hash,
                               billed_at, expires_at, parent_tab_id)
  values (t.place_id, p_consumer_id, p_token_hash, 'billed', t.currency, t.livemode,
          p_share_cents, public.pay_tab_share_tip(t.tip_cents, t.bill_cents, p_share_cents), t.ticket, 1,
          t.waiter_name, t.staff_key_hash, p_now, p_now + interval '30 minutes', t.id)
  returning id into v_id;
  update public.pay_tabs set expires_at = greatest(expires_at, p_now + interval '30 minutes'), updated_at = now()
   where id = t.id;
  return v_id;
end;
$function$;

-- ── 5. The guest splits ─────────────────────────────────────────────────────
-- p_ways and p_share_cents set: the table is split (or its ways and the
-- guest's own share change while that share is not paying); the join QR
-- rotates to p_join_token_hash. Both null: stop splitting, only while no
-- share is paying or paid (every billed share is cancelled).
create or replace function public.pay_tab_split(
  p_tab_id uuid, p_consumer_id uuid, p_ways integer, p_share_cents integer,
  p_join_token_hash text, p_share_token_hash text, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  t public.pay_tabs;
  s public.pay_tabs;
  v_share uuid;
begin
  select * into t from public.pay_tabs where id = p_tab_id;
  if not found or t.consumer_id is distinct from p_consumer_id or t.parent_tab_id is not null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  perform public.wallet_lock(p_consumer_id, t.place_id);
  select * into t from public.pay_tabs where id = p_tab_id for update;

  if t.status = 'billed' and t.expires_at <= p_now and t.split_at is null then
    update public.pay_tabs set status = 'expired', updated_at = now() where id = t.id;
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  if t.status <> 'billed' then
    return jsonb_build_object('ok', false, 'code', case when t.status = 'waiting_bill' then 'not_billed'
      when t.status in ('paying', 'paid') then 'paying' else t.status end, 'status', t.status);
  end if;

  if p_ways is null and p_share_cents is null then
    if t.split_at is null then
      return jsonb_build_object('ok', true, 'outcome', 'whole', 'tab_id', t.id);
    end if;
    if exists (select 1 from public.pay_tabs where parent_tab_id = t.id and status in ('paying', 'paid')) then
      return jsonb_build_object('ok', false, 'code', 'paid_part');
    end if;
    update public.pay_tabs set status = 'cancelled', updated_at = now()
     where parent_tab_id = t.id and status = 'billed';
    update public.pay_tabs set split_at = null, split_ways = null, join_token_hash = null, updated_at = now()
     where id = t.id;
    return jsonb_build_object('ok', true, 'outcome', 'whole', 'tab_id', t.id);
  end if;

  if p_ways is null or p_ways < 2 or p_ways > 20 or p_share_cents is null or p_share_cents <= 0
     or p_share_cents > t.bill_cents or p_join_token_hash is null or p_share_token_hash is null then
    return jsonb_build_object('ok', false, 'code', 'share_invalid', 'bill_cents', t.bill_cents);
  end if;

  update public.pay_tabs
     set split_at = coalesce(split_at, p_now), split_ways = p_ways, join_token_hash = p_join_token_hash,
         expires_at = greatest(expires_at, p_now + interval '30 minutes'), updated_at = now()
   where id = t.id
  returning * into t;

  select * into s from public.pay_tabs
   where parent_tab_id = t.id and consumer_id = p_consumer_id and status in ('billed', 'paying', 'paid')
   order by created_at desc limit 1
   for update;
  if found then
    v_share := s.id;
    if s.status = 'billed' and s.bill_cents <> p_share_cents then
      update public.pay_tabs
         set bill_cents = p_share_cents, tip_cents = public.pay_tab_share_tip(t.tip_cents, t.bill_cents, p_share_cents),
             bill_version = s.bill_version + 1, expires_at = greatest(s.expires_at, p_now + interval '30 minutes'),
             updated_at = now()
       where id = s.id;
    end if;
  else
    v_share := public.pay_tab_new_share(t, p_consumer_id, p_share_token_hash, p_share_cents, p_now);
  end if;
  return jsonb_build_object('ok', true, 'outcome', 'split', 'tab_id', t.id, 'share_tab_id', v_share,
    'split_ways', t.split_ways, 'left_cents', public.pay_tab_left(t.id, true));
end;
$function$;

-- ── 6. A friend joins ───────────────────────────────────────────────────────
-- By the table's join QR. A guest who already holds a share of this table
-- gets it back. A new share is the equal part (bill / ways, rounded up),
-- never more than what is left unclaimed.
create or replace function public.pay_tab_join(
  p_join_token_hash text, p_consumer_id uuid, p_share_token_hash text, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  t public.pay_tabs;
  v_share uuid;
  v_left integer;
  v_part integer;
begin
  if p_join_token_hash is null or p_consumer_id is null or p_share_token_hash is null then
    raise exception 'pay_tab_join: join token, consumer and share token are required';
  end if;
  select * into t from public.pay_tabs where join_token_hash = p_join_token_hash;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  perform public.wallet_lock(p_consumer_id, t.place_id);
  select * into t from public.pay_tabs where id = t.id for update;

  select id into v_share from public.pay_tabs
   where parent_tab_id = t.id and consumer_id = p_consumer_id and status in ('billed', 'paying', 'paid')
   order by created_at desc limit 1;
  if found then
    return jsonb_build_object('ok', true, 'outcome', 'reused', 'tab_id', t.id, 'share_tab_id', v_share);
  end if;
  if t.split_at is null or t.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if t.status = 'paid' then
    return jsonb_build_object('ok', false, 'code', 'paid');
  end if;
  if t.status <> 'billed' or t.expires_at <= p_now then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  v_left := public.pay_tab_left(t.id, true);
  if v_left <= 0 then
    return jsonb_build_object('ok', false, 'code', 'nothing_left');
  end if;
  v_part := least(v_left, ceil(t.bill_cents::numeric / greatest(coalesce(t.split_ways, 2), 2))::int);
  v_share := public.pay_tab_new_share(t, p_consumer_id, p_share_token_hash, v_part, p_now);
  return jsonb_build_object('ok', true, 'outcome', 'joined', 'tab_id', t.id, 'share_tab_id', v_share,
    'share_cents', v_part);
end;
$function$;

-- ── 7. A payer changes their share before paying ────────────────────────────
create or replace function public.pay_tab_set_share(
  p_share_tab_id uuid, p_consumer_id uuid, p_share_cents integer, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  s public.pay_tabs;
  t public.pay_tabs;
  v_left integer;
begin
  select * into s from public.pay_tabs where id = p_share_tab_id;
  if not found or s.consumer_id is distinct from p_consumer_id or s.parent_tab_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  perform public.wallet_lock(p_consumer_id, s.place_id);
  select * into t from public.pay_tabs where id = s.parent_tab_id for update;
  select * into s from public.pay_tabs where id = p_share_tab_id for update;
  if s.status <> 'billed' then
    return jsonb_build_object('ok', false, 'code', case when s.status in ('paying', 'paid') then 'paying' else s.status end);
  end if;
  if t.status <> 'billed' then
    return jsonb_build_object('ok', false, 'code', case when t.status = 'paid' then 'paid' else 'expired' end);
  end if;
  v_left := public.pay_tab_left(t.id, false, s.id);
  if p_share_cents is null or p_share_cents <= 0 or p_share_cents > v_left then
    return jsonb_build_object('ok', false, 'code', 'share_too_big', 'left_cents', greatest(v_left, 0));
  end if;
  update public.pay_tabs
     set bill_cents = p_share_cents, tip_cents = public.pay_tab_share_tip(t.tip_cents, t.bill_cents, p_share_cents),
         bill_version = s.bill_version + 1, expires_at = greatest(s.expires_at, p_now + interval '30 minutes'),
         updated_at = now()
   where id = s.id;
  return jsonb_build_object('ok', true, 'outcome', 'share', 'share_tab_id', s.id, 'share_cents', p_share_cents,
    'bill_version', s.bill_version + 1);
end;
$function$;

-- ── 8. The guards ───────────────────────────────────────────────────────────
-- Before a tab row changes: a split table is never paid whole (the guest's
-- pay call sets pay_request_id); a share starts paying only if it fits in
-- what is left, read under the table's row lock, so two friends paying the
-- last $500 at once cannot both pay it. Raised errors roll the whole pay
-- call back (no Stripe object exists yet: the EF creates it afterwards).
create or replace function public.pay_tabs_split_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  t public.pay_tabs;
  v_left integer;
begin
  if new.parent_tab_id is null then
    if old.split_at is not null and new.pay_request_id is distinct from old.pay_request_id then
      raise exception 'split_locked' using errcode = 'P0001', hint = 'mesita:split_locked';
    end if;
    -- A guest cannot cancel a table a friend already paid part of.
    if old.split_at is not null and new.status = 'cancelled' and old.status <> 'cancelled'
       and exists (select 1 from public.pay_tabs s where s.parent_tab_id = new.id and s.status in ('paying', 'paid')) then
      raise exception 'paid_part' using errcode = 'P0001', hint = 'mesita:paid_part';
    end if;
    return new;
  end if;
  if old.status = 'billed' and new.status in ('paying', 'paid') then
    select * into t from public.pay_tabs where id = new.parent_tab_id for update;
    if t.status <> 'billed' then
      raise exception 'table_closed' using errcode = 'P0001', hint = 'mesita:table_closed';
    end if;
    v_left := public.pay_tab_left(t.id, false, new.id);
    if new.bill_cents > v_left then
      raise exception 'share_too_big:%', greatest(v_left, 0) using errcode = 'P0001', hint = 'mesita:share_too_big';
    end if;
  end if;
  return new;
end;
$function$;

create trigger pay_tabs_split_guard
  before update of status, pay_request_id on public.pay_tabs
  for each row execute function public.pay_tabs_split_guard();

-- After a share moves: shares that cover the bill pay the table; any other
-- move keeps the table alive 30 more minutes. After a split table is
-- cancelled or expires: its shares not yet paying follow it.
create or replace function public.pay_tabs_follow_shares()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.status is not distinct from old.status then
    return null;
  end if;
  if new.parent_tab_id is null then
    if new.split_at is not null and new.status in ('cancelled', 'expired') then
      update public.pay_tabs set status = new.status, updated_at = now()
       where parent_tab_id = new.id and status = 'billed';
    end if;
    return null;
  end if;
  if new.status = 'paid'
     and (select coalesce(sum(bill_cents), 0) from public.pay_tabs
           where parent_tab_id = new.parent_tab_id and status = 'paid')
         >= (select bill_cents from public.pay_tabs where id = new.parent_tab_id) then
    update public.pay_tabs set status = 'paid', paid_at = coalesce(new.paid_at, now()), updated_at = now()
     where id = new.parent_tab_id and status = 'billed';
  elsif new.status in ('paying', 'paid') then
    update public.pay_tabs set expires_at = greatest(expires_at, now() + interval '30 minutes'), updated_at = now()
     where id = new.parent_tab_id and status = 'billed';
  end if;
  return null;
end;
$function$;

create trigger pay_tabs_follow_shares
  after update of status on public.pay_tabs
  for each row execute function public.pay_tabs_follow_shares();

-- ── 9. Access: the service role only ────────────────────────────────────────
revoke all on function public.pay_tab_left(uuid, boolean, uuid) from public, anon, authenticated;
revoke all on function public.pay_tab_share_tip(integer, integer, integer) from public, anon, authenticated;
revoke all on function public.pay_tab_new_share(public.pay_tabs, uuid, text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_tab_split(uuid, uuid, integer, integer, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_tab_join(text, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_tab_set_share(uuid, uuid, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_tabs_split_guard() from public, anon, authenticated;
revoke all on function public.pay_tabs_follow_shares() from public, anon, authenticated;
grant execute on function public.pay_tab_split(uuid, uuid, integer, integer, text, text, timestamptz) to service_role;
grant execute on function public.pay_tab_join(text, uuid, text, timestamptz) to service_role;
grant execute on function public.pay_tab_set_share(uuid, uuid, integer, timestamptz) to service_role;
grant execute on function public.pay_tab_left(uuid, boolean, uuid) to service_role;

-- MESITA-4698 — CASHBACK IS BACK; VOUCHERS BY AMOUNT ONLY. Pato, 2026-11-22:
-- "BUILD IT" on one model. Vouchers (Small · Medium · Big) are the only thing
-- sold through Mesita; a paid bill earns cashback. Docs › Credits, the
-- MESITA-4698 section.
--
-- 1. place_cashback_settings: the owner's three lines (Welcome · Returning
--    Regular · Returning VIP), each Off · 5 · 10 · 15 · 20 %, and a cap per
--    bill. No row = the defaults 10 / 5 / 10 %, MX$200.
-- 2. wallet_entries gets tab_id and the kind 'cashback' (one per paid bill,
--    tied to its pay_tabs row; MESITA-4194 turned the old 'cashback' entries
--    into 'extra', which stays as it is).
-- 3. pay_tab_grant_cashback + a trigger on pay_tabs: every bill that reaches
--    paid (guest pay tickets, pay_guest_insert_closed; and waiter tabs,
--    pay_tab_cash) earns once. Earned on the part not paid with credit
--    (cash_bill_cents + card_bill_cents; never the tip), only where Loyalty
--    Cards is On, one per guest per place per Monterrey day, Pending 3 hours.
--    A failure inside never stops the bill from closing (a warning only).
-- 4. The Welcome and VIP vouchers leave sale: every switch reads false. Their
--    keys left the catalog (_shared/money-state.ts); purchases already made
--    stay in the ledger untouched (the guest's money).

-- ── 1. The owner's cashback lines ───────────────────────────────────────────
create table if not exists public.place_cashback_settings (
  place_id    uuid primary key references public.places (id) on delete cascade,
  welcome_bps integer not null default 1000 check (welcome_bps in (0, 500, 1000, 1500, 2000)),
  regular_bps integer not null default 500  check (regular_bps in (0, 500, 1000, 1500, 2000)),
  vip_bps     integer not null default 1000 check (vip_bps in (0, 500, 1000, 1500, 2000)),
  cap_cents   integer not null default 20000 check (cap_cents >= 0 and cap_cents <= 1000000),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
alter table public.place_cashback_settings enable row level security;
revoke all on table public.place_cashback_settings from public, anon, authenticated;
grant all on table public.place_cashback_settings to service_role;
comment on table public.place_cashback_settings is
  'MESITA-4698: the owner''s cashback lines (Welcome, Returning Regular, Returning VIP) in basis points, each one of Off/5/10/15/20 %, and the cap per bill in cents. No row = the defaults 10/5/10 %, MX$200. Written only by business-web-set-cashback. EF-only.';

-- The rates that bind a place now (its row, else the defaults).
create or replace function public.place_cashback_rates(p_place_id uuid)
 returns table (welcome_bps integer, regular_bps integer, vip_bps integer, cap_cents integer)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select coalesce(s.welcome_bps, 1000), coalesce(s.regular_bps, 500),
         coalesce(s.vip_bps, 1000), coalesce(s.cap_cents, 20000)
    from (select 1) one
    left join public.place_cashback_settings s on s.place_id = p_place_id;
$function$;
revoke all on function public.place_cashback_rates(uuid) from public, anon, authenticated;
grant execute on function public.place_cashback_rates(uuid) to service_role;

-- ── 2. The ledger learns cashback ───────────────────────────────────────────
alter table public.wallet_entries add column if not exists tab_id uuid
  references public.pay_tabs (id) on delete restrict;
comment on column public.wallet_entries.tab_id is
  'MESITA-4698: the paid bill (pay_tabs) a cashback entry was earned on; null for every other kind.';

alter table public.wallet_entries drop constraint wallet_entries_kind_chk;
alter table public.wallet_entries drop constraint wallet_entries_kind_shape_chk;
alter table public.wallet_entries add constraint wallet_entries_kind_chk check (kind = any (array[
  'prepay', 'voucher', 'bonus', 'extra', 'cashback', 'spend', 'reversal', 'refund', 'gift_out', 'gift_in', 'gift_back']));
alter table public.wallet_entries add constraint wallet_entries_kind_shape_chk check (
case kind
    when 'prepay' then ((amount_cents > 0) and (purchase_id is not null) and (payment_id is null) and (gift_id is null))
    when 'voucher' then ((amount_cents > 0) and (purchase_id is not null) and (payment_id is null) and (gift_id is null))
    when 'bonus' then ((amount_cents > 0) and (purchase_id is not null) and (payment_id is null) and (gift_id is null))
    -- 'extra': legacy credit from the cashback retired by MESITA-4194; nothing writes it.
    when 'extra' then ((amount_cents > 0) and ((payment_id is null) <> (purchase_id is null)) and (gift_id is null))
    -- 'cashback' (MESITA-4698): earned on one paid bill.
    when 'cashback' then ((amount_cents > 0) and (tab_id is not null) and (purchase_id is null) and (payment_id is null) and (gift_id is null))
    when 'spend' then ((amount_cents < 0) and (payment_id is not null) and (purchase_id is null) and (gift_id is null))
    when 'reversal' then ((amount_cents < 0) and ((purchase_id is not null) or (payment_id is not null)) and (gift_id is null))
    when 'refund' then ((amount_cents > 0) and (payment_id is not null) and (purchase_id is null) and (gift_id is null))
    when 'gift_out' then ((amount_cents < 0) and (gift_id is not null) and (purchase_id is null) and (payment_id is null))
    when 'gift_in' then ((amount_cents > 0) and (gift_id is not null) and (purchase_id is null) and (payment_id is null))
    when 'gift_back' then ((amount_cents > 0) and (gift_id is not null) and (purchase_id is null) and (payment_id is null))
    else false
end);

-- A cashback entry names its line in reason.
alter table public.wallet_entries drop constraint if exists wallet_entries_reason_chk;
alter table public.wallet_entries add constraint wallet_entries_reason_chk check (
  reason is null
  or (kind = 'reversal' and reason in ('refund', 'dispute_lost', 'credit_refund', 'story_void'))
  or (kind = 'cashback' and reason in ('welcome', 'regular', 'vip'))
);

-- One cashback per bill, enforced where two closes could race.
create unique index if not exists wallet_entries_cashback_once_idx
  on public.wallet_entries (tab_id) where kind = 'cashback';

-- ── 3. Earning it ───────────────────────────────────────────────────────────
create or replace function public.pay_tab_grant_cashback(p_tab_id uuid, p_now timestamptz default now())
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  t public.pay_tabs;
  v_earn integer;
  v_class text;
  v_welcome boolean;
  v_bps integer;
  v_cap integer;
  r record;
  v_amount integer;
  v_day date;
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
  -- One per guest per place per Monterrey day.
  v_day := (coalesce(t.paid_at, p_now) at time zone 'America/Monterrey')::date;
  if exists (select 1 from public.wallet_entries e
              where e.consumer_id = t.consumer_id and e.place_id = t.place_id
                and e.livemode = t.livemode and e.kind = 'cashback'
                and (e.created_at at time zone 'America/Monterrey')::date = v_day) then
    return 0;
  end if;

  -- Welcome: no earlier paid bill here. Otherwise the guest's Class.
  v_welcome := not exists (
    select 1 from public.pay_tabs o
     where o.consumer_id = t.consumer_id and o.place_id = t.place_id
       and o.livemode = t.livemode and o.status = 'paid' and o.id <> t.id
       and o.paid_at < coalesce(t.paid_at, p_now));
  select c.guest_class into v_class from public.consumers c where c.id = t.consumer_id;

  select * into r from public.place_cashback_rates(t.place_id);
  v_bps := case when v_welcome then r.welcome_bps
                when v_class = 'vip' then r.vip_bps
                else r.regular_bps end;
  v_cap := r.cap_cents;
  if v_bps <= 0 or v_cap <= 0 then
    return 0;
  end if;
  v_amount := least((v_earn::bigint * v_bps / 10000)::integer, v_cap);
  if v_amount <= 0 then
    return 0;
  end if;

  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, tab_id, livemode, available_at, reason)
  values (t.consumer_id, t.place_id, 'cashback', v_amount, lower(t.currency), t.id, t.livemode,
          coalesce(t.paid_at, p_now) + interval '3 hours',
          case when v_welcome then 'welcome' when v_class = 'vip' then 'vip' else 'regular' end);
  return v_amount;
end;
$function$;
revoke all on function public.pay_tab_grant_cashback(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_tab_grant_cashback(uuid, timestamptz) to service_role;
comment on function public.pay_tab_grant_cashback(uuid, timestamptz) is
  'MESITA-4698: one paid bill''s cashback: the Welcome, Returning Regular or Returning VIP rate of the place on cash_bill_cents + card_bill_cents, capped, Pending 3 hours; none where Loyalty Cards is Off, on a bill that already has one, or on a second bill the same Monterrey day. Reason = the line. Internal.';

create or replace function public.pay_tabs_grant_cashback()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    begin
      perform public.pay_tab_grant_cashback(new.id);
    exception when others then
      -- Cashback never stops a bill from closing.
      raise warning 'pay_tab_grant_cashback(%): %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$function$;
revoke all on function public.pay_tabs_grant_cashback() from public, anon, authenticated;

drop trigger if exists pay_tabs_grant_cashback on public.pay_tabs;
create trigger pay_tabs_grant_cashback
  after insert or update of status on public.pay_tabs
  for each row execute function public.pay_tabs_grant_cashback();

-- ── 4. Welcome and VIP leave sale ───────────────────────────────────────────
update public.place_payment_settings
   set voucher_welcome = false, voucher_vip = false, updated_at = now()
 where voucher_welcome or voucher_vip;

comment on column public.place_payment_settings.voucher_welcome is
  'Off since MESITA-4698 (Welcome is a cashback line now): the key left the catalog, so nothing sells it whatever this reads.';
comment on column public.place_payment_settings.voucher_vip is
  'Off since MESITA-4698 (VIP is a cashback line now): the key left the catalog, so nothing sells it whatever this reads.';

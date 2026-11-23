-- MESITA-4709 — NO MORE VIP (Pato, 2026-11-22: "no more VIP"). The VIP guest
-- class leaves every guest and owner surface, so cashback drops from three
-- lines to two: Welcome (the guest's first paid bill at the place) and
-- Returning (every later bill), each Off · 5 · 10 · 15 · 20 %, plus the cap
-- per bill. Docs › Credits, the MESITA-4698 section.
--
-- 1. place_cashback_settings and cashback_defaults: regular_bps becomes
--    returning_bps; vip_bps is dropped (its rate no longer binds anyone).
-- 2. place_cashback_rates returns (welcome_bps, returning_bps, cap_cents);
--    same fallback order: the place's row, else cashback_defaults, else
--    10 / 5 %, MX$200.
-- 3. pay_tab_grant_cashback: Welcome when the guest has no earlier paid bill
--    here, else Returning. It never reads consumers.guest_class.
-- 4. Cashback entries already written as 'regular' or 'vip' read 'returning'
--    (the reason only; no amount moves), and the reason check allows
--    ('welcome', 'returning') for cashback.
--
-- consumers.guest_class stays: Instagram and Social still read it.

-- ── 1. Two lines ────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'place_cashback_settings' and column_name = 'regular_bps') then
    alter table public.place_cashback_settings rename column regular_bps to returning_bps;
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'cashback_defaults' and column_name = 'regular_bps') then
    alter table public.cashback_defaults rename column regular_bps to returning_bps;
  end if;
end;
$$;

-- place_cashback_rates' old signature names vip_bps in its result; drop it
-- before the column so nothing depends on it.
drop function if exists public.place_cashback_rates(uuid);

alter table public.place_cashback_settings drop column if exists vip_bps;
alter table public.cashback_defaults drop column if exists vip_bps;

comment on table public.place_cashback_settings is
  'MESITA-4698, MESITA-4709: the owner''s cashback lines (Welcome = the guest''s first paid bill here, Returning = every later bill) in basis points, each one of Off/5/10/15/20 %, and the cap per bill in cents. No row = cashback_defaults. Written only by business-web-set-cashback. EF-only.';
comment on table public.cashback_defaults is
  'MESITA-4700, MESITA-4709: the cashback lines (Welcome, Returning) every place without its own place_cashback_settings row reads (basis points, Off/5/10/15/20 %) and the cap per bill in cents. One row (id = true). Edited from Admin › Offers (admin-web-save-cashback-defaults). Service role only.';

-- ── 2. The rates that bind a place now ──────────────────────────────────────
create or replace function public.place_cashback_rates(p_place_id uuid)
 returns table (welcome_bps integer, returning_bps integer, cap_cents integer)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select coalesce(s.welcome_bps, d.welcome_bps, 1000), coalesce(s.returning_bps, d.returning_bps, 500),
         coalesce(s.cap_cents, d.cap_cents, 20000)
    from (select 1) one
    left join public.cashback_defaults d on d.id
    left join public.place_cashback_settings s on s.place_id = p_place_id;
$function$;
revoke all on function public.place_cashback_rates(uuid) from public, anon, authenticated;
grant execute on function public.place_cashback_rates(uuid) to service_role;
comment on function public.place_cashback_rates(uuid) is
  'MESITA-4698, MESITA-4700, MESITA-4709: the cashback lines that bind a place now (Welcome, Returning, cap): its own row, else cashback_defaults, else 10/5 %, MX$200. Internal.';

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

  -- Welcome: no earlier paid bill here. Otherwise Returning.
  v_welcome := not exists (
    select 1 from public.pay_tabs o
     where o.consumer_id = t.consumer_id and o.place_id = t.place_id
       and o.livemode = t.livemode and o.status = 'paid' and o.id <> t.id
       and o.paid_at < coalesce(t.paid_at, p_now));

  select * into r from public.place_cashback_rates(t.place_id);
  v_bps := case when v_welcome then r.welcome_bps else r.returning_bps end;
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
          case when v_welcome then 'welcome' else 'returning' end);
  return v_amount;
end;
$function$;
revoke all on function public.pay_tab_grant_cashback(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_tab_grant_cashback(uuid, timestamptz) to service_role;
comment on function public.pay_tab_grant_cashback(uuid, timestamptz) is
  'MESITA-4698, MESITA-4709: one paid bill''s cashback: the Welcome (first paid bill here) or Returning rate of the place on cash_bill_cents + card_bill_cents, capped, Pending 3 hours; none where Loyalty Cards is Off, on a bill that already has one, or on a second bill the same Monterrey day. Reason = the line. Internal.';

-- ── 4. The ledger names two lines ───────────────────────────────────────────
-- The reason check goes first so the old reasons can be rewritten; the
-- append-only trigger allows no update, so it is off for this one rewrite.
alter table public.wallet_entries drop constraint if exists wallet_entries_reason_chk;

alter table public.wallet_entries disable trigger wallet_entries_append_only;
update public.wallet_entries set reason = 'returning'
 where kind = 'cashback' and reason in ('regular', 'vip');
alter table public.wallet_entries enable trigger wallet_entries_append_only;

alter table public.wallet_entries add constraint wallet_entries_reason_chk check (
  reason is null
  or (kind = 'reversal' and reason in ('refund', 'dispute_lost', 'credit_refund', 'story_void'))
  or (kind = 'cashback' and reason in ('welcome', 'returning'))
);

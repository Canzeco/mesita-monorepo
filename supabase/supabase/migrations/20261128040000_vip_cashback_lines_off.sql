-- MESITA-5072 (Pato, 2026-11-27): VIP now changes only the Story Reward, so
-- VIP cashback goes. Cashback has two lines:
--   * Welcome   — a guest's first paid bill here: Off · 10 · 20 %,
--   * Returning — every bill after: Off · 5 %, and 10 % only where the Small
--     voucher's bonus is +20 % (so every voucher bonus beats Returning).
-- A VIP guest earns Welcome and Returning like everyone. The VIP columns stay
-- (old receipts and pay_tabs.cashback_line name welcome_vip / returning_vip)
-- but hold 0 and accept only 0. A bill whose rate was frozen before this
-- (pay_tabs.cashback_bps) keeps the rate its guest accepted.
-- Bodies are the live ones (pg_get_functiondef) with only the VIP lines cut.

update public.cashback_defaults set welcome_vip_bps = 0, returning_vip_bps = 0
 where welcome_vip_bps <> 0 or returning_vip_bps <> 0;
update public.place_cashback_settings set welcome_vip_bps = 0, returning_vip_bps = 0
 where welcome_vip_bps <> 0 or returning_vip_bps <> 0;

-- Returning 10 % without Small at +20 % drops to 5 %.
update public.cashback_defaults set returning_bps = 500
 where returning_bps = 1000 and small_bonus_bps is distinct from 2000;
update public.place_cashback_settings set returning_bps = 500
 where returning_bps = 1000 and small_bonus_bps is distinct from 2000;

alter table public.cashback_defaults
  alter column welcome_vip_bps set default 0,
  alter column returning_vip_bps set default 0,
  drop constraint if exists cashback_defaults_welcome_vip_bps_check,
  drop constraint if exists cashback_defaults_returning_vip_bps_check,
  add constraint cashback_defaults_welcome_vip_bps_check check (welcome_vip_bps = 0),
  add constraint cashback_defaults_returning_vip_bps_check check (returning_vip_bps = 0),
  add constraint cashback_defaults_returning_top_check check (returning_bps <> 1000 or small_bonus_bps = 2000);

alter table public.place_cashback_settings
  alter column welcome_vip_bps set default 0,
  alter column returning_vip_bps set default 0,
  drop constraint if exists place_cashback_settings_welcome_vip_bps_check,
  drop constraint if exists place_cashback_settings_returning_vip_bps_check,
  add constraint place_cashback_settings_welcome_vip_bps_check check (welcome_vip_bps = 0),
  add constraint place_cashback_settings_returning_vip_bps_check check (returning_vip_bps = 0),
  add constraint place_cashback_settings_returning_top_check check (returning_bps <> 1000 or small_bonus_bps = 2000);

-- The VIP two always read 0 (the shape stays for its readers).
CREATE OR REPLACE FUNCTION public.place_cashback_rates(p_place_id uuid)
 RETURNS TABLE(welcome_bps integer, returning_bps integer, returning_vip_bps integer, welcome_vip_bps integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(s.welcome_bps, d.welcome_bps, 1000), coalesce(s.returning_bps, d.returning_bps, 500),
         0, 0
    from (select 1) one
    left join public.cashback_defaults d on d.id
    left join public.place_cashback_settings s on s.place_id = p_place_id;
$function$
;

CREATE OR REPLACE FUNCTION public.pay_bill_quote(p_consumer_id uuid, p_place_id uuid, p_currency text, p_livemode boolean, p_bill_cents integer, p_tip_cents integer, p_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_line text;
  v_bps integer;
  r record;
  v_due integer;
  v_credit integer;
  v_back_bps integer := 0;
  v_back integer;
begin
  -- Two lines (MESITA-5072): Welcome before the first paid bill here, then
  -- Returning; VIP or not.
  if not exists (
    select 1 from public.pay_tabs o
     where o.consumer_id = p_consumer_id and o.place_id = p_place_id
       and o.livemode = p_livemode and o.status = 'paid') then
    v_line := 'welcome';
  else
    v_line := 'returning';
  end if;
  select * into r from public.place_cashback_rates(p_place_id);
  v_bps := greatest(coalesce(case v_line when 'welcome' then r.welcome_bps
                                         else r.returning_bps end, 0), 0);
  if exists (select 1 from public.place_payment_settings s
                 where s.place_id = p_place_id and s.loyalty_cards) then
    v_back_bps := v_bps;
  end if;
  v_due := p_bill_cents;
  select least(coalesce(b.spendable_cents, 0), v_due) into v_credit
    from public.wallet_balance(p_consumer_id, p_place_id, lower(p_currency), p_livemode, p_now) b;
  v_credit := greatest(coalesce(v_credit, 0), 0);
  v_back := ((v_due - v_credit)::bigint * v_back_bps / 10000)::integer;
  return jsonb_build_object(
    'line', v_line,
    'credit_cents', v_credit, 'outside_bill_cents', v_due - v_credit,
    'tip_cents', p_tip_cents, 'outside_cents', v_due - v_credit + p_tip_cents,
    'cashback_bps', v_back_bps,
    'cashback_cents', least(v_back, public.visit_cashback_cap_cents()),
    'cashback_capped', v_back > public.visit_cashback_cap_cents());
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pay_tab_grant_cashback(p_tab_id uuid, p_now timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- New credit is born only where Loyalty Cards is On (the signed agreement);
  -- a rate the guest accepted was frozen with that answer in it (MESITA-4823).
  if t.cashback_bps is null and not exists (select 1 from public.place_payment_settings s
                  where s.place_id = t.place_id and s.loyalty_cards) then
    return 0;
  end if;

  perform public.wallet_lock(t.consumer_id, t.place_id);

  if exists (select 1 from public.wallet_entries e where e.tab_id = t.id and e.kind = 'cashback') then
    return 0;
  end if;

  -- Two lines (MESITA-5072): no earlier paid bill here (the bill's own money
  -- mode) → Welcome, otherwise Returning; VIP or not.
  if not exists (
    select 1 from public.pay_tabs o
     where o.consumer_id = t.consumer_id and o.place_id = t.place_id
       and o.livemode = t.livemode and o.status = 'paid' and o.id <> t.id
       and o.paid_at < coalesce(t.paid_at, p_now)) then
    v_line := 'welcome';
  else
    v_line := 'returning';
  end if;

  -- A frozen rate keeps the line and rate its guest accepted.
  if t.cashback_bps is not null then
    v_line := coalesce(t.cashback_line, v_line);
  end if;
  select * into r from public.place_cashback_rates(t.place_id);
  v_bps := case v_line when 'welcome' then r.welcome_bps
                       when 'returning' then r.returning_bps
                       else 0 end;
  v_bps := coalesce(t.cashback_bps, v_bps);
  if v_bps <= 0 then
    return 0;
  end if;
  -- The ceiling of one bill (MESITA-4831).
  v_amount := least((v_earn::bigint * v_bps / 10000)::integer, public.visit_cashback_cap_cents());
  if v_amount <= 0 then
    return 0;
  end if;

  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, tab_id, livemode, available_at, reason)
  values (t.consumer_id, t.place_id, 'cashback', v_amount, lower(t.currency), t.id, t.livemode,
          coalesce(t.paid_at, p_now) + interval '1 hour', v_line);
  return v_amount;
end;
$function$
;

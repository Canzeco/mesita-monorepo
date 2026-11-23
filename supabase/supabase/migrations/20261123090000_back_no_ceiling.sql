-- MESITA-4728 — BACK HAS NO CEILING AND NO ONCE-A-DAY RULE. Pato, 2026-11-23:
-- "fuck those rules. there is no ceiling for the cashback amount. i never
-- said there was a ceiling for the cashback amount".
--
-- pay_tab_grant_cashback: the Welcome or Returning rate on every peso the bill
-- was paid by card or cash (never credit, never the tip), with no per-bill
-- cap and no "one per guest per place per day". A bill still earns once.
-- The cap_cents columns stay until the functions that read them are gone
-- (follow-up), then drop.

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

  -- Welcome: no earlier paid bill here. Otherwise Returning.
  v_welcome := not exists (
    select 1 from public.pay_tabs o
     where o.consumer_id = t.consumer_id and o.place_id = t.place_id
       and o.livemode = t.livemode and o.status = 'paid' and o.id <> t.id
       and o.paid_at < coalesce(t.paid_at, p_now));

  select * into r from public.place_cashback_rates(t.place_id);
  v_bps := case when v_welcome then r.welcome_bps else r.returning_bps end;
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
          coalesce(t.paid_at, p_now) + interval '1 hour',
          case when v_welcome then 'welcome' else 'returning' end);
  return v_amount;
end;
$function$;

revoke all on function public.pay_tab_grant_cashback(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_tab_grant_cashback(uuid, timestamptz) to service_role;
comment on function public.pay_tab_grant_cashback(uuid, timestamptz) is
  'MESITA-4698, MESITA-4709, MESITA-4717, MESITA-4728: one paid bill''s Back: the Welcome (first paid bill here) or Returning rate of the place on cash_bill_cents + card_bill_cents, no cap, Pending 1 hour; none where Loyalty Cards is Off or on a bill that already has one. Reason = the line. Internal.';

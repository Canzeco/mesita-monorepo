-- MESITA-4501 — a new guest pay closes when the money is done.
--
-- Credits-only, and a card captured on confirm (held_at is null), spend and
-- the tab is paid. No waiter key. A card still held for Sign (held_at set)
-- stays on pay_tab_verify. A cash remainder stays due.
--
-- verified_at requires a 64-hex key. This close uses a fixed hash that is
-- not a staff device: sha256("mesita-guest-closed").

create or replace function public.pay_tab_guest_settle(p_tab_id uuid, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
  w public.wallet_payments;
  v_key constant text := 'cc873e0cc5c6d9a278d6804d17e2b06e46cd1e68701b86cbe7a87675f6121775';
begin
  select * into v from public.pay_tabs where id = p_tab_id;
  if not found or v.origin <> 'guest' then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);
  select * into v from public.pay_tabs where id = p_tab_id for update;

  if v.verified_at is not null then
    return jsonb_build_object('ok', true, 'outcome', 'already', 'tab_id', v.id, 'status', v.status);
  end if;
  if v.status not in ('paying', 'paid') then
    return jsonb_build_object('ok', false, 'code', v.status);
  end if;
  if coalesce(v.cash_bill_cents, 0) + coalesce(v.cash_tip_cents, 0) > 0 then
    return jsonb_build_object('ok', true, 'outcome', 'cash_due', 'tab_id', v.id, 'status', v.status);
  end if;
  if exists (
    select 1 from public.wallet_payments
     where tab_id = v.id and part = 'card' and held_at is not null and paid_at is null
  ) then
    return jsonb_build_object('ok', true, 'outcome', 'held', 'tab_id', v.id, 'status', v.status);
  end if;
  if exists (
    select 1 from public.wallet_payments
     where tab_id = v.id and part = 'card' and status in ('opening', 'open')
  ) then
    return jsonb_build_object('ok', false, 'code', 'card_pending');
  end if;

  for w in
    select * from public.wallet_payments
     where tab_id = v.id and part = 'credit' and status = 'open' and paid_at is null
     for update
  loop
    update public.wallet_payments set status = 'paid', paid_at = p_now, updated_at = now() where id = w.id;
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
    values (w.consumer_id, w.place_id, 'spend', -w.credit_cents, w.currency, w.id, w.livemode, p_now);
  end loop;

  update public.pay_tabs
     set status = 'paid', paid_at = coalesce(paid_at, p_now),
         verified_at = p_now, verified_key_hash = v_key, updated_at = now()
   where id = v.id;
  return jsonb_build_object('ok', true, 'outcome', 'settled', 'tab_id', v.id, 'status', 'paid');
end;
$function$;

comment on function public.pay_tab_guest_settle(uuid, timestamptz) is
  'MESITA-4501: close a guest tab with no waiter key once a credits-only bill or a card captured on confirm is done. A held card and a cash remainder are left. Service role only.';

revoke all on function public.pay_tab_guest_settle(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_tab_guest_settle(uuid, timestamptz) to service_role;

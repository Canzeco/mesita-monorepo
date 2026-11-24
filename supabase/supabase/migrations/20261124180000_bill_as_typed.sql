-- MESITA-4883 — the guest sees the bill as the waiter types it (Pato,
-- 2026-11-24: "once the qr is open, visualize what is being written … edge
-- function like reading every second"). Display only: it lives on the guest's
-- QR row, only a holder of the live QR writes it, it names no place, nothing
-- reads it for money, and it is stale 15 seconds after the waiter stops.
alter table public.pay_guest_codes
  add column draft_bill_cents integer check (draft_bill_cents is null or draft_bill_cents between 0 and 10000000),
  add column draft_tip_cents integer check (draft_tip_cents is null or draft_tip_cents between 0 and 10000000),
  add column draft_step text check (draft_step is null or draft_step in ('bill', 'tip', 'code')),
  add column draft_at timestamptz;
comment on column public.pay_guest_codes.draft_at is
  'MESITA-4883: the last thing the waiter typed (draft_*), display only, stale after 15 seconds.';

create function public.pay_guest_draft_set(
  p_token_hash text, p_bill_cents integer, p_tip_cents integer, p_step text, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update public.pay_guest_codes
     set draft_bill_cents = p_bill_cents, draft_tip_cents = p_tip_cents, draft_step = p_step, draft_at = p_now
   where (token_hash = p_token_hash and expires_at > p_now)
      or (prev_token_hash = p_token_hash and prev_until > p_now);
  if not found then return jsonb_build_object('ok', false, 'code', 'code_gone'); end if;
  return jsonb_build_object('ok', true);
end;
$function$;
revoke all on function public.pay_guest_draft_set(text, integer, integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_guest_draft_set(text, integer, integer, text, timestamptz) to service_role;

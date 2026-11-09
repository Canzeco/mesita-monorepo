-- MESITA-3306 — W2c: the waiter's charge on visit.mesita.ai.
--
-- Staff type the place code and an amount at visit.mesita.ai/charge/<place>;
-- visit-web-open-charge writes a place_charges row (a 4-digit code and a
-- 128-bit token, both hashed, ten minutes). The guest types the code on the
-- Pay tab; consumer-web-start-payment claims the charge, pays its amount and
-- binds the payment. The staff screen polls visit-web-get-charge by token.
--
--   place_charges.ticket          what staff typed, copied to the payment
--   place_charges.consumer_id     the guest who claimed it: one guest per
--                                 charge, decided by one UPDATE, so two
--                                 guests typing the same code never both pay
--   place_charge_tries.kind       'staff' (a wrong place code, per hashed
--                                 address) or 'guest' (a wrong 4-digit code,
--                                 per hashed guest); 0 rows exist today
--   place_charges_mark_paid       a card part settles later (the receiver,
--                                 the cron, the guest's return): the charge
--                                 reads paid when its payment does
--   place_charges_sweep           also deletes a charge whose payment was
--                                 released (failed or expired) once its ten
--                                 minutes are over, so its code frees
--
-- Additive: new columns are nullable or defaulted, so the EFs of main keep
-- working in the minutes before the functions deploy.

-- ── 1. Columns ──────────────────────────────────────────────────────────────
alter table public.place_charges
  add column if not exists ticket text check (ticket is null or char_length(ticket) between 1 and 32),
  add column if not exists consumer_id uuid references public.consumers (id) on delete set null;

alter table public.place_charge_tries
  add column if not exists kind text not null default 'staff' check (kind in ('staff', 'guest'));
-- Every writer names the kind from here on.
alter table public.place_charge_tries alter column kind drop default;

create index if not exists place_charge_tries_kind_idx
  on public.place_charge_tries (place_id, kind, tried_at desc);
create index if not exists place_charges_payment_idx
  on public.place_charges (payment_id) where payment_id is not null;

comment on column public.place_charges.ticket is
  'MESITA-3306: the ticket or table staff typed (at most 32 characters); a paid charge copies it to wallet_payments.ticket.';
comment on column public.place_charges.consumer_id is
  'MESITA-3306: the guest who claimed this charge by its code. Another guest reads taken; the same guest resumes it.';
comment on column public.place_charge_tries.kind is
  'MESITA-3306: staff (a wrong place code; addr_hash is an HMAC of the client address) or guest (a wrong charge code; addr_hash is a hash of the guest id). Six in 10 minutes lock that pair.';

-- ── 2. A charge reads paid when its payment does ────────────────────────────
create or replace function public.place_charges_mark_paid()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update public.place_charges
     set paid_at = new.paid_at
   where payment_id = new.id and paid_at is null;
  return null;
end;
$function$;

revoke all on function public.place_charges_mark_paid() from public, anon, authenticated;

drop trigger if exists wallet_payments_mark_charge_paid on public.wallet_payments;
create trigger wallet_payments_mark_charge_paid
  after update of paid_at on public.wallet_payments
  for each row
  when (old.paid_at is null and new.paid_at is not null)
  execute function public.place_charges_mark_paid();

-- ── 3. The sweep frees a code whose payment was released ────────────────────
create or replace function public.place_charges_sweep()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_n integer;
begin
  delete from public.place_charges c
   where (c.paid_at is not null and c.paid_at < now() - interval '24 hours')
      or (c.paid_at is null and c.payment_id is null and c.expires_at < now())
      or (c.paid_at is null and c.expires_at < now() and exists (
            select 1 from public.wallet_payments p
             where p.id = c.payment_id and p.status in ('failed', 'expired')));
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

revoke all on function public.place_charges_sweep() from public, anon, authenticated;
grant execute on function public.place_charges_sweep() to service_role;

-- ── 4. Post-flight ──────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from public.place_charge_tries where kind is null) then
    raise exception 'place_charge_tries.kind left a null';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'wallet_payments_mark_charge_paid') then
    raise exception 'the mark-paid trigger is missing after apply';
  end if;
end $$;

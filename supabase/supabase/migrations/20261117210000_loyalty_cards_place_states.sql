-- MESITA-4282 — the place's House Credits are Loyalty Cards.
--
-- Pato (2026-11-17): "across all the frontend and backend it must be called
-- Loyalty Card, not House Card … even place states". Step 2 of 3 (Pato
-- picked "three safe steps"; step 1 MESITA-4277 renamed the guest's card).
--
--   house_credits_contracts           -> loyalty_cards_contracts
--   place_payment_settings.house_credits -> loyalty_cards
--   its two CHECKs, three trigger functions and their triggers, and the two
--   functions whose bodies read the old names (place_currency_open,
--   admin_credit_limits).
--
-- THE BRIDGE (dropped by MESITA-4283). Supabase's integration applies this
-- migration minutes before it redeploys the Edge Functions, and the old ones
-- select `house_credits` from place_payment_settings in every money read
-- (_shared/payments.ts SETTINGS_COLUMNS: Pay, vouchers, place reads) and
-- read or insert `house_credits_contracts`. So:
--   * `house_credits` stays readable as a generated copy of loyalty_cards
--     (an old EF that WRITES it, the operator's switch, fails for those
--     minutes; nothing a guest does writes it);
--   * `house_credits_contracts` is a view over the renamed table, simple
--     enough to stay insertable for the old sign EF; the base table's
--     triggers still fire;
--   * the guard's message carries the old code `house_credits_unsigned` too,
--     which the old set-payment EF matches.
-- Every object is EF-only like its table: no client role holds anything.

-- ━━━ The contract table ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

alter table public.house_credits_contracts rename to loyalty_cards_contracts;
alter table public.loyalty_cards_contracts rename constraint house_credits_contracts_pkey to loyalty_cards_contracts_pkey;
alter table public.loyalty_cards_contracts rename constraint house_credits_contracts_place_id_fkey to loyalty_cards_contracts_place_id_fkey;
alter table public.loyalty_cards_contracts rename constraint house_credits_contracts_check to loyalty_cards_contracts_check;
alter table public.loyalty_cards_contracts rename constraint house_credits_contracts_check1 to loyalty_cards_contracts_check1;
alter table public.loyalty_cards_contracts rename constraint house_credits_contracts_currency_check to loyalty_cards_contracts_currency_check;
alter table public.loyalty_cards_contracts rename constraint house_credits_contracts_signer_role_check to loyalty_cards_contracts_signer_role_check;
alter table public.loyalty_cards_contracts rename constraint house_credits_contracts_terms_version_check to loyalty_cards_contracts_terms_version_check;
alter table public.loyalty_cards_contracts rename constraint house_credits_contracts_text_sha256_check to loyalty_cards_contracts_text_sha256_check;
alter index public.house_credits_contracts_one_live rename to loyalty_cards_contracts_one_live;
alter index public.house_credits_contracts_place rename to loyalty_cards_contracts_place;

comment on table public.loyalty_cards_contracts is
  'MESITA-3589 (renamed from house_credits_contracts, MESITA-4282): the Loyalty Cards Agreement a place signs with Mesita (Main §10). Independent of Stripe Connect. At most one live agreement per place (ended_at null). terms_version names the text agreed to; draft-2026-11 is a placeholder until the lawyer''s text. EF-only.';

-- ━━━ The switch ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

alter table public.place_payment_settings rename column house_credits to loyalty_cards;
alter table public.place_payment_settings
  rename constraint place_payment_settings_prepay_needs_house_credits to place_payment_settings_prepay_needs_loyalty_cards;
alter table public.place_payment_settings
  rename constraint place_payment_settings_prepayments_needs_house_credits to place_payment_settings_prepayments_needs_loyalty_cards;

comment on column public.place_payment_settings.loyalty_cards is
  'MESITA-3589 (house_credits until MESITA-4282): Loyalty Cards On/Off (Main §10). On only while a live loyalty_cards_contracts row exists. Off stops new credit (vouchers, Prepayments); credit guests hold stays spendable.';

-- ━━━ Trigger functions, under the new names ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

drop trigger place_payment_settings_house_credits_guard on public.place_payment_settings;
drop function public.place_payment_settings_house_credits_guard();
create function public.place_payment_settings_loyalty_cards_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Checked only on the turn to On: an unrelated update never re-checks.
  if new.loyalty_cards and (tg_op = 'INSERT' or not old.loyalty_cards) and not exists (
    select 1 from public.loyalty_cards_contracts c
     where c.place_id = new.place_id and c.ended_at is null
  ) then
    -- house_credits_unsigned stays in the text for the Edge Functions
    -- deployed before MESITA-4282 (they match it); MESITA-4283 drops it.
    raise exception 'loyalty_cards_unsigned: Loyalty Cards needs a signed Loyalty Cards Agreement (house_credits_unsigned)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;
create trigger place_payment_settings_loyalty_cards_guard
  before insert or update of loyalty_cards on public.place_payment_settings
  for each row execute function public.place_payment_settings_loyalty_cards_guard();

drop trigger house_credits_contracts_end on public.loyalty_cards_contracts;
drop function public.house_credits_contracts_end();
create function public.loyalty_cards_contracts_end()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.ended_at is not null and old.ended_at is null then
    update public.place_payment_settings
       set loyalty_cards = false,
           prepayments = false,
           voucher_200 = false, voucher_1000 = false, voucher_5000 = false,
           voucher_welcome = false, voucher_story = false, voucher_vip = false,
           updated_at = now()
     where place_id = new.place_id;
  end if;
  return new;
end;
$function$;
create trigger loyalty_cards_contracts_end
  after update of ended_at on public.loyalty_cards_contracts
  for each row execute function public.loyalty_cards_contracts_end();

drop trigger house_credits_contracts_append_only on public.loyalty_cards_contracts;
drop function public.house_credits_contracts_append_only();
create function public.loyalty_cards_contracts_append_only()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if old.ended_at is not null
     or (new.id, new.place_id, new.signed_by, new.signed_by_email, new.signer_role, new.terms_version,
         new.text_sha256, new.signed_at, new.ip, new.user_agent, new.created_at)
        is distinct from
        (old.id, old.place_id, old.signed_by, old.signed_by_email, old.signer_role, old.terms_version,
         old.text_sha256, old.signed_at, old.ip, old.user_agent, old.created_at) then
    raise exception 'loyalty_cards_contracts is append-only: only ending a live agreement is allowed'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;
create trigger loyalty_cards_contracts_append_only
  before update on public.loyalty_cards_contracts
  for each row execute function public.loyalty_cards_contracts_append_only();

revoke all on function public.place_payment_settings_loyalty_cards_guard() from public, anon, authenticated;
revoke all on function public.loyalty_cards_contracts_end() from public, anon, authenticated;
revoke all on function public.loyalty_cards_contracts_append_only() from public, anon, authenticated;
grant execute on function public.place_payment_settings_loyalty_cards_guard() to service_role;
grant execute on function public.loyalty_cards_contracts_end() to service_role;
grant execute on function public.loyalty_cards_contracts_append_only() to service_role;

-- ━━━ Bodies that named the old table or column ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create or replace function public.place_currency_open(p_place_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select not exists (select 1 from public.loyalty_cards_contracts where place_id = p_place_id and ended_at is null)
     and not exists (select 1 from public.place_payment_accounts where place_id = p_place_id)
     and not exists (select 1 from public.wallet_entries where place_id = p_place_id)
     and not exists (select 1 from public.wallet_payments where place_id = p_place_id)
     and not exists (select 1 from public.wallet_purchases where place_id = p_place_id)
     and not exists (select 1 from public.pay_tabs where place_id = p_place_id)
$function$;

-- admin_credit_limits answers both keys for one release: the deployed
-- web-admin reads house_credits until it redeploys (MESITA-4283 drops it).
create or replace function public.admin_credit_limits(p_livemode boolean)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with owed as (
    select place_id, currency, amount_cents::bigint as cents
      from public.wallet_entries where livemode = p_livemode
    union all
    select place_id, currency, amount_cents::bigint
      from public.wallet_gifts where livemode = p_livemode and status = 'open'
  ),
  totals as (
    select o.place_id, sum(o.cents)::bigint as outstanding_cents
      from owed o
      join public.places p on p.id = o.place_id and o.currency = lower(p.currency)
     group by o.place_id
  ),
  shown as (
    select p.id, p.currency, p.credit_limit_cents,
           coalesce(t.outstanding_cents, 0) as outstanding_cents,
           coalesce(s.loyalty_cards, false) as loyalty_cards
      from public.places p
      left join totals t on t.place_id = p.id
      left join public.place_payment_settings s on s.place_id = p.id
     where coalesce(t.outstanding_cents, 0) <> 0 or coalesce(s.loyalty_cards, false)
  )
  select jsonb_build_object(
    'defaults', coalesce((select jsonb_agg(jsonb_build_object(
                    'currency', d.currency, 'limit_cents', d.limit_cents, 'updated_at', d.updated_at)
                    order by d.currency) from public.credit_limit_defaults d), '[]'::jsonb),
    'places', coalesce((select jsonb_agg(jsonb_build_object(
                    'place_id', sh.id,
                    'place_name', coalesce(nullif(pp.name, ''), pp.google_name),
                    'currency', upper(sh.currency),
                    'outstanding_cents', sh.outstanding_cents,
                    'override_cents', sh.credit_limit_cents,
                    'limit_cents', coalesce(sh.credit_limit_cents, d.limit_cents),
                    'loyalty_cards', sh.loyalty_cards,
                    'house_credits', sh.loyalty_cards))
                  from shown sh
                  left join public.place_profiles pp on pp.id = sh.id
                  left join public.credit_limit_defaults d on d.currency = upper(sh.currency)), '[]'::jsonb));
$function$;

comment on function public.admin_credit_limits(boolean) is
  'MESITA-3947 (operator): Admin › Payments › Credits Limit in one universe (p_livemode, the EF''s STRIPE_MODE): the default per currency, and every place holding credit or with Loyalty Cards On, with its outstanding credit (wallet_place_outstanding''s sum, in the place''s currency), its own limit and the limit that binds it. Read by admin-web-get-credits-limit. Service role only.';

-- ━━━ The bridge (MESITA-4283 drops all three) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

alter table public.place_payment_settings
  add column house_credits boolean generated always as (loyalty_cards) stored;
comment on column public.place_payment_settings.house_credits is
  'MESITA-4282 bridge: a read-only copy of loyalty_cards for Edge Functions deployed before the rename. Dropped by MESITA-4283.';

create view public.house_credits_contracts
  with (security_invoker = true)
  as select * from public.loyalty_cards_contracts;
revoke all on table public.house_credits_contracts from public, anon, authenticated;
grant all on table public.house_credits_contracts to service_role;
comment on view public.house_credits_contracts is
  'MESITA-4282 bridge: the old name of loyalty_cards_contracts for Edge Functions deployed before the rename. Dropped by MESITA-4283.';

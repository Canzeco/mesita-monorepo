-- MESITA-3913 ONE HOUSE CREDITS CARD, ONE CURRENCY (Pato, 2026-11-14:
-- "one house credits card, one currency ... Credits Currency (that cannot be
-- changed as in inferred based on the location of the place)").
--
-- places.currency (MXN by default since 20260626) becomes the place's
-- country's currency, read from Google's address (place_profiles
-- .google_address, its `country` component): MX → MXN, US → USD. Every
-- ledger row already carries the place's currency, and wallet_balance
-- filters by it, so a guest's credit at a place is always one currency.
--
-- LOCKED ONCE MONEY EXISTS: the currency moves only while the place has no
-- Stripe account, no wallet entry, no payment and no bill. After that a new
-- address never changes it (a second currency would split a guest's balance
-- in two). Nobody edits it by hand: there is no write path from any app.

create or replace function public.currency_for_country(p_country text)
returns text
language sql
immutable
as $$
  select case upper(coalesce(p_country, ''))
    when 'MX' then 'MXN' when 'MEXICO' then 'MXN' when 'MÉXICO' then 'MXN'
    when 'US' then 'USD' when 'UNITED STATES' then 'USD'
    else null
  end
$$;

comment on function public.currency_for_country(text) is
  'MESITA-3913: a place''s currency from its country (ISO-2 or Google''s long name): MX → MXN, US → USD, else null.';

create or replace function public.place_country_from_address(p_address jsonb)
returns text
language sql
immutable
as $$
  select coalesce(c ->> 'shortText', c ->> 'longText')
    from jsonb_array_elements(coalesce(p_address -> 'addressComponents', '[]'::jsonb)) c
   where c -> 'types' ? 'country'
   limit 1
$$;

-- The lock: true while nothing about money exists at the place.
create or replace function public.place_currency_open(p_place_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select not exists (select 1 from public.place_payment_accounts where place_id = p_place_id)
     and not exists (select 1 from public.wallet_entries where place_id = p_place_id)
     and not exists (select 1 from public.wallet_payments where place_id = p_place_id)
     and not exists (select 1 from public.wallet_purchases where place_id = p_place_id)
     and not exists (select 1 from public.pay_tabs where place_id = p_place_id)
$$;

create or replace function public.place_currency_from_address()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_currency text := public.currency_for_country(public.place_country_from_address(new.google_address));
begin
  if v_currency is not null and public.place_currency_open(new.id) then
    update public.places set currency = v_currency where id = new.id and currency is distinct from v_currency;
  end if;
  return new;
end;
$$;

drop trigger if exists place_currency_from_address on public.place_profiles;
create trigger place_currency_from_address
  after insert or update of google_address on public.place_profiles
  for each row execute function public.place_currency_from_address();

revoke execute on function public.place_currency_open(uuid) from public, anon, authenticated;
revoke execute on function public.place_currency_from_address() from public, anon, authenticated;

-- Every place that already has an address, once (today all are in Mexico:
-- 12 with a country, all MX; 249 without, MXN by default).
update public.places p
   set currency = public.currency_for_country(public.place_country_from_address(pp.google_address))
  from public.place_profiles pp
 where pp.id = p.id
   and public.currency_for_country(public.place_country_from_address(pp.google_address)) is not null
   and p.currency is distinct from public.currency_for_country(public.place_country_from_address(pp.google_address))
   and public.place_currency_open(p.id);

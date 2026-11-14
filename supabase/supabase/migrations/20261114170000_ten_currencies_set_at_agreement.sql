-- MESITA-3923 TEN CURRENCIES, SET WHEN THE AGREEMENT IS SIGNED (Pato,
-- 2026-11-14: "all Selling ... only if the place main currency is that
-- place. the place main currency is selected when signing the Credits
-- Agreement").
--
-- 1. currency_for_country knows the ten: MX MXN · US USD · CA CAD · GB GBP ·
--    BR BRL · CO COP · CL CLP · PE PEN · JP JPY · the twenty euro countries
--    EUR. TWIN of COUNTRY_CURRENCY in _shared/money.ts.
-- 2. house_credits_contracts.currency: the currency the owner agreed to,
--    written at signing. A signed agreement locks places.currency, like a
--    Stripe account or any money already does (place_currency_open).
-- 3. place_country(place): the place's ISO-2 country from Google's address,
--    so Stripe onboarding opens the account in the place's own country.

create or replace function public.currency_for_country(p_country text)
returns text
language sql
immutable
as $$
  select case
    when upper(coalesce(p_country, '')) in ('MX', 'MEXICO', 'MÉXICO') then 'MXN'
    when upper(coalesce(p_country, '')) in ('US', 'UNITED STATES') then 'USD'
    when upper(coalesce(p_country, '')) in ('CA', 'CANADA') then 'CAD'
    when upper(coalesce(p_country, '')) in ('GB', 'UNITED KINGDOM') then 'GBP'
    when upper(coalesce(p_country, '')) in ('BR', 'BRAZIL', 'BRASIL') then 'BRL'
    when upper(coalesce(p_country, '')) in ('CO', 'COLOMBIA') then 'COP'
    when upper(coalesce(p_country, '')) in ('CL', 'CHILE') then 'CLP'
    when upper(coalesce(p_country, '')) in ('PE', 'PERU', 'PERÚ') then 'PEN'
    when upper(coalesce(p_country, '')) in ('JP', 'JAPAN') then 'JPY'
    when upper(coalesce(p_country, '')) in ('AT', 'BE', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV',
                                            'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES') then 'EUR'
    else null
  end
$$;

alter table public.house_credits_contracts add column if not exists currency text
  check (currency is null or currency ~ '^[A-Z]{3}$');
comment on column public.house_credits_contracts.currency is
  'MESITA-3923: the House Credits currency the owner agreed to (places.currency at signing). Null on agreements signed before it.';

create or replace function public.place_currency_open(p_place_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select not exists (select 1 from public.house_credits_contracts where place_id = p_place_id and ended_at is null)
     and not exists (select 1 from public.place_payment_accounts where place_id = p_place_id)
     and not exists (select 1 from public.wallet_entries where place_id = p_place_id)
     and not exists (select 1 from public.wallet_payments where place_id = p_place_id)
     and not exists (select 1 from public.wallet_purchases where place_id = p_place_id)
     and not exists (select 1 from public.pay_tabs where place_id = p_place_id)
$$;

create or replace function public.place_country(p_place_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select upper(c ->> 'shortText')
    from public.place_profiles pp,
         jsonb_array_elements(coalesce(pp.google_address -> 'addressComponents', '[]'::jsonb)) c
   where pp.id = p_place_id and c -> 'types' ? 'country'
   limit 1
$$;
revoke execute on function public.place_country(uuid) from public, anon, authenticated;
comment on function public.place_country(uuid) is
  'MESITA-3923: the place''s ISO-2 country from Google''s address, or null. Service role only (Stripe onboarding).';

-- Places whose address names one of the new countries, while still open.
update public.places p
   set currency = public.currency_for_country(public.place_country_from_address(pp.google_address))
  from public.place_profiles pp
 where pp.id = p.id
   and public.currency_for_country(public.place_country_from_address(pp.google_address)) is not null
   and p.currency is distinct from public.currency_for_country(public.place_country_from_address(pp.google_address))
   and public.place_currency_open(p.id);

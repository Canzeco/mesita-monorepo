-- MESITA-4283 — the House → Loyalty rename, step 3 of 3: the bridges go.
--
-- MESITA-4277 renamed wallet_house_cards to wallet_loyalty_cards and
-- MESITA-4282 renamed house_credits_contracts and
-- place_payment_settings.house_credits to the Loyalty Cards names, each
-- leaving the old name readable for the Edge Functions deployed before it.
-- Every function now live reads only the new names (checked on cloud after
-- both merges), so the old names leave the schema: no view, no copied
-- column, no old error code in the guard, no old key from
-- admin_credit_limits.

drop view public.wallet_house_cards;
drop view public.house_credits_contracts;
alter table public.place_payment_settings drop column house_credits;

create or replace function public.place_payment_settings_loyalty_cards_guard()
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
    raise exception 'loyalty_cards_unsigned: Loyalty Cards needs a signed Loyalty Cards Agreement'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

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
                    'loyalty_cards', sh.loyalty_cards))
                  from shown sh
                  left join public.place_profiles pp on pp.id = sh.id
                  left join public.credit_limit_defaults d on d.currency = upper(sh.currency)), '[]'::jsonb));
$function$;

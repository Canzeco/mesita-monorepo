-- MESITA-3590 follow-up — review findings on 20261110001500 (merged before
-- they landed). admin_reset_database() is that body with three guards widened:
--
--   1. Open money also covers wallet_refund_attempts in 'pending' (a Stripe
--      refund in flight: money-admin.ts inserts the row, calls Stripe, then
--      marks it done or failed) and place_backings in 'ready' with a change /
--      resume / update_card Checkout Session in flight (reported as
--      'ready:<checkout_kind>').
--   2. The livemode guard loops over every public base table with a livemode
--      column (pay_tabs, place_backings, place_fee_invoices,
--      place_payment_accounts, place_premier_periods, premier_customers,
--      premier_refill_purchases, wallet_entries, wallet_gifts,
--      wallet_payments, wallet_purchases, and any added later) instead of
--      two named tables. So the Stripe ids a wipe returns as left behind,
--      place_fee_invoices.stripe_customer_id included, are test mode only.
--   3. Unchanged: the flow_state cleanup, the preserve and super_admins
--      guards. The one-time orphan cleanup already ran in 20261110001500.

create or replace function public.admin_reset_database()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  keep_tables text[];
  wipe_tables text[];
  deleted_users bigint;
  deleted_flow_states bigint;
  missing_required text[];
  open_money jsonb;
  open_money_count bigint;
  live_rows jsonb;
  live_table text;
  live_sample jsonb;
  stripe_accounts text[];
  stripe_customers text[];
begin
  select coalesce(array_agg(p.table_name order by p.table_name), '{}'::text[])
    into keep_tables
    from public.admin_reset_preserve p;

  if not ('admin_reset_preserve' = any (keep_tables)) then
    keep_tables := keep_tables || array['admin_reset_preserve'];
  end if;

  select array_agg(r order by r) into missing_required
    from unnest(array[
      'app_config',
      'super_admins',
      'place_categories',
      'place_families',
      'place_tags',
      'consumer_code_counter'
    ]) r
   where not (r = any (keep_tables));
  if missing_required is not null then
    raise exception
      'admin_reset_preserve is missing required survivor(s): %. Refusing to wipe.',
      missing_required;
  end if;

  if not exists (select 1 from public.super_admins) then
    raise exception
      'super_admins is empty: the wipe would delete every auth user, including yours, and leave nobody able to re-grant admin. Refusing to wipe.';
  end if;

  -- Guard: open money. Lists at most 50 rows; open_money_count is the total.
  with open_rows as (
    select 'wallet_payments' as tbl, id::text as id, status, created_at
      from public.wallet_payments where status in ('opening', 'open', 'needs_review')
    union all
    select 'wallet_purchases', id::text, status, created_at
      from public.wallet_purchases where status in ('opening', 'open', 'needs_review')
    union all
    select 'premier_refill_purchases', id::text, status, created_at
      from public.premier_refill_purchases where status in ('open', 'paid', 'refund_needed')
    union all
    select 'place_fee_invoices', id::text, status, created_at
      from public.place_fee_invoices where status in ('draft', 'open')
    union all
    select 'pay_tabs', id::text, status, created_at
      from public.pay_tabs
     where status = 'paying'
        or (status in ('waiting_bill', 'billed') and expires_at > now())
    union all
    select 'place_charges', id::text, 'unpaid', created_at
      from public.place_charges where paid_at is null and expires_at > now()
    union all
    select 'place_premier_periods', id::text, status, created_at
      from public.place_premier_periods where status = 'charging'
    union all
    select 'place_backings', id::text,
           case when status = 'open' then status else status || ':' || checkout_kind end,
           created_at
      from public.place_backings
     where status = 'open'
        or (status = 'ready' and stripe_checkout_session_id is not null and checkout_kind is not null)
    union all
    select 'wallet_refund_attempts', id::text, status, created_at
      from public.wallet_refund_attempts where status = 'pending'
  )
  select count(*),
         coalesce(
           (select jsonb_agg(jsonb_build_object('table', o.tbl, 'id', o.id, 'status', o.status)
                             order by o.created_at desc)
              from (select * from open_rows order by created_at desc limit 50) o),
           '[]'::jsonb)
    into open_money_count, open_money
    from open_rows;

  -- Guard: live Stripe objects, in every public table with a livemode
  -- column. Up to 5 sample ids per table (the Stripe id where the table has
  -- one, else the row id).
  live_rows := '[]'::jsonb;
  for live_table in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema = 'public'
       and c.column_name = 'livemode'
       and t.table_type = 'BASE TABLE'
     order by c.table_name
  loop
    execute format(
      'select coalesce(jsonb_agg(jsonb_build_object(''table'', %L, ''id'', '
        || 'coalesce(j->>''stripe_account_id'', j->>''stripe_customer'', j->>''id'', ''?''))), ''[]''::jsonb) '
        || 'from (select to_jsonb(x) as j from public.%I x where x.livemode is true limit 5) s',
      live_table, live_table)
      into live_sample;
    live_rows := live_rows || live_sample;
  end loop;

  if open_money_count > 0 or jsonb_array_length(live_rows) > 0 then
    return jsonb_build_object(
      'ok', false,
      'refused', to_jsonb(array_remove(array[
        case when open_money_count > 0 then 'open_money' end,
        case when jsonb_array_length(live_rows) > 0 then 'livemode' end
      ], null)),
      'open_money', open_money,
      'open_money_count', open_money_count,
      'livemode_rows', live_rows
    );
  end if;

  -- What the wipe strands in Stripe (test mode, by the guard above).
  select coalesce(array_agg(distinct a.stripe_account_id order by a.stripe_account_id), '{}'::text[])
    into stripe_accounts
    from public.place_payment_accounts a
   where a.stripe_account_id is not null;

  select coalesce(array_agg(distinct s.customer_id order by s.customer_id), '{}'::text[])
    into stripe_customers
    from (
      select pc.stripe_customer as customer_id from public.premier_customers pc
      union
      select a.fee_customer_id from public.place_payment_accounts a
      union
      select i.stripe_customer_id from public.place_fee_invoices i
    ) s
   where s.customer_id is not null;

  select coalesce(array_agg(format('public.%I', c.relname) order by c.relname), '{}'::text[])
    into wipe_tables
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p')
     and not c.relispartition
     and c.relname <> all (keep_tables)
     and not exists (
       select 1 from pg_depend d
        where d.objid = c.oid
          and d.classid = 'pg_class'::regclass
          and d.deptype = 'e'
     );

  if coalesce(array_length(wipe_tables, 1), 0) > 0 then
    execute format(
      'truncate table %s restart identity cascade',
      array_to_string(wipe_tables, ', ')
    );
  end if;

  update public.consumer_code_counter set next_value = 0 where id = 1;

  perform public.seed_place_families();
  perform public.seed_place_categories();
  perform public.seed_place_tags();

  delete from auth.users u
  where not exists (
    select 1
    from public.super_admins sa
    where (u.email is not null and lower(u.email) = lower(sa.email))
       or (sa.user_id is not null and sa.user_id = u.id)
  );
  get diagnostics deleted_users = row_count;

  delete from auth.flow_state f
   where f.user_id is null
      or not exists (select 1 from auth.users u where u.id = f.user_id);
  get diagnostics deleted_flow_states = row_count;

  return jsonb_build_object(
    'ok', true,
    'truncated_tables', coalesce(array_length(wipe_tables, 1), 0),
    'preserved_tables', coalesce(array_length(keep_tables, 1), 0),
    'deleted_auth_users', deleted_users,
    'deleted_flow_states', deleted_flow_states,
    'stripe_left_behind', jsonb_build_object(
      'connected_accounts', to_jsonb(stripe_accounts),
      'customers', to_jsonb(stripe_customers)
    ),
    'reset_at', now()
  );
end;
$function$;

-- MESITA-3590 — the reset-database audit follow-ups, database half.
--
-- admin_reset_database() is the live body (pg_get_functiondef, 2026-11-09)
-- with three additions and every existing guard kept:
--
--   1. It REFUSES while any money is open, and lists what is open. A wipe
--      mid-payment leaves the Stripe PaymentIntent, Checkout Session or
--      invoice alive with no row to close or reconcile it. "Open" is every
--      non-final status the CHECK constraints allow:
--        wallet_payments, wallet_purchases   opening · open · needs_review
--        premier_refill_purchases            open · paid (not yet granted) · refund_needed
--        place_fee_invoices                  draft · open
--        pay_tabs                            paying, or waiting_bill · billed before expires_at
--                                            (those two expire lazily, so a past one is dead)
--        place_charges                       unpaid and before expires_at (no status column)
--        place_premier_periods               charging
--        place_backings                      open (a Checkout Session in flight)
--   2. It REFUSES while any Stripe account or customer row is livemode = true
--      (place_payment_accounts, premier_customers): a wipe would strand a
--      live connected account or a live customer with saved cards.
--   3. After deleting users it deletes auth.flow_state rows that point at no
--      user (user_id null or no auth.users match). flow_state has no foreign
--      key to auth.users, so nothing cascades, and those rows carry OAuth
--      provider tokens.
--
-- A refusal changes nothing and returns { ok: false, refused: [...], ... };
-- the EF answers 409 and skips the storage purge. A wipe returns the Stripe
-- ids it leaves behind (test mode only, by guard 2) so the operator can
-- delete them in the Stripe dashboard.
--
-- Plus a one-time cleanup of the orphan flow_state rows already there
-- (24 Google rows from earlier resets on 2026-11-09).

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
    select 'place_backings', id::text, status, created_at
      from public.place_backings where status = 'open'
  )
  select count(*),
         coalesce(
           (select jsonb_agg(jsonb_build_object('table', o.tbl, 'id', o.id, 'status', o.status)
                             order by o.created_at desc)
              from (select * from open_rows order by created_at desc limit 50) o),
           '[]'::jsonb)
    into open_money_count, open_money
    from open_rows;

  -- Guard: live Stripe objects.
  select coalesce(jsonb_agg(x order by x->>'table', x->>'id'), '[]'::jsonb)
    into live_rows
    from (
      select jsonb_build_object('table', 'place_payment_accounts', 'id', a.stripe_account_id) as x
        from public.place_payment_accounts a where a.livemode
      union all
      select jsonb_build_object('table', 'premier_customers', 'id', c.stripe_customer)
        from public.premier_customers c where c.livemode
    ) s;

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

-- One-time: the orphans earlier resets and deletions already left.
delete from auth.flow_state f
 where f.user_id is not null
   and not exists (select 1 from auth.users u where u.id = f.user_id);

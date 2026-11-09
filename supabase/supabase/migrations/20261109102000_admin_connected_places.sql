-- MESITA-3383: the operator's list of connected places (Manage › Money).
--
--   admin_connected_places(p_livemode, p_before, p_before_id)
--     every place with a place_payment_accounts row in one universe
--     (p_livemode, the EF's STRIPE_MODE, never the body's): the place's name,
--     what Stripe last said about the account, the switches the owner has on
--     (the place_payment_settings row as jsonb, minus its bookkeeping), the
--     credit outstanding at the place now (Available and Pending), and the
--     last Connect event received for the account. 50 a page, newest account
--     first, by a (created_at, place_id) cursor. Service role only.
--
-- Additive: one new read-only function. The EF deploys about five minutes
-- after this applies; nothing calls it until then.

create or replace function public.admin_connected_places(
  p_livemode boolean, p_before timestamptz default null, p_before_id uuid default null)
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  with page as (
    select a.* from public.place_payment_accounts a
     where a.livemode = p_livemode
       and (p_before is null
            or a.created_at < p_before
            or (p_before_id is not null and a.created_at = p_before and a.place_id < p_before_id))
     order by a.created_at desc, a.place_id desc
     limit 50
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'place_id', page.place_id,
           'place_name', coalesce(nullif(pp.name, ''), pp.google_name),
           'created_at', page.created_at,
           'charges_enabled', page.charges_enabled,
           'details_submitted', page.details_submitted,
           'payouts_enabled', page.payouts_enabled,
           'disabled_reason', page.disabled_reason,
           'requirements_due', jsonb_array_length(page.requirements_due),
           'switches', coalesce(to_jsonb(s) - 'place_id' - 'updated_at' - 'updated_by', '{}'::jsonb),
           'available_cents', coalesce(e.available_cents, 0),
           'pending_cents', coalesce(e.pending_cents, 0),
           'last_event_at', ev.last_event_at)
           order by page.created_at desc, page.place_id desc), '[]'::jsonb)
    from page
    left join public.place_profiles pp on pp.id = page.place_id
    left join public.place_payment_settings s on s.place_id = page.place_id
    left join lateral (
      select coalesce(sum(w.amount_cents) filter (where w.available_at <= now()), 0) as available_cents,
             coalesce(sum(w.amount_cents) filter (where w.available_at > now()), 0) as pending_cents
        from public.wallet_entries w
       where w.place_id = page.place_id and w.livemode = p_livemode
    ) e on true
    left join lateral (
      select max(c.received_at) as last_event_at
        from public.stripe_connect_events c
       where c.account = page.stripe_account_id
    ) ev on true;
$function$;

revoke all on function public.admin_connected_places(boolean, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.admin_connected_places(boolean, timestamptz, uuid) to service_role;

comment on function public.admin_connected_places(boolean, timestamptz, uuid) is
  'MESITA-3383 (operator): every place with a place_payment_accounts row in one universe (p_livemode): name, Stripe''s account flags, the owner''s switches, credit outstanding (Available and Pending, now) and the last Connect event received; 50 a page newest account first by the (created_at, place_id) cursor. Service role only.';

-- Post-flight: the function exists and no client role can call it.
do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'admin_connected_places') then
    raise exception 'admin_connected_places is missing after apply';
  end if;
  if has_function_privilege('authenticated', 'public.admin_connected_places(boolean, timestamptz, uuid)', 'execute') then
    raise exception 'admin_connected_places must not be callable by authenticated';
  end if;
end $$;

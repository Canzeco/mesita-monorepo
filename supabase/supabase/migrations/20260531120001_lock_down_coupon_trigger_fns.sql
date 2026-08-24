-- 0031_b — lock down the coupon-issue / coupon-cancel trigger functions.
--
-- Both functions are SECURITY DEFINER so the trigger can write into
-- public.coupons even when the inserting/deleting role doesn't have
-- direct DML on that table. The side effect is that they're also
-- exposed via PostgREST as RPC endpoints — /rest/v1/rpc/tg_…  Anyone
-- with the anon key (i.e., the public internet) could otherwise call
-- them directly with hand-crafted record arguments.
--
-- Trigger functions are never meant to be invoked by clients; the
-- engine calls them. Revoking EXECUTE from anon, authenticated and
-- public closes that door. The service role retains EXECUTE via its
-- blanket grant in supabase's standard role setup.
--
-- Found by `get_advisors` immediately after 0031 landed — addressing
-- in a follow-up rather than amending 0031 so the schema migration
-- and the hardening read as separate intents in the history.

-- Filename order runs this file before 20260531120003 creates the
-- functions. Prod applied the other way. Skip the REVOKE when the
-- function is not there yet; 20260824221900 reapplies once it exists.
do $mesita_1278_lockdown$
begin
  if to_regprocedure('public.tg_saved_venues_issue_coupon()') is not null then
    revoke execute on function public.tg_saved_venues_issue_coupon() from anon, authenticated, public;
  end if;
  if to_regprocedure('public.tg_saved_venues_cancel_coupon()') is not null then
    revoke execute on function public.tg_saved_venues_cancel_coupon() from anon, authenticated, public;
  end if;
end
$mesita_1278_lockdown$;

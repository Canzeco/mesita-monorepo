-- MESITA-1278 follow-up. 20260531120001 revokes EXECUTE on coupon trigger
-- functions that 20260531120003 creates two filenames later. The lock-down
-- file now no-ops when the functions are missing; this reapplies the revoke
-- after they exist. Prod already revoked (and later renamed) them.

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

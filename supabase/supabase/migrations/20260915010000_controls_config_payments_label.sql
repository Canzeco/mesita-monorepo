-- The Credits page is called Payments (Pato, 2026-09-14: "rename credits to
-- payments its simpler"). MESITA-1854.
--
-- Same shape as 20260902141528, which re-pointed this sentence the last time
-- the row was renamed. `controls_config`'s column comment named "admin console
-- > Configurations > Credits"; that row reads **Payments** now, so the comment
-- sends whoever reads `\d app_config` looking for a rail entry that is not
-- there — and this comment is the only place the schema itself says who owns
-- the blob.
--
-- It also drops two endpoint names the last version kept: the twenty per-page
-- config Edge Functions collapsed into two dispatchers (MESITA-1724), so
-- `admin-web-*-controls-config` does not exist — `.github/workflows/supabase-
-- deploy.yml` lists both in the leftover sweep that proves they are gone. The
-- admin wire is `section: "controls"` on admin-web-get/update-config.
--
-- THE RENAME STOPS AT THE LABEL. The column stays `controls_config`, the route
-- stays `/controls-config`, the consumer EF stays
-- `consumer-web-get-controls-config`. A rename that reached any of those would
-- be the bug the frozen-directory rule exists to prevent; re-pointing the
-- sentence that names the page is the whole change.
--
-- Comment-only: no DDL on the column, no write to the singleton, so nothing
-- here can move a term a place is already selling.

comment on column public.app_config.controls_config is
  'Wallet Credits controls, owned by admin console > Configurations > Payments (the page label; the column, the route /controls-config and the consumer EF name deliberately keep the old word). defaultHoldHours (3) is the hold a place INHERITS when it has set none - a fallback, not a flat rule; a place may hold longer up to maxHoldHours (72) to justify a bigger bonus. defaultBonusPct (5) applies the same way. defaultExpiryDays (90) is how long unspent Credits live, counted in DAYS from the top-up; minExpiryDays (30) is the shortest life a place may sell - a FLOOR, because a short expiry is what hurts a guest, where a long hold is. minHoldHours ships unrendered: no reader yet. Read by admin-web-get/update-config (section "controls") and consumer-web-get-controls-config.';

-- Post-flight: the comment must actually name the page, or the next operator
-- reading the schema is sent to a rail row that is not there.
do $$
begin
  if position('Configurations > Payments' in coalesce(
       col_description('public.app_config'::regclass,
         (select attnum from pg_attribute
           where attrelid = 'public.app_config'::regclass
             and attname = 'controls_config')),
       '')) = 0 then
    raise exception 'controls_config comment still points at the old page label';
  end if;
end $$;

notify pgrst, 'reload schema';

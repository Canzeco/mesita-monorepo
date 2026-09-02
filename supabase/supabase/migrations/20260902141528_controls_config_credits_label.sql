-- The Controls page is called Credits (Pato, 2026-09-02).
--
-- `controls_config`'s column comment pointed an operator at "admin console >
-- Configurations > Controls". That row is labelled **Credits** now, so the
-- comment sends whoever reads `\d app_config` looking for a rail entry that no
-- longer exists under that name — and this comment is the only place the schema
-- itself says who owns the blob.
--
-- THE RENAME STOPPED AT THE LABEL, which is why this migration touches nothing
-- but the comment. The column stays `controls_config`, the route stays
-- `/controls-config`, and the endpoints stay `admin-web-get/update-controls-
-- config`. A rename that reached any of those would be the bug the
-- frozen-directory rule exists to prevent; re-pointing the sentence that names
-- the page is the whole change.
--
-- Comment-only: no DDL on the column, no write to the singleton, so nothing
-- here can move a term a place is already selling.

comment on column public.app_config.controls_config is
  'Wallet Credits controls, owned by admin console > Configurations > Credits (the page label; the column, the route /controls-config and the admin-web-*-controls-config endpoints deliberately keep the old word). defaultHoldHours (3) is the hold a place INHERITS when it has set none - a fallback, not a flat rule; a place may hold longer up to maxHoldHours (72) to justify a bigger bonus. defaultBonusPct (5) applies the same way. defaultExpiryDays (90) is how long unspent Credits live, counted in DAYS from the top-up; minExpiryDays (30) is the shortest life a place may sell - a FLOOR, because a short expiry is what hurts a guest, where a long hold is. minHoldHours ships unrendered: no reader yet. Read by admin-web-get/update-controls-config and consumer-web-get-controls-config.';

-- Post-flight: the comment must actually name the page, or the next operator
-- reading the schema is sent to a rail row that is not there.
do $$
begin
  if position('Configurations > Credits' in coalesce(
       col_description('public.app_config'::regclass,
         (select attnum from pg_attribute
           where attrelid = 'public.app_config'::regclass
             and attname = 'controls_config')),
       '')) = 0 then
    raise exception 'controls_config comment still points at the old page label';
  end if;
end $$;

notify pgrst, 'reload schema';

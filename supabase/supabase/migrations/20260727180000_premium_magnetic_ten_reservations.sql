-- Premium and Magnetic get 10 reservations a month, not unlimited (Pato,
-- 2026-07-27). The two elevated classes share ONE perk set — better
-- recommendations, higher discount rewards, 10 reservations/month — which is
-- the `premium <= magnetic` ladder locked the same session: Magnetic never
-- pays less than Premium, and today they tie on every perk.
--
-- `monthly_reservation_limit` is enforced at booking by
-- consumer-web-create-reservation (null = unlimited), so this is a live
-- product change, not just copy.

update public.classes
set monthly_reservation_limit = 10
where key in ('premium', 'magnetic');

-- Keep the reset seed in lock-step, or admin_reset_database would restore the
-- retired `null` (unlimited) values on the next reset.
--
-- Patched SURGICALLY off the live definition rather than re-declared: this
-- function has been rewritten many times (truncate list, jsonb return,
-- search_path) and hand-retyping the body is exactly how a stub once
-- clobbered prod. We rewrite only the two seed rows and fail loudly if they
-- are not found verbatim.
do $patch$
declare
  def text;
  patched text;
begin
  select pg_get_functiondef(p.oid)
    into def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'admin_reset_database';

  if def is null then
    raise exception 'admin_reset_database not found';
  end if;

  patched := replace(
    replace(
      def,
      '(''premium'',  ''Premium'',  1, null, null, 10000, ''MXN'', 1.5)',
      '(''premium'',  ''Premium'',  1, null, 10,   10000, ''MXN'', 1.5)'
    ),
    '(''magnetic'', ''Magnetic'', 2, 5000, null, 0,     ''MXN'', 1.5)',
    '(''magnetic'', ''Magnetic'', 2, 5000, 10,   0,     ''MXN'', 1.5)'
  );

  if patched = def then
    raise exception
      'admin_reset_database classes seed did not match the expected rows — re-diff before patching';
  end if;

  execute patched;
end
$patch$;

-- MESITA-3206 — shares: EF-only, and one row per guest per place.

begin;

create extension if not exists pgtap with schema public;

select plan(2);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.place_shares'::regclass)
    and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'place_shares')
    and not has_table_privilege('anon', 'public.place_shares', 'SELECT')
    and not has_table_privilege('authenticated', 'public.place_shares', 'SELECT')
    and not has_table_privilege('authenticated', 'public.place_shares', 'INSERT'),
  'place_shares has RLS on, no policy, and client roles hold nothing'
);

select col_is_pk('public', 'place_shares', array['consumer_id', 'place_id'], 'one row per guest per place');

select * from finish();
rollback;

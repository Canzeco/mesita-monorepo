-- MESITA-5060 — share tracking: EF-only, one code per guest, one sign-up per
-- new guest, and never your own.

begin;

create extension if not exists pgtap with schema public;

select plan(4);

select ok(
  (select bool_and(c.relrowsecurity) from pg_class c
     where c.oid in ('public.share_codes'::regclass, 'public.share_opens'::regclass, 'public.share_signups'::regclass))
    and not exists (select 1 from pg_policies where schemaname = 'public'
                      and tablename in ('share_codes', 'share_opens', 'share_signups'))
    and not has_table_privilege('anon', 'public.share_opens', 'INSERT')
    and not has_table_privilege('authenticated', 'public.share_codes', 'SELECT')
    and not has_table_privilege('authenticated', 'public.share_signups', 'SELECT'),
  'share tables have RLS on, no policy, and client roles hold nothing'
);

select col_is_pk('public', 'share_codes', 'consumer_id', 'one code per guest');
select col_is_pk('public', 'share_signups', 'consumer_id', 'one sign-up credit per new guest');

select ok(
  exists (select 1 from pg_constraint
           where conrelid = 'public.share_signups'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%consumer_id <> sharer_id%'),
  'a guest is never credited to their own code'
);

select * from finish();
rollback;

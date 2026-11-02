-- MESITA-3123 — the Business Claim search budget holds per account.

begin;

create extension if not exists pgtap with schema public;

select plan(4);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000a3123');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.business_search_attempts'::regclass)
    and not has_table_privilege('authenticated', 'public.business_search_attempts', 'SELECT')
    and not has_function_privilege('authenticated', 'public.business_search_take(uuid, integer)', 'EXECUTE'),
  'the search budget is EF-only'
);

select is(
  array[
    business_search_take('00000000-0000-4000-8000-0000000a3123', 2),
    business_search_take('00000000-0000-4000-8000-0000000a3123', 2)
  ],
  array[true, true],
  'searches up to the cap are allowed'
);

select is(business_search_take('00000000-0000-4000-8000-0000000a3123', 2), false, 'the search past the cap is refused');

update public.business_search_attempts set at = now() - interval '25 hours'
 where account_id = '00000000-0000-4000-8000-0000000a3123';

select is(business_search_take('00000000-0000-4000-8000-0000000a3123', 2), true, 'a day later the budget is back');

select * from finish();
rollback;

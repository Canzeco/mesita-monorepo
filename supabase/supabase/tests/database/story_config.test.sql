-- MESITA-4425 — money_config_merge_story: the Stories config page's one write.
-- It merges only allowed Story keys into app_config.money_config, keeps every
-- other key, refuses bad types and unknown keys, clamps the floor, stamps the
-- admin, answers before/after, and no client role can call it.

begin;

create extension if not exists pgtap with schema public;

select plan(14);

update public.app_config
   set money_config = coalesce(money_config, '{}'::jsonb) || '{"buying_paused": true, "express_wallets": ["apple_pay"], "story_min_followers": 1000}'::jsonb
 where id = 1;

select has_function('public', 'money_config_merge_story', array['jsonb', 'uuid'], 'the merge RPC exists');

select is(
  (public.money_config_merge_story('{"story_min_followers": 500}'::jsonb, null) -> 'after' ->> 'story_min_followers')::int,
  500, 'a whole number lands and is answered after');
select is((select (money_config ->> 'story_min_followers')::int from public.app_config where id = 1), 500, 'the floor is stored');
select is((select money_config -> 'buying_paused' from public.app_config where id = 1), 'true'::jsonb, 'buying_paused survives');
select is((select money_config -> 'express_wallets' from public.app_config where id = 1), '["apple_pay"]'::jsonb, 'express_wallets survives');

select is(
  (public.money_config_merge_story('{"story_min_followers": 5000000}'::jsonb) -> 'after' ->> 'story_min_followers')::int,
  1000000, 'above the range clamps to 1,000,000');
select is(
  (public.money_config_merge_story('{"story_min_followers": -3}'::jsonb) -> 'after' ->> 'story_min_followers')::int,
  0, 'below the range clamps to 0');
select is(
  (public.money_config_merge_story('{"story_min_followers": 700}'::jsonb) -> 'before' ->> 'story_min_followers')::int,
  0, 'the answer carries the value before');

select throws_ok($$ select public.money_config_merge_story('{"story_min_followers": "abc"}'::jsonb) $$, '22023', null, 'a string is refused');
select throws_ok($$ select public.money_config_merge_story('{"story_min_followers": 2.5}'::jsonb) $$, '22023', null, 'a fraction is refused');
select throws_ok($$ select public.money_config_merge_story('{"buying_paused": false}'::jsonb) $$, '22023', null, 'a key outside the Story list is refused');
select throws_ok($$ select public.money_config_merge_story('[1]'::jsonb) $$, '22023', null, 'a non-object is refused');

select is((select money_config -> 'buying_paused' from public.app_config where id = 1), 'true'::jsonb, 'refusals changed nothing');

select ok(
  not has_function_privilege('authenticated', 'public.money_config_merge_story(jsonb, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.money_config_merge_story(jsonb, uuid)', 'execute'),
  'no client role can call it');

select * from finish();
rollback;

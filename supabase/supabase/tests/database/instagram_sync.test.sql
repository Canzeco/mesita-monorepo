-- MESITA-3060 — Me › Instagram's Sync: every paid scrape claims a slot
-- first (60 s between syncs, a daily budget shared with connect), and a sync
-- writes only to the handle it read, never instagram_verified_at.

begin;

create extension if not exists pgtap with schema public;

select plan(23);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a3060'),
  ('00000000-0000-4000-8000-0000000b3060'),
  ('00000000-0000-4000-8000-0000000c3060'),
  ('00000000-0000-4000-8000-0000000d3060');
insert into public.consumers (id, instagram_handle, instagram_followers_count, instagram_verified_at)
values
  ('00000000-0000-4000-8000-0000000a3060', 'ana.3060', 100, '2026-10-01T00:00:00Z'),
  ('00000000-0000-4000-8000-0000000b3060', 'bea.3060', 50, '2026-10-01T00:00:00Z'),
  ('00000000-0000-4000-8000-0000000c3060', 'cel.3060', 10, '2026-10-01T00:00:00Z');
update public.consumers set deleted_at = now() where id = '00000000-0000-4000-8000-0000000c3060';

-- ━━━ claim: cooldown, budget, day reset ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  public.consumer_instagram_claim_scrape('00000000-0000-4000-8000-0000000a3060', 'sync', 60, 3) ->> 'status',
  'ok', 'a first sync claims a slot');

select is(
  public.consumer_instagram_claim_scrape('00000000-0000-4000-8000-0000000a3060', 'sync', 60, 3) ->> 'status',
  'slow_down', 'a second sync inside 60 s is refused');

select ok(
  (public.consumer_instagram_claim_scrape('00000000-0000-4000-8000-0000000a3060', 'sync', 60, 3) ->> 'retry_after_s')::int between 1 and 60,
  'slow_down says how long to wait');

select is(
  public.consumer_instagram_claim_scrape('00000000-0000-4000-8000-0000000a3060', 'connect', 60, 3) ->> 'status',
  'ok', 'a connect is not held by the sync cooldown');

update public.consumers set instagram_sync_attempted_at = now() - interval '61 seconds'
 where id = '00000000-0000-4000-8000-0000000a3060';

select is(
  public.consumer_instagram_claim_scrape('00000000-0000-4000-8000-0000000a3060', 'sync', 60, 3),
  jsonb_build_object('status', 'ok', 'remaining', 0, 'limit', 3),
  'after the window the third scrape of the day is allowed, none left');

update public.consumers set instagram_sync_attempted_at = now() - interval '61 seconds'
 where id = '00000000-0000-4000-8000-0000000a3060';

select is(
  public.consumer_instagram_claim_scrape('00000000-0000-4000-8000-0000000a3060', 'sync', 60, 3) ->> 'status',
  'daily_limit', 'the budget is spent: sync refused');

select is(
  public.consumer_instagram_claim_scrape('00000000-0000-4000-8000-0000000a3060', 'connect', 60, 3) ->> 'status',
  'daily_limit', 'the budget is shared: connect refused too');

select is(
  (public.consumer_instagram_claim_scrape('00000000-0000-4000-8000-0000000a3060', 'connect', 60, 3) ->> 'resets_at')::timestamptz,
  ((now() at time zone 'utc')::date + 1)::timestamp at time zone 'utc',
  'daily_limit says when the UTC day rolls over');

update public.consumers set instagram_sync_day = instagram_sync_day - 1
 where id = '00000000-0000-4000-8000-0000000a3060';

select is(
  public.consumer_instagram_claim_scrape('00000000-0000-4000-8000-0000000a3060', 'connect', 60, 3) ->> 'status',
  'ok', 'a new UTC day resets the budget');

select is(
  (select instagram_sync_count from public.consumers where id = '00000000-0000-4000-8000-0000000a3060'),
  1, 'the new day starts counting at 1');

select is(
  public.consumer_instagram_claim_scrape('00000000-0000-4000-8000-0000000c3060', 'sync', 60, 3) ->> 'status',
  'not_found', 'a deleted account claims nothing');

select is(
  public.consumer_instagram_claim_scrape('00000000-0000-4000-8000-00000000dead', 'sync', 60, 3) ->> 'status',
  'not_found', 'a missing account claims nothing');

-- ━━━ sync write: only the handle it read ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  public.consumer_instagram_sync('00000000-0000-4000-8000-0000000b3060', 'bea.3060', 75),
  'a sync writes when the handle is unchanged');

select is(
  (select row(instagram_followers_count, instagram_synced_at is not null,
              instagram_verified_at = '2026-10-01T00:00:00Z'::timestamptz)::text
     from public.consumers where id = '00000000-0000-4000-8000-0000000b3060'),
  '(75,t,t)', 'the count and synced time move; instagram_verified_at does not');

select ok(
  not public.consumer_instagram_sync('00000000-0000-4000-8000-0000000b3060', 'someone.else', 9),
  'a sync for a handle the account no longer holds writes nothing');

select ok(
  not public.consumer_instagram_sync('00000000-0000-4000-8000-0000000c3060', 'cel.3060', 9),
  'a sync on a deleted account writes nothing');

-- ━━━ verify: stamps the sync time, a new handle resets the choice ━━━━━━━━━━
-- MESITA-4659: verify just read the follower count (the VIP claim's
-- freshness), and "Show my handle" was a choice about one handle.

insert into public.consumers (id, instagram_handle, instagram_followers_count, instagram_verified_at, instagram_handle_shown)
values ('00000000-0000-4000-8000-0000000d3060', 'dan.3060', 10, '2026-10-01T00:00:00Z', true);
update public.consumers set instagram_handle_shown = true where id = '00000000-0000-4000-8000-0000000a3060';

select public.consumer_instagram_verify('00000000-0000-4000-8000-0000000d3060', 'dan.3060', 200);
select is(
  (select row(instagram_handle_shown, instagram_synced_at is not null, instagram_followers_count)::text
     from public.consumers where id = '00000000-0000-4000-8000-0000000d3060'),
  '(t,t,200)', 'verifying the same handle keeps the choice and stamps instagram_synced_at');

select public.consumer_instagram_verify('00000000-0000-4000-8000-0000000d3060', 'ana.3060', 300);
select is(
  (select row(instagram_handle, instagram_handle_shown is null)::text
     from public.consumers where id = '00000000-0000-4000-8000-0000000d3060'),
  '(ana.3060,t)', 'a new handle resets the choice to none (hidden)');
select is(
  (select row(instagram_handle is null, instagram_handle_shown is null)::text
     from public.consumers where id = '00000000-0000-4000-8000-0000000a3060'),
  '(t,t)', 'the account the handle was taken from loses it and its choice');

-- MESITA-4856: only a proof is proof, and a typed connect cannot take a
-- handle its owner proved.
select ok(
  (select instagram_proved_at is null from public.consumers where id = '00000000-0000-4000-8000-0000000d3060'),
  'a typed connect proves nothing');
select public.consumer_instagram_verify('00000000-0000-4000-8000-0000000d3060', 'ana.3060', 300, null, true);
select throws_ok(
  $$ select public.consumer_instagram_verify('00000000-0000-4000-8000-0000000a3060', 'ana.3060', 300) $$,
  'P0001', 'handle_proved_elsewhere',
  'a typed connect cannot take a proved handle');
select public.consumer_instagram_verify('00000000-0000-4000-8000-0000000d3060', 'dan.3060', 300);
select ok(
  (select instagram_proved_at is null from public.consumers where id = '00000000-0000-4000-8000-0000000d3060'),
  'a new handle starts unproved');

-- ━━━ only the service role runs them ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  not has_function_privilege('anon', 'public.consumer_instagram_claim_scrape(uuid, text, integer, integer)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.consumer_instagram_claim_scrape(uuid, text, integer, integer)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.consumer_instagram_sync(uuid, text, integer, boolean)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.consumer_instagram_sync(uuid, text, integer, boolean)', 'EXECUTE'),
  'client roles cannot execute either function');

select * from finish();

rollback;

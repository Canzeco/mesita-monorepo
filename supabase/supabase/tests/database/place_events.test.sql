-- MESITA-3219, MESITA-3392, MESITA-3422, MESITA-4326 — the history behind Business Views, and the
-- guest readers that count every open from it: what writes a row, and that a
-- like taken back is gone. Guests' names in the log are place_views_log.test.sql.

begin;

create extension if not exists pgtap with schema public;

select plan(23);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000a3219');
insert into public.consumers (id, first_name, birth_year) values ('00000000-0000-4000-8000-0000000a3219', 'Probe', 1990);
insert into public.place_profiles (id, google_name)
values ('00000000-0000-4000-8000-000000003219', 'Events Probe');
insert into public.places (id, slug, state, content_state, currency)
values ('00000000-0000-4000-8000-000000003219', 'mesita-3219-probe', 'active', 'generating', 'MXN');

create function pg_temp.events(p_kind text) returns int language sql as $$
  select count(*)::int from public.place_events
   where place_id = '00000000-0000-4000-8000-000000003219' and kind = p_kind
$$;

-- What consumer-web-track-activity and consumer-web-track-place-share send.
create function pg_temp.track(p_kind text, p_at timestamptz, p_quiet boolean default false) returns void language sql as $$
  insert into public.place_activity (consumer_id, place_id, kind, created_at, quiet)
  values ('00000000-0000-4000-8000-0000000a3219', '00000000-0000-4000-8000-000000003219', p_kind, p_at, p_quiet)
  on conflict (consumer_id, place_id, kind) do update set created_at = excluded.created_at, quiet = excluded.quiet
$$;

create function pg_temp.share(p_at timestamptz) returns void language sql as $$
  insert into public.place_shares (consumer_id, place_id, shared_at)
  values ('00000000-0000-4000-8000-0000000a3219', '00000000-0000-4000-8000-000000003219', p_at)
  on conflict (consumer_id, place_id) do update set shared_at = excluded.shared_at
$$;

create function pg_temp.unlike() returns void language sql as $$
  delete from public.place_activity
   where consumer_id = '00000000-0000-4000-8000-0000000a3219'
     and place_id = '00000000-0000-4000-8000-000000003219'
     and kind = 'saved'
$$;

select ok(
  (select relrowsecurity from pg_class where oid = 'public.place_events'::regclass)
    and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'place_events')
    and not has_table_privilege('anon', 'public.place_events', 'SELECT')
    and not has_table_privilege('authenticated', 'public.place_events', 'SELECT'),
  'place_events has RLS on, no policy, and client roles hold nothing'
);

select pg_temp.track('viewed', now() - interval '2 hours');
select pg_temp.track('viewed', now() - interval '110 minutes');
select is(pg_temp.events('viewed'), 2, 'a reopen ten minutes later is a new view (MESITA-3392)');

select pg_temp.track('viewed', now() - interval '109 minutes 50 seconds');
select pg_temp.track('viewed', now() - interval '109 minutes 40 seconds');
select is(pg_temp.events('viewed'), 4, 'every open is a view, even several in the same minute, and the old ones stay');
select is(
  (select count(*)::int from public.place_activity where place_id = '00000000-0000-4000-8000-000000003219' and kind = 'viewed'),
  1,
  'place_activity still holds one row per guest, so the guest counts do not change'
);

select pg_temp.track('saved', now() - interval '50 minutes', true);
select is(pg_temp.events('saved'), 0, 'a backfilled quiet save is not a like');

select pg_temp.track('saved', now() - interval '40 minutes');
select is(pg_temp.events('saved'), 1, 'liking a place held as a quiet save is a like');

select pg_temp.track('saved', now() - interval '39 minutes');
select is(pg_temp.events('saved'), 1, 'a second like on a standing like is not a new tap');

select pg_temp.unlike();
select is(pg_temp.events('saved'), 0, 'an unlike removes the like: the log never names one they took back');

select pg_temp.track('saved', now() - interval '30 minutes');
select is(pg_temp.events('saved'), 1, 'liking it again is a new like');

select pg_temp.share(now() - interval '20 minutes');
select pg_temp.share(now() - interval '19 minutes');
select is(pg_temp.events('shared'), 2, 'every share is a row');

-- MESITA-3422: the guest side reads every open too (four views, one like).
select is(
  (select count(*)::int from public.place_activity_feed(500, null, '00000000-0000-4000-8000-000000003219')),
  5,
  'the place''s Social feed shows each of the four opens and the like'
);
select is(
  (select count(*)::int from public.place_activity_history_by(
     '00000000-0000-4000-8000-000000003219', 'viewed', now() - interval '2 hours')),
  5,
  'the person card opened from the oldest view finds the guest and all their rows'
);
select is(
  (select views::int from public.place_view_counts(array['00000000-0000-4000-8000-000000003219'::uuid])),
  4,
  'Mesita Views counts every open'
);

-- MESITA-4326: a signed-out open is a view with no person.
insert into public.place_events (consumer_id, place_id, kind)
values (null, '00000000-0000-4000-8000-000000003219', 'viewed');
select is(
  (select views::int from public.place_view_counts(array['00000000-0000-4000-8000-000000003219'::uuid])),
  5,
  'a signed-out open counts in Mesita Views'
);
select is(
  (select count(*)::int from public.place_views_events('00000000-0000-4000-8000-000000003219') where consumer_id is null),
  1,
  'Business Views'' total and chart count the signed-out open'
);
-- MESITA-4678: the log lists it as "Anonymous user", never a customer.
select is(
  (select count(*)::int from public.place_views_log('00000000-0000-4000-8000-000000003219', null, 200)
    where consumer_id is null and customer is null and first_name is null and anonymous and not instagram),
  1,
  'the views log lists a signed-out open with no person and no customer key'
);
select is(
  (select count(*)::int from public.place_views_log('00000000-0000-4000-8000-000000003219', null, 200,
     public.place_customer_key('00000000-0000-4000-8000-000000003219', '00000000-0000-4000-8000-0000000a3219'))
    where consumer_id is null),
  0,
  'a customer filter never matches a signed-out open: it is never a customer'
);
select throws_ok(
  $$insert into public.place_events (consumer_id, place_id, kind)
    values (null, '00000000-0000-4000-8000-000000003219', 'saved')$$,
  '23514',
  null,
  'only a view may have no person: a like or share without one is refused'
);

-- MESITA-4659: Social shows a handle only when its guest opted in. The guest
-- links a verified Instagram; no choice is recorded yet.
update public.consumers
   set instagram_handle = 'probe.3219', instagram_verified_at = now()
 where id = '00000000-0000-4000-8000-0000000a3219';
select ok(
  (select bool_and(instagram_handle is null) and count(*) = 5
     from public.place_activity_feed(500, null, '00000000-0000-4000-8000-000000003219'))
    and (select bool_and(instagram_handle is null) and count(*) = 5
           from public.place_activity_history_by('00000000-0000-4000-8000-000000003219', 'viewed', now() - interval '2 hours'))
    and (select count(*) = 0
           from public.place_activity_people('00000000-0000-4000-8000-000000003219')),
  'no choice recorded: feed and person card hide the handle'
);

update public.consumers set instagram_handle_shown = true where id = '00000000-0000-4000-8000-0000000a3219';
select ok(
  (select bool_and(instagram_handle = 'probe.3219')
     from public.place_activity_feed(500, null, '00000000-0000-4000-8000-000000003219'))
    and (select bool_and(instagram_handle = 'probe.3219')
           from public.place_activity_history_by('00000000-0000-4000-8000-000000003219', 'viewed', now() - interval '2 hours'))
    and (select bool_and(instagram_handle = 'probe.3219')
           from public.place_activity_people('00000000-0000-4000-8000-000000003219')),
  'opted in: feed, person card and people line show the handle'
);

-- MESITA-4850: private and minors never appear, past events included; a Public
-- member carries no name and no photo.
update public.consumers set instagram_handle_shown = false where id = '00000000-0000-4000-8000-0000000a3219';
select ok(
  (select count(*) = 5 and bool_and(first_name is null and avatar_url is null and not instagram and birth_year = 1990)
     from public.place_activity_feed(500, null, '00000000-0000-4000-8000-000000003219')),
  'public: no name, no photo, no Instagram mark'
);
update public.consumers set social_private = true, instagram_handle_shown = true where id = '00000000-0000-4000-8000-0000000a3219';
select ok(
  (select count(*) = 0 from public.place_activity_feed(500, null, '00000000-0000-4000-8000-000000003219'))
    and (select count(*) = 0 from public.place_activity_history_by('00000000-0000-4000-8000-000000003219', 'viewed', now() - interval '2 hours'))
    and (select count(*) = 0 from public.place_activity_people('00000000-0000-4000-8000-000000003219')),
  'private: nothing in the feed, the person card or the people line'
);
update public.consumers
   set social_private = false, birth_year = extract(year from now() at time zone 'utc')::int - 18
 where id = '00000000-0000-4000-8000-0000000a3219';
select ok(
  (select count(*) = 0 from public.place_activity_feed(500, null, '00000000-0000-4000-8000-000000003219'))
    and (select public.consumer_social_level(c) = 'private' and public.place_shown_handle(c) is null
           from public.consumers c where id = '00000000-0000-4000-8000-0000000a3219'),
  'a possible minor is private whatever the row says'
);

select * from finish();
rollback;

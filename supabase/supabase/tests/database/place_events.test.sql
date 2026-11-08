-- MESITA-3219, MESITA-3392, MESITA-3422 — the history behind Business Views, and the
-- guest readers that count every open from it: what writes a row, and that a
-- like taken back is gone. Guests' names in the log are place_views_log.test.sql.

begin;

create extension if not exists pgtap with schema public;

select plan(13);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000a3219');
insert into public.consumers (id, first_name) values ('00000000-0000-4000-8000-0000000a3219', 'Probe');
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

select * from finish();
rollback;

-- MESITA-3213 — Business Views names guests to a place's owner. It may name them
-- only as far as Social does, and only to the server. MESITA-4659: the handle
-- only when the guest opted in (instagram_handle_shown = true).

begin;

create extension if not exists pgtap with schema public;

select plan(10);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a3213'),
  ('00000000-0000-4000-8000-0000000b3213'),
  ('00000000-0000-4000-8000-0000000c3213');
insert into public.consumers
  (id, first_name, avatar_url, instagram_handle, instagram_followers_count, instagram_verified_at, appear_anonymous, deleted_at, birth_year)
values
  ('00000000-0000-4000-8000-0000000a3213', 'Public', 'https://x.test/a.jpg', 'public_one', 1200, now(), false, null, 1990),
  ('00000000-0000-4000-8000-0000000b3213', 'Private', 'https://x.test/b.jpg', 'private_one', 900, now(), false, null, 1990),
  ('00000000-0000-4000-8000-0000000c3213', 'Closed', 'https://x.test/c.jpg', 'closed_one', 5, now(), false, now(), 1990);
insert into public.place_profiles (id, google_name)
values ('00000000-0000-4000-8000-000000003213', 'Views Probe');
insert into public.places (id, slug, state, content_state, currency)
values ('00000000-0000-4000-8000-000000003213', 'mesita-3213-probe', 'active', 'generating', 'MXN');

insert into public.place_activity (consumer_id, place_id, kind, created_at, quiet) values
  ('00000000-0000-4000-8000-0000000a3213', '00000000-0000-4000-8000-000000003213', 'viewed', now() - interval '1 minute', false),
  ('00000000-0000-4000-8000-0000000a3213', '00000000-0000-4000-8000-000000003213', 'saved', now() - interval '2 minutes', true),
  ('00000000-0000-4000-8000-0000000b3213', '00000000-0000-4000-8000-000000003213', 'saved', now() - interval '3 minutes', false),
  ('00000000-0000-4000-8000-0000000c3213', '00000000-0000-4000-8000-000000003213', 'viewed', now() - interval '4 minutes', false);
insert into public.place_shares (consumer_id, place_id, shared_at) values
  ('00000000-0000-4000-8000-0000000a3213', '00000000-0000-4000-8000-000000003213', now() - interval '5 minutes');

select ok(
  not has_function_privilege('authenticated', 'public.place_views_log(uuid, timestamptz, integer, text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.place_views_log(uuid, timestamptz, integer, text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.place_views_days(uuid, text, integer)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.place_views_events(uuid)', 'EXECUTE'),
  'a client cannot read the log: without this any guest could list who viewed a place'
);

select results_eq(
  $$ select kind from public.place_views_log('00000000-0000-4000-8000-000000003213') $$,
  array['viewed', 'saved', 'shared'],
  'newest first, across both tables; no closed account and no quiet save'
);

select ok(
  (select instagram_handle is null and instagram_followers_count = 1200 and not anonymous and instagram
     from public.place_views_log('00000000-0000-4000-8000-000000003213') where first_name = 'Public' and kind = 'viewed'),
  'no choice recorded: the handle is hidden, the guest is still named (MESITA-4659)'
);

update public.consumers set instagram_handle_shown = false where id = '00000000-0000-4000-8000-0000000a3213';
select is(
  (select instagram_handle from public.place_views_log('00000000-0000-4000-8000-000000003213') where first_name = 'Public' and kind = 'viewed'),
  null,
  'a guest who chose to hide their handle: hidden (MESITA-4659)'
);

update public.consumers set instagram_handle_shown = true, instagram_proved_at = now() where id = '00000000-0000-4000-8000-0000000a3213';
select is(
  (select instagram_handle from public.place_views_log('00000000-0000-4000-8000-000000003213') where first_name = 'Public' and kind = 'viewed'),
  'public_one',
  'a guest who opted in shows their handle (MESITA-4659)'
);

-- MESITA-4690: every profile is public. A signed-in guest without a verified
-- Instagram is still anonymous (no handle, no followers) but shows their
-- photo; the follow-up that drops appear_anonymous must keep this.
update public.consumers set instagram_handle = null, instagram_followers_count = null, instagram_verified_at = null
 where id = '00000000-0000-4000-8000-0000000b3213';
select ok(
  (select avatar_url = 'https://x.test/b.jpg' and instagram_handle is null and instagram_followers_count is null and anonymous
     from public.place_views_log('00000000-0000-4000-8000-000000003213') where first_name = 'Private'),
  'no verified Instagram: anonymous, no handle, the photo shows (MESITA-4690)'
);

select is(
  (select count(*)::int from public.place_views_log('00000000-0000-4000-8000-000000003213', now() - interval '4 minutes')),
  1,
  'p_before pages past what was already shown'
);

select is(
  (select count(*)::int from public.place_views_days('00000000-0000-4000-8000-000000003213', 'America/Mexico_City', 30)),
  30,
  'the chart gets every day, empty ones included'
);

select is(
  (select row(sum(views), sum(likes), sum(shares))::text from public.place_views_days('00000000-0000-4000-8000-000000003213', 'America/Mexico_City', 30)),
  '(1,1,1)',
  'the chart counts what the log lists'
);

select is(
  (select day from public.place_views_days('00000000-0000-4000-8000-000000003213', 'America/Mexico_City', 30) order by day desc limit 1),
  (now() at time zone 'America/Mexico_City')::date,
  'the last day is today where the place is'
);

select * from finish();
rollback;

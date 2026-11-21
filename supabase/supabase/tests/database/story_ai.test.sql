-- MESITA-4535 — the AI bot decides in SQL. A Meta mention arrives with no
-- restaurant (found, unattached); story_ai_verdict names the restaurant from
-- the model's answer and the same ticket attaches, on the clock from
-- publication. No tag → rejected; video → rejected; several places →
-- ambiguous; a second verdict does nothing; a forced re-check never moves an
-- attached ticket; claims spend tries and give them back; the desk sweep
-- never pays an unread story.

begin;

create extension if not exists pgtap with schema public;

select plan(20);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-00000000a535'), ('00000000-0000-4000-8000-00000000b535');
insert into public.consumers (id, instagram_handle, instagram_verified_at, instagram_followers_count, instagram_is_private) values
  ('00000000-0000-4000-8000-00000000a535', 'ai4535_a', now(), 1500, false),
  ('00000000-0000-4000-8000-00000000b535', 'ai4535_b', now(), 1500, false);
insert into public.place_profiles (id, google_name, instagram_url) values
  ('00000000-0000-4000-8000-000000014535', 'Taqueria Probe Cuatro', 'https://www.instagram.com/probe4535one/'),
  ('00000000-0000-4000-8000-000000024535', 'Cafe Probe Otro', 'https://instagram.com/probe4535two');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000014535', 'mesita-4535-one', 'active', 'generating', 'MXN'),
  ('00000000-0000-4000-8000-000000024535', 'mesita-4535-two', 'active', 'generating', 'MXN');
insert into public.place_payment_accounts (place_id, stripe_account_id, livemode, charges_enabled) values
  ('00000000-0000-4000-8000-000000014535', 'acct_test_4535a', false, true),
  ('00000000-0000-4000-8000-000000024535', 'acct_test_4535b', false, true);
-- The place guards (Stripe account, signed agreement) are not under test here.
set local session_replication_role = replica;
insert into public.place_payment_settings (place_id, voucher_story, loyalty_cards) values
  ('00000000-0000-4000-8000-000000014535', true, true),
  ('00000000-0000-4000-8000-000000024535', true, true)
on conflict (place_id) do update set voucher_story = true, loyalty_cards = true;
set local session_replication_role = origin;

create temp table vp (k text primary key, id uuid default gen_random_uuid(), guest uuid, place uuid);
insert into vp (k, guest, place) values
  ('a', '00000000-0000-4000-8000-00000000a535', '00000000-0000-4000-8000-000000014535'),
  ('b', '00000000-0000-4000-8000-00000000b535', '00000000-0000-4000-8000-000000014535');
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id, livemode)
select id, guest, place, 10000, 'mxn', 'open', 'acct_test_4535', 'voucher_story', 4000, 500, 'cs_test_4535' || k, false from vp;
select wallet_credit_purchase((select id from vp where k = 'a'), 'pi_4535a', null);
select wallet_credit_purchase((select id from vp where k = 'b'), 'pi_4535b', null);

create temp table mm (k text primary key, id uuid);
create function pg_temp.post(k text, handle text, kind text default 'image') returns uuid
 language sql as $$
  insert into mm
  select k, (wallet_record_story_mention(handle, 'meta', 'ai-4535-' || k, null, kind, now() - interval '5 minutes', false) ->> 'id')::uuid
  returning id;
$$;

select ok(
  not exists (
    select 1 from unnest(array[
      'public.story_ai_verdict(uuid, jsonb, text, boolean)', 'public.story_ai_claim(integer, integer)',
      'public.story_ai_unclaim(uuid[])', 'public.story_ai_fail(uuid, text, boolean)',
      'public.story_ai_desk_sweep(integer)', 'public.story_ai_candidates(uuid)'
    ]) f, unnest(array['anon', 'authenticated']) r
    where has_function_privilege(r, f, 'EXECUTE')),
  'the bot RPCs are service-role only'
);
select is(instagram_handle_of_url('https://www.instagram.com/Probe.One_/?hl=es'), 'probe.one_', 'the handle twin reads a URL like the TypeScript one');
select is(instagram_handle_of_url('https://example.com/x'), null, 'a URL that is not Instagram has no handle');

-- ━━━ The webhook sequence: found with no place, then the bot attaches ━━━━━━━━━

select pg_temp.post('a', 'ai4535_a');
select is(story_detect((select id from mm where k = 'a'), null) ->> 'outcome', 'unattached', 'the webhook makes a found ticket with no restaurant');
select is(
  (select array_agg(place_id) from story_ai_candidates((select id from mm where k = 'a'))),
  array['00000000-0000-4000-8000-000000014535'::uuid],
  'the narrow question asks about the place of the guest''s open voucher'
);
select is(
  story_ai_verdict((select id from mm where k = 'a'),
    jsonb_build_object('mode', 'narrow', 'looks_like_story', true,
      'candidates', jsonb_build_array(jsonb_build_object('place_id', '00000000-0000-4000-8000-000000014535', 'handle_visible', true, 'location_visible', false))),
    'test-model') ->> 'outcome',
  'matched',
  'the bot sees the restaurant tag'
);
select is(
  (select state from public.stories where mention_id = (select id from mm where k = 'a')),
  'approved',
  'the same ticket attaches to the voucher'
);
select ok(
  (select s.recheck_at = m.mentioned_at + interval '3 hours'
     from public.stories s join public.story_mentions m on m.id = s.mention_id
    where m.id = (select id from mm where k = 'a')),
  'the bonus clock runs from publication'
);
select is(
  story_ai_verdict((select id from mm where k = 'a'), '{"mode":"open","place_handles":[]}'::jsonb, 'test-model') ->> 'outcome',
  'already_checked',
  'a second verdict does nothing'
);
select is(
  story_ai_verdict((select id from mm where k = 'a'), '{"mode":"open","place_handles":[]}'::jsonb, 'test-model', true) ->> 'code',
  'locked',
  'a forced re-check never moves an attached ticket'
);

-- ━━━ No tag, video, not a story ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select pg_temp.post('b1', 'ai4535_b');
select story_detect((select id from mm where k = 'b1'), null);
select is(
  story_ai_verdict((select id from mm where k = 'b1'),
    '{"mode":"open","looks_like_story":true,"place_handles":["someoneelse"],"location_names":[]}'::jsonb, 'test-model') ->> 'reason',
  'no_tag',
  'no restaurant tag is rejected'
);
select is(
  (select purchase_id from public.stories where mention_id = (select id from mm where k = 'b1')),
  null,
  'a rejected story attaches to nothing'
);
select pg_temp.post('b2', 'ai4535_b', 'video');
select is(
  story_ai_verdict((select id from mm where k = 'b2'), '{"mode":"video"}'::jsonb, 'test-model') ->> 'reason',
  'video',
  'a video story is rejected with its own reason'
);
select pg_temp.post('b3', 'ai4535_b');
select is(
  story_ai_verdict((select id from mm where k = 'b3'), '{"mode":"open","looks_like_story":false,"place_handles":["probe4535one"]}'::jsonb, 'test-model') ->> 'reason',
  'not_a_story',
  'an image that is not a story is rejected'
);

-- ━━━ Open extraction: location sticker; several places ━━━━━━━━━━━━━━━━━━━━━━━

select pg_temp.post('b4', 'ai4535_b');
select story_detect((select id from mm where k = 'b4'), null);
select is(
  story_ai_verdict((select id from mm where k = 'b4'),
    '{"mode":"open","looks_like_story":true,"place_handles":[],"location_names":["Taquería Probe Cuatro · Roma Norte"]}'::jsonb, 'test-model') ->> 'outcome',
  'matched',
  'a location sticker naming the place counts as the restaurant tag'
);
select is(
  (select state from public.stories where mention_id = (select id from mm where k = 'b4')),
  'approved',
  'and the guest''s voucher there takes the story'
);
select pg_temp.post('b5', 'ai4535_b');
select is(
  story_ai_verdict((select id from mm where k = 'b5'),
    '{"mode":"open","looks_like_story":true,"place_handles":["probe4535one","probe4535two"]}'::jsonb, 'test-model') ->> 'outcome',
  'ambiguous',
  'two places and no open voucher to decide is ambiguous'
);

-- ━━━ Claims and the desk ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select pg_temp.post('c', 'ai4535_b');
create temp table claimed as select id from story_ai_claim(50, 3) where id = (select id from mm where k = 'c');
select is((select ai_tries from public.story_mentions where id = (select id from mm where k = 'c')), 1, 'a claim spends a try');
select story_ai_unclaim(array[(select id from mm where k = 'c')]);
select is((select ai_tries from public.story_mentions where id = (select id from mm where k = 'c')), 0, 'an unstarted claim gives its try back');

update public.story_mentions set ai_outcome = 'unreadable', ai_checked_at = now() - interval '3 days'
 where id = (select id from mm where k = 'c');
select story_ai_desk_sweep(48);
select is((select ai_outcome from public.story_mentions where id = (select id from mm where k = 'c')), 'rejected', 'an unread story at desk hours is rejected, never paid');

select * from finish();
rollback;

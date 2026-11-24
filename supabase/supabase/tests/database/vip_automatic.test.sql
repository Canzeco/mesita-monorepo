-- MESITA-3850, MESITA-4849 — VIP is by invitation code only: no Instagram
-- count, real or emulated, makes a VIP. No one can write the class, and the
-- manual doors are closed.

begin;

create extension if not exists pgtap with schema public;

select plan(15);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a3850'),
  ('00000000-0000-4000-8000-0000000b3850'),
  ('00000000-0000-4000-8000-0000000c3850'),
  ('00000000-0000-4000-8000-0000000d3850'),
  ('00000000-0000-4000-8000-0000000e3850'),
  ('00000000-0000-4000-8000-0000000f3850'),
  ('00000000-0000-4000-8000-000000103850'),
  ('00000000-0000-4000-8000-000000113850'),
  ('00000000-0000-4000-8000-000000124662');
insert into public.consumers (id, instagram_handle, instagram_verified_at, instagram_followers_count) values
  ('00000000-0000-4000-8000-0000000a3850', null, null, null),
  ('00000000-0000-4000-8000-0000000b3850', 'probe_3850_b', now(), 5000),
  ('00000000-0000-4000-8000-0000000c3850', 'probe_3850_c', now(), 5001),
  ('00000000-0000-4000-8000-0000000f3850', 'probe_3850_f', now(), 90000),
  ('00000000-0000-4000-8000-000000103850', 'probe_3850_g', now(), 90000);
insert into public.consumers (id, instagram_followers_count) values
  ('00000000-0000-4000-8000-0000000d3850', 90000);
insert into public.consumers (id, instagram_handle, instagram_verified_at, instagram_followers_count) values
  ('00000000-0000-4000-8000-000000113850', null, null, 6000);
insert into public.consumers (id, instagram_handle, instagram_verified_at, instagram_followers_count) values
  ('00000000-0000-4000-8000-0000000e3850', 'probe_3850_e', now(), 5001);

select is(
  (select attgenerated::text from pg_attribute
    where attrelid = 'public.consumers'::regclass and attname = 'guest_class'),
  's',
  'consumers.guest_class is a stored generated column'
);

select is(
  (select guest_class from public.consumers where id = '00000000-0000-4000-8000-0000000a3850'),
  'regular',
  'no Instagram is Regular'
);

select is(
  (select guest_class from public.consumers where id = '00000000-0000-4000-8000-0000000b3850'),
  'regular',
  'exactly 5,000 followers is Regular'
);

select is(
  (select guest_class from public.consumers where id = '00000000-0000-4000-8000-0000000c3850'),
  'regular',
  '5,001 followers on a verified Instagram is Regular (MESITA-4849)'
);

select is(
  (select guest_class from public.consumers where id = '00000000-0000-4000-8000-0000000d3850'),
  'regular',
  'a count without a verified Instagram is Regular'
);

select is(
  (select guest_class from public.consumers where id = '00000000-0000-4000-8000-000000113850'),
  'regular',
  '6,000 public followers without a verified Instagram is Regular'
);

select is(
  (select guest_class from public.consumers where id = '00000000-0000-4000-8000-0000000e3850'),
  'regular',
  'just over 5,000 verified followers is Regular (MESITA-4849)'
);

select is(
  (select guest_class from public.consumers where id = '00000000-0000-4000-8000-0000000f3850'),
  'regular',
  '90,000 followers on a private Instagram is Regular (MESITA-4849)'
);

select is(
  (select guest_class from public.consumers where id = '00000000-0000-4000-8000-000000103850'),
  'regular',
  '90,000 followers, privacy not known, is Regular (MESITA-4849)'
);

update public.consumers set instagram_followers_count = 4000
 where id = '00000000-0000-4000-8000-0000000c3850';
select is(
  (select guest_class from public.consumers where id = '00000000-0000-4000-8000-0000000c3850'),
  'regular',
  'a follower sync never changes the class'
);

update public.consumers set instagram_followers_count = 7000
 where id = '00000000-0000-4000-8000-0000000c3850';
update public.consumers
   set instagram_handle = null, instagram_verified_at = null, instagram_followers_count = null
 where id = '00000000-0000-4000-8000-0000000c3850';
select is(
  (select guest_class from public.consumers where id = '00000000-0000-4000-8000-0000000c3850'),
  'regular',
  'disconnecting Instagram leaves the class Regular'
);

-- The follower emulator (MESITA-4662) makes no VIP either.
insert into public.consumers (id, instagram_handle, instagram_verified_at, instagram_followers_count, instagram_followers_emulated) values
  ('00000000-0000-4000-8000-000000124662', 'probe_4662', now(), 300, 5001);
select is(
  (select guest_class from public.consumers where id = '00000000-0000-4000-8000-000000124662'),
  'regular',
  'an emulated 5,001 on a verified Instagram with 300 real followers is Regular (MESITA-4849)'
);

select throws_ok(
  $$update public.consumers set guest_class = 'vip' where id = '00000000-0000-4000-8000-0000000a3850'$$,
  '428C9',
  null,
  'nothing can write the class'
);

select ok(
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'consumer_redeem_vip_invitation')
    and not has_function_privilege('authenticated', 'public.consumer_redeem_vip_invitation(uuid, text, boolean)', 'EXECUTE'),
  'an invitation code makes a VIP again (MESITA-4766), through the server only'
);

-- The code tables stay as records (MESITA-3540), still EF-only.
select ok(
  (select bool_and(relrowsecurity) from pg_class
    where oid in ('public.vip_invitation_codes'::regclass, 'public.vip_invitation_attempts'::regclass))
    and not exists (select 1 from pg_policies where schemaname = 'public'
                     and tablename in ('vip_invitation_codes', 'vip_invitation_attempts'))
    and not has_table_privilege('anon', 'public.vip_invitation_codes', 'SELECT')
    and not has_table_privilege('authenticated', 'public.vip_invitation_codes', 'SELECT')
    and not has_table_privilege('authenticated', 'public.vip_invitation_attempts', 'INSERT'),
  'code tables have RLS on, no policy and no client grant'
);

select * from finish();
rollback;

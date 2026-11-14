-- MESITA-3850 — VIP is automatic: a verified Instagram with more than 5,000
-- followers, and nothing else. The class follows the count both ways, no
-- one can write it, and the manual doors are closed.

begin;

create extension if not exists pgtap with schema public;

select plan(12);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a3850'),
  ('00000000-0000-4000-8000-0000000b3850'),
  ('00000000-0000-4000-8000-0000000c3850'),
  ('00000000-0000-4000-8000-0000000d3850');
insert into public.consumers (id, instagram_handle, instagram_verified_at, instagram_followers_count) values
  ('00000000-0000-4000-8000-0000000a3850', null, null, null),
  ('00000000-0000-4000-8000-0000000b3850', 'probe_3850_b', now(), 5000),
  ('00000000-0000-4000-8000-0000000c3850', 'probe_3850_c', now(), 5001);
insert into public.consumers (id, instagram_followers_count) values
  ('00000000-0000-4000-8000-0000000d3850', 90000);

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
  'exactly 5,000 followers is Regular (more than 5,000 is the bar)'
);

select is(
  (select guest_class from public.consumers where id = '00000000-0000-4000-8000-0000000c3850'),
  'vip',
  '5,001 followers on a verified Instagram is VIP'
);

select is(
  (select guest_class from public.consumers where id = '00000000-0000-4000-8000-0000000d3850'),
  'regular',
  'a count without a verified Instagram is Regular'
);

update public.consumers set instagram_followers_count = 4000
 where id = '00000000-0000-4000-8000-0000000c3850';
select is(
  (select guest_class from public.consumers where id = '00000000-0000-4000-8000-0000000c3850'),
  'regular',
  'a sync below the bar makes a VIP Regular again'
);

update public.consumers set instagram_followers_count = 7000
 where id = '00000000-0000-4000-8000-0000000c3850';
update public.consumers
   set instagram_handle = null, instagram_verified_at = null, instagram_followers_count = null
 where id = '00000000-0000-4000-8000-0000000c3850';
select is(
  (select guest_class from public.consumers where id = '00000000-0000-4000-8000-0000000c3850'),
  'regular',
  'disconnecting Instagram makes a VIP Regular again'
);

select throws_ok(
  $$update public.consumers set guest_class = 'vip' where id = '00000000-0000-4000-8000-0000000a3850'$$,
  '428C9',
  null,
  'nothing can write the class'
);

select throws_ok(
  $$select * from public.admin_set_guest_standing('00000000-0000-4000-8000-0000000a3850', 'vip', null, null, false, null, false, null, false, null)$$,
  '22023',
  null,
  'the standing RPC refuses a class'
);

select is(
  (select plan from public.admin_set_guest_standing('00000000-0000-4000-8000-0000000a3850', null, 'premium', null, false, null, false, null, false, null)),
  'premium',
  'the standing RPC still sets the Plan'
);

select ok(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'consumer_redeem_vip_invitation'),
  'no invitation code makes a VIP any more'
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

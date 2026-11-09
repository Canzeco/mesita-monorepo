-- MESITA-3540 — VIP invitation codes: EF-only tables, one use, the class
-- changes with the code in one transaction, ten wrong codes an hour.

begin;

create extension if not exists pgtap with schema public;

select plan(10);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a3540'),
  ('00000000-0000-4000-8000-0000000b3540'),
  ('00000000-0000-4000-8000-0000000c3540');
insert into public.consumers (id, guest_class_note) values
  ('00000000-0000-4000-8000-0000000a3540', 'Met at the bar'),
  ('00000000-0000-4000-8000-0000000b3540', null),
  ('00000000-0000-4000-8000-0000000c3540', null);
insert into public.vip_partners (id, name)
values ('00000000-0000-4000-8000-0000000d3540', 'Probe Agency 3540');
insert into public.vip_invitation_codes (code_hash, code_last4, label, vip_partner_id) values
  (encode(sha256(convert_to('111122223333', 'UTF8')), 'hex'), '3333', 'Ana', '00000000-0000-4000-8000-0000000d3540'),
  (encode(sha256(convert_to('444455556666', 'UTF8')), 'hex'), '6666', null, null);
update public.vip_invitation_codes set revoked_at = now() where code_last4 = '6666';

-- ━━━ EF-only ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

select ok(
  not has_function_privilege('authenticated', 'public.consumer_redeem_vip_invitation(uuid, text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.consumer_redeem_vip_invitation(uuid, text)', 'EXECUTE'),
  'the redeem is service-role only'
);

-- ━━━ Twelve zeros is not a code ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  public.consumer_redeem_vip_invitation('00000000-0000-4000-8000-0000000b3540', '000000000000'),
  'invalid',
  'the old emulator code no longer joins'
);

-- ━━━ One use, and the class changes with it ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  public.consumer_redeem_vip_invitation('00000000-0000-4000-8000-0000000a3540', '111122223333'),
  'joined',
  'an issued code joins'
);

select results_eq(
  $$ select guest_class::text, guest_class_note, vip_partner_id from public.consumers
      where id = '00000000-0000-4000-8000-0000000a3540' $$,
  $$ values ('vip'::text, '[code] Joined with code …3333 · Ana · Met at the bar'::text,
             '00000000-0000-4000-8000-0000000d3540'::uuid) $$,
  'the guest is VIP through the code''s partner, the note in front of the operator''s'
);

select is(
  (select used_by from public.vip_invitation_codes where code_last4 = '3333'),
  '00000000-0000-4000-8000-0000000a3540'::uuid,
  'the code records who used it'
);

select is(
  public.consumer_redeem_vip_invitation('00000000-0000-4000-8000-0000000b3540', '111122223333'),
  'invalid',
  'a used code does not join a second guest'
);

select is(
  public.consumer_redeem_vip_invitation('00000000-0000-4000-8000-0000000b3540', '444455556666'),
  'invalid',
  'a revoked code does not join'
);

-- ━━━ Ten wrong codes an hour ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into public.vip_invitation_codes (code_hash, code_last4)
values (encode(sha256(convert_to('777788889999', 'UTF8')), 'hex'), '9999');
select public.consumer_redeem_vip_invitation('00000000-0000-4000-8000-0000000c3540', lpad(n::text, 12, '1'))
  from generate_series(1, 10) n;

select is(
  public.consumer_redeem_vip_invitation('00000000-0000-4000-8000-0000000c3540', '777788889999'),
  'rate_limited',
  'after ten wrong codes in an hour even a good code is refused'
);

select is(
  (select guest_class::text from public.consumers where id = '00000000-0000-4000-8000-0000000c3540'),
  'regular',
  'the refused guest stays Regular and the code stays unused'
);

select * from finish();
rollback;

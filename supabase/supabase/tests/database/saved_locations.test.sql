-- MESITA-2400 — saved locations are a guest's own rows, reachable only
-- through the consumer-web EFs, and the 30-day expiry of Google's names
-- never touches what the guest typed.

begin;

create extension if not exists pgtap with schema public;

select plan(6);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a2400'),
  ('00000000-0000-4000-8000-0000000b2400');
insert into public.consumers (id) values
  ('00000000-0000-4000-8000-0000000a2400'),
  ('00000000-0000-4000-8000-0000000b2400');

insert into public.saved_locations
  (consumer_id, id, lat, lng, suggested_name, custom_name, formatted_address, name_edited, named_at)
values
  ('00000000-0000-4000-8000-0000000a2400', 'home', 25.65, -100.36,
   'Del Valle', 'Casa', 'Av. Vasconcelos 100', false, now() - interval '31 days'),
  ('00000000-0000-4000-8000-0000000a2400', 'edited', 25.66, -100.37,
   'Mi oficina', null, 'Calz. del Valle 200', true, now() - interval '31 days'),
  ('00000000-0000-4000-8000-0000000b2400', 'fresh', 25.67, -100.38,
   'Centro', null, 'Zaragoza 1', false, now() - interval '2 days');

-- ━━━ Nobody reads a guest's pins but the EFs ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  (select relrowsecurity from pg_class where oid = 'public.saved_locations'::regclass)
    and not exists (select 1 from pg_policies
                     where schemaname = 'public' and tablename = 'saved_locations'),
  'saved_locations has RLS on and no policy: the EF-only lockdown (MESITA-2400)'
);

select ok(
  not has_table_privilege('anon', 'public.saved_locations', 'SELECT')
    and not has_table_privilege('authenticated', 'public.saved_locations', 'SELECT')
    and not has_table_privilege('authenticated', 'public.saved_locations', 'INSERT')
    and not has_table_privilege('authenticated', 'public.saved_locations', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.saved_locations', 'DELETE'),
  'client roles hold nothing on saved_locations: a guest cannot read or write another guest''s pins'
);

-- A signed-in guest B, straight at the table with their own JWT: run the
-- read, not just the privilege bit (the probe pattern of schema_invariants).
create or replace function pg_temp.guest_b_runs(stmt text)
returns text language plpgsql as $probe$
declare verdict text;
begin
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"00000000-0000-4000-8000-0000000b2400","role":"authenticated"}', true);
    set local role authenticated;
    execute stmt;
    reset role;
    verdict := 'OK';
  exception when others then
    reset role;
    verdict := sqlstate;
  end;
  return verdict;
end $probe$;

select is(
  pg_temp.guest_b_runs($$select * from public.saved_locations
                          where consumer_id = '00000000-0000-4000-8000-0000000a2400'$$),
  '42501',
  'a signed-in guest querying the table directly is refused, so guest A''s pins never reach guest B'
);

select is(
  pg_temp.guest_b_runs($$select public.expire_saved_location_names()$$),
  '42501',
  'client roles cannot run the expiry job'
);

-- ━━━ Google's names expire; the guest's own never do ━━━━━━━━━━━━━━━━━━━━━━━

select is(
  public.expire_saved_location_names(),
  2,
  'the expiry clears exactly the rows named more than 30 days ago'
);

select ok(
  (select custom_name = 'Casa' and suggested_name is null and formatted_address is null
          and needs_name and named_at is null
     from public.saved_locations where id = 'home')
    and (select suggested_name = 'Mi oficina' and formatted_address is null and needs_name
           from public.saved_locations where id = 'edited')
    and (select suggested_name = 'Centro' and formatted_address = 'Zaragoza 1' and not needs_name
           from public.saved_locations where id = 'fresh'),
  'the expiry keeps custom_name and an edited name, and leaves a fresh row alone'
);

select * from finish();

rollback;

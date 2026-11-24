-- MESITA-4904 — a place starts with one code named Staff (Pato, 2026-11-24:
-- "Yes, one Staff code"); named waiters are optional. Made once, when the place
-- gets an owner: a place that ever had a waiter, kept or removed, gets none.
-- Payments still need their own switches. Rollback: drop the trigger.
create function public.place_staff_code_start(p_place_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform pg_advisory_xact_lock(hashtextextended('staff-code:' || p_place_id::text, 0));
  if exists (select 1 from public.place_waiters where place_id = p_place_id and not no_code) then return; end if;
  insert into public.place_waiters (place_id, name, code, lookup_hash)
  values (p_place_id, 'Staff',
    lpad((('x' || substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 7))::bit(28)::integer % 1000000)::text, 6, '0'),
    encode(extensions.gen_random_bytes(32), 'hex'));
end;
$function$;
revoke all on function public.place_staff_code_start(uuid) from public, anon, authenticated;
grant execute on function public.place_staff_code_start(uuid) to service_role;

create function public.place_owner_staff_code()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.role = 'owner' and new.revoked_at is null then
    perform public.place_staff_code_start(new.place_id);
  end if;
  return new;
end;
$function$;
revoke all on function public.place_owner_staff_code() from public, anon, authenticated;
create trigger place_owner_staff_code after insert or update of role, revoked_at on public.place_managers
  for each row execute function public.place_owner_staff_code();

select public.place_staff_code_start(place_id)
  from (select distinct place_id from public.place_managers where role = 'owner' and revoked_at is null) o;

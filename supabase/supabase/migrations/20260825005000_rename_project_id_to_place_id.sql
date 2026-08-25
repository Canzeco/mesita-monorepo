-- Honest FK: remaining child tables store the place UUID as place_id.
-- Table names (project_members, visit_tickets, …) stay. is_project_member
-- keeps its name and p_project_id argument so RPC JSON does not move.
-- ALTER RENAME does not rewrite PL/pgSQL bodies (MESITA-1143) — rebuild
-- every public function that mentioned the column, same wave.

do $$
declare
  r record;
begin
  for r in
    select c.relname
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and a.attname = 'project_id'
       and a.attnum > 0
       and not a.attisdropped
       and c.relkind in ('r', 'p')
     order by c.relname
  loop
    execute format(
      'alter table public.%I rename column project_id to place_id',
      r.relname
    );
  end loop;
end $$;

create or replace function public.is_project_member(p_project_id uuid)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.project_members m
    where m.place_id = p_project_id
      and m.manager_id = (select auth.uid())
  );
$function$;

create or replace function public.refresh_place_mesita_reviews(p_project_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  update public.places p
  set mesita_review_count   = agg.n,
      mesita_stars_overall  = round(agg.overall::numeric, 1),
      mesita_stars_food     = round(agg.food::numeric, 1),
      mesita_stars_service  = round(agg.service::numeric, 1),
      mesita_stars_ambience = round(agg.ambience::numeric, 1),
      mesita_stars_value    = agg.value
  from (
    select
      count(*)        as n,
      avg(r.overall)  as overall,
      avg(r.food)     as food,
      avg(r.service)  as service,
      avg(r.ambience) as ambience,
      avg(r.value)    as value
    from public.ticket_reviews r
    where r.place_id = p_project_id
  ) agg
  where p.id = p_project_id;
end;
$function$;

create or replace function public.bump_reservation_call_counter(pid uuid)
 returns integer
 language sql
 security definer
 set search_path to 'public'
as $function$
  insert into reservation_call_counters (place_id, day, calls)
  values (pid, current_date, 1)
  on conflict (place_id, day)
  do update set calls = reservation_call_counters.calls + 1
  returning calls;
$function$;

create or replace function public.tg_ticket_reviews_refresh_place()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if tg_op = 'update' and new.place_id is distinct from old.place_id then
    perform public.refresh_place_mesita_reviews(old.place_id);
    perform public.refresh_place_mesita_reviews(new.place_id);
  else
    perform public.refresh_place_mesita_reviews(
      coalesce(new.place_id, old.place_id)
    );
  end if;
  return null;
end;
$function$;

-- Constraint / index names still say project_id after the column rename.
do $$
declare
  r record;
  new_name text;
begin
  for r in
    select c.relname as tbl, con.conname
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and con.conname like '%project_id%'
  loop
    new_name := replace(r.conname, 'project_id', 'place_id');
    if new_name <> r.conname then
      execute format(
        'alter table public.%I rename constraint %I to %I',
        r.tbl, r.conname, new_name
      );
    end if;
  end loop;

  for r in
    select i.relname as idx
      from pg_class i
      join pg_namespace n on n.oid = i.relnamespace
     where n.nspname = 'public'
       and i.relkind = 'i'
       and (
         i.relname like '%project_id%'
         or i.relname like '%_project_idx'
         or i.relname like '%_project_created_idx'
       )
  loop
    new_name := replace(replace(replace(
      r.idx,
      'project_id', 'place_id'),
      '_project_idx', '_place_idx'),
      '_project_created_idx', '_place_created_idx');
    if new_name <> r.idx then
      execute format('alter index public.%I rename to %I', r.idx, new_name);
    end if;
  end loop;
end $$;

do $$
begin
  if exists (
    select 1
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and a.attname = 'project_id'
       and a.attnum > 0
       and not a.attisdropped
       and c.relkind in ('r', 'p')
  ) then
    raise exception 'a public table still has a project_id column';
  end if;
  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'is_project_member'
  ) then
    raise exception 'is_project_member disappeared';
  end if;
end $$;

notify pgrst, 'reload schema';

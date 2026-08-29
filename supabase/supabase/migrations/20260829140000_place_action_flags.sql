-- Description → Actions: persisted guest CTA gates (Intaker function 9).
-- orders_enabled: menu/catalog on file. reservations_enabled: LLM inference.
-- Visit stays computed at read time (`promoting`).

alter table public.places
  add column if not exists orders_enabled boolean not null default false,
  add column if not exists reservations_enabled boolean not null default false;

comment on column public.places.orders_enabled is
  'Description/Actions — unlock guest Order when the place has a menu or product catalog.';

comment on column public.places.reservations_enabled is
  'Description/Actions — LLM inference: this kind of place likely accepts reservations.';

do $$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_viewdef('public.profiles'::regclass, true);

  if v_def like '%orders_enabled%' then
    raise notice 'profiles already projects action flags — nothing to do';
  else
    if v_def not like '%p.family_keys%' then
      raise exception 'profiles does not project family_keys; refusing to guess anchor';
    end if;

    v_new := replace(
      v_def,
      'p.family_keys
   FROM projects u',
      'p.family_keys,
    p.orders_enabled,
    p.reservations_enabled
   FROM projects u'
    );

    if v_new = v_def then
      v_new := replace(
        v_def,
        'p.family_keys
   from projects u',
        'p.family_keys,
    p.orders_enabled,
    p.reservations_enabled
   from projects u'
      );
    end if;

    if v_new = v_def then
      raise exception 'could not append action flags after family_keys';
    end if;

    execute 'create or replace view public.profiles with (security_invoker = true) as '
      || rtrim(btrim(v_new), ';');
  end if;
end
$$;

notify pgrst, 'reload schema';

-- MESITA-2767: `name.fast.supers` and `name.deep.supers`, the Search bar's
-- family switches, gated nothing (`anySuperOn` returned true whatever they
-- said), so an off switch told the operator a family was out of the bar when
-- it was not. Both normalizers stop reading and writing them. Strip only these
-- two keys; every other `name` knob keeps its stored value.
-- Idempotent: `#-` on a missing path is a no-op.

update public.app_config
   set discovery_config = discovery_config #- '{name,fast,supers}' #- '{name,deep,supers}'
 where id = 1;

do $$
begin
  if exists (
    select 1 from public.app_config
     where id = 1
       and (discovery_config #> '{name,fast,supers}' is not null
            or discovery_config #> '{name,deep,supers}' is not null)
  ) then
    raise exception 'MESITA-2767: a name.*.supers switch set survived the strip';
  end if;
end $$;

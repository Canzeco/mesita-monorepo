-- MESITA-942: public-readable tables keep SELECT for anon/authenticated
-- (RLS policies are SELECT-only). Revoke DML/TRUNCATE/TRIGGER/REFERENCES
-- so PostgREST cannot confuse clients with write ACL noise.

revoke insert, update, delete, truncate, trigger, references
  on table
    public.classes,
    public.consumers,
    public.place_categories,
    public.place_tags,
    public.places,
    public.projects
  from anon, authenticated;

grant select on table
  public.classes,
  public.consumers,
  public.place_categories,
  public.place_tags,
  public.places,
  public.projects
to anon, authenticated;

grant all on table
  public.classes,
  public.consumers,
  public.place_categories,
  public.place_tags,
  public.places,
  public.projects
to service_role;

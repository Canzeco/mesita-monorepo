-- Ghost trigger names from units / app_settings / reservations / tickets.
-- HNSW on places.embedding (same opclass as places_name_embedding_hnsw).
-- Atlas media caps: 8 MB + mime allowlists on menu-images, place-images,
-- menu-pdfs. ticket-proofs stays public (MESITA-1030).

do $$
begin
  if exists (
    select 1 from pg_trigger
     where tgrelid = 'public.projects'::regclass
       and tgname = 'units_set_updated_at'
  ) then
    alter trigger units_set_updated_at on public.projects
      rename to projects_set_updated_at;
  end if;

  if exists (
    select 1 from pg_trigger
     where tgrelid = 'public.app_config'::regclass
       and tgname = 'app_settings_set_updated_at'
  ) then
    alter trigger app_settings_set_updated_at on public.app_config
      rename to app_config_set_updated_at;
  end if;

  if exists (
    select 1 from pg_trigger
     where tgrelid = 'public.reservation_tickets'::regclass
       and tgname = 'reservations_set_updated_at'
  ) then
    alter trigger reservations_set_updated_at on public.reservation_tickets
      rename to reservation_tickets_set_updated_at;
  end if;

  if exists (
    select 1 from pg_trigger
     where tgrelid = 'public.visit_tickets'::regclass
       and tgname = 'tickets_set_updated_at'
  ) then
    alter trigger tickets_set_updated_at on public.visit_tickets
      rename to visit_tickets_set_updated_at;
  end if;
end $$;

create index if not exists places_embedding_hnsw
  on public.places
  using hnsw (embedding vector_cosine_ops);

comment on index public.places_embedding_hnsw is
  'Cosine HNSW on places.embedding (Semantic Summary). Mirrors places_name_embedding_hnsw.';

update storage.buckets
   set file_size_limit = 8388608,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id in ('menu-images', 'place-images');

update storage.buckets
   set file_size_limit = 8388608,
       allowed_mime_types = array['application/pdf']
 where id = 'menu-pdfs';

do $$
begin
  if exists (
    select 1 from pg_trigger
     where tgrelid = 'public.projects'::regclass
       and not tgisinternal
       and tgname = 'units_set_updated_at'
  ) then
    raise exception 'units_set_updated_at still bound to projects';
  end if;
  if not exists (
    select 1 from pg_class
     where relname = 'places_embedding_hnsw' and relkind = 'i'
  ) then
    raise exception 'places_embedding_hnsw missing';
  end if;
  if exists (
    select 1 from storage.buckets
     where id in ('menu-images', 'place-images', 'menu-pdfs')
       and (file_size_limit is distinct from 8388608
            or allowed_mime_types is null)
  ) then
    raise exception 'Atlas media bucket missing 8 MB mime cap';
  end if;
end $$;

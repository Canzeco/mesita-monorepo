-- Six foreign keys whose NAME describes a different table than the one they
-- point at. These are correctness bugs, not style: they only survive today
-- because places.id == projects.id, so the wrong join accidentally works.

-- 1-3. Three place_* tables share the column name `project_id`. Two point at
-- places, one points at projects. All three are enricher output, which is
-- place data, so all three become place_id -> places.
alter table public.place_enrichment_events rename column project_id to place_id;
alter table public.place_research          rename column project_id to place_id;

alter table public.place_media_assets
  drop constraint place_media_assets_project_id_fkey;
alter table public.place_media_assets rename column project_id to place_id;
alter table public.place_media_assets
  add constraint place_media_assets_place_id_fkey
  foreign key (place_id) references public.places(id) on delete cascade;

-- 4-5. Nine tables carry consumer_id. Seven resolve to `consumers`; these two
-- resolved to auth.users, so any helper that resolves a consumer generically
-- broke on exactly these.
alter table public.consumer_mcp_tokens
  drop constraint consumer_mcp_tokens_consumer_id_fkey;
alter table public.consumer_mcp_tokens
  add constraint consumer_mcp_tokens_consumer_id_fkey
  foreign key (consumer_id) references public.consumers(id) on delete cascade;

alter table public.place_creation_attempts
  drop constraint place_creation_attempts_consumer_id_fkey;
alter table public.place_creation_attempts
  add constraint place_creation_attempts_consumer_id_fkey
  foreign key (consumer_id) references public.consumers(id) on delete cascade;

-- 6. Said business, pointed at accounts, held a person. There is no business
-- entity anywhere in this schema.
alter table public.project_members rename column business_id to manager_id;

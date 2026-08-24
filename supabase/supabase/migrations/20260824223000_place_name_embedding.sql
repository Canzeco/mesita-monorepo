-- MESITA-1238 — the Mesita Name is its own vector, separate from the
-- Semantic Summary. Discovery §C: a name match and a vibe match are
-- different questions; one vector cannot answer both.
--
--   places.name_embedding        vector(1536)  — embed of the resolved name
--   places.name_embedding_hash   text          — SHA-1 of that name
--
-- The source IS places.name (generated coalesce(mesita_name, google_name)).
-- No second blurb. View + INSTEAD OF bodies are patched from the LIVE
-- definitions (Development Rules §B) so a restated snapshot cannot revert
-- concurrent columns.

alter table public.places
  add column if not exists name_embedding vector(1536),
  add column if not exists name_embedding_hash text;

create index if not exists places_name_embedding_hnsw
  on public.places
  using hnsw (name_embedding vector_cosine_ops);

comment on column public.places.name_embedding is
  'MESITA-1238: 1536-d embedding of the resolved display name (places.name). Entity resolution only — never the Semantic Summary.';
comment on column public.places.name_embedding_hash is
  'SHA-1 (first 32 hex) of the resolved display name that produced name_embedding.';

-- ── profiles view: append the pair (CREATE OR REPLACE keeps grants/triggers) ──
do $$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_viewdef('public.profiles'::regclass, true);

  if v_def like '%name_embedding%' then
    raise notice 'profiles already projects name_embedding — nothing to do';
  else
    -- Prefer appending after the last known Operating column. Fall back to
    -- embedding_source_text so a view that never grew the Operating pair
    -- still gets the name vector.
    v_new := replace(
      v_def,
      'p.business_status_at
   FROM projects u',
      'p.business_status_at,
    p.name_embedding,
    p.name_embedding_hash
   FROM projects u'
    );
    if v_new = v_def then
      v_new := replace(
        v_def,
        'p.embedding_source_text,
',
        'p.embedding_source_text,
    p.name_embedding,
    p.name_embedding_hash,
'
      );
    end if;
    if v_new = v_def then
      raise exception
        'could not append name_embedding to profiles: no known anchor';
    end if;

    execute 'create or replace view public.profiles with (security_invoker = true) as '
      || rtrim(btrim(v_new), ';');
  end if;
end
$$;

comment on view public.profiles is
  'SECURITY INVOKER join of projects ⋈ places. Public reads follow projects_select_public_visible; service-role EFs bypass RLS. INVARIANT: any create-or-replace MUST keep with (security_invoker = true).';

-- ── INSTEAD OF bodies: copy the pair through so a profiles write cannot
--    drop a just-written name vector (the assignment list is exhaustive). ──
do $$
declare
  v_src text;
  v_new text;
begin
  v_src := pg_get_functiondef('public.profiles_insert'::regproc);

  if v_src like '%name_embedding%' then
    raise notice 'profiles_insert already writes name_embedding — nothing to do';
  else
    v_new := replace(
      v_src,
      'business_status, business_status_at
  ) values (',
      'business_status, business_status_at,
    name_embedding, name_embedding_hash
  ) values ('
    );
    if v_new = v_src then
      v_new := replace(
        v_src,
        'embedding, embedding_source_hash, embedding_source_text,',
        'embedding, embedding_source_hash, embedding_source_text, name_embedding, name_embedding_hash,'
      );
    end if;
    if v_new = v_src then
      raise exception 'profiles_insert: column-list anchor not found';
    end if;

    v_src := v_new;
    v_new := replace(
      v_src,
      'new.business_status, new.business_status_at
  ) returning id into v_id;',
      'new.business_status, new.business_status_at,
    new.name_embedding, new.name_embedding_hash
  ) returning id into v_id;'
    );
    if v_new = v_src then
      v_new := replace(
        v_src,
        'new.embedding, new.embedding_source_hash, new.embedding_source_text,',
        'new.embedding, new.embedding_source_hash, new.embedding_source_text, new.name_embedding, new.name_embedding_hash,'
      );
    end if;
    if v_new = v_src then
      raise exception 'profiles_insert: values-list anchor not found';
    end if;

    execute v_new;
  end if;

  v_src := pg_get_functiondef('public.profiles_update'::regproc);

  if v_src like '%name_embedding%' then
    raise notice 'profiles_update already writes name_embedding — nothing to do';
  else
    v_new := replace(
      v_src,
      '    embedding_source_text = new.embedding_source_text,
',
      '    embedding_source_text = new.embedding_source_text,
    name_embedding = new.name_embedding,
    name_embedding_hash = new.name_embedding_hash,
'
    );
    if v_new = v_src then
      raise exception 'profiles_update: embedding_source_text assignment anchor not found';
    end if;

    execute v_new;
  end if;
end
$$;

do $$
declare
  v_opts text[];
  v_cols int;
begin
  select c.reloptions into v_opts
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'profiles';

  if v_opts is null or not ('security_invoker=true' = any (v_opts)) then
    raise exception 'profiles lost security_invoker=true';
  end if;

  select count(*) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'places'
    and column_name in ('name_embedding', 'name_embedding_hash');
  if v_cols <> 2 then
    raise exception 'places is missing the name-embedding pair';
  end if;

  select count(*) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles'
    and column_name in ('name_embedding', 'name_embedding_hash');
  if v_cols <> 2 then
    raise exception 'profiles projects % of the 2 name-embedding columns', v_cols;
  end if;

  if (select count(*) from pg_trigger t
      where t.tgrelid = 'public.profiles'::regclass and not t.tgisinternal) <> 2 then
    raise exception 'profiles lost an INSTEAD OF trigger';
  end if;

  if pg_get_functiondef('public.profiles_insert'::regproc) not like '%name_embedding%'
     or pg_get_functiondef('public.profiles_update'::regproc) not like '%name_embedding = new.name_embedding%'
  then
    raise exception 'an INSTEAD OF body still drops the name-embedding pair';
  end if;

  if has_table_privilege('anon', 'public.profiles', 'select') is not true
     or has_table_privilege('authenticated', 'public.profiles', 'select') is not true
     or has_table_privilege('service_role', 'public.profiles', 'insert') is not true
  then
    raise exception 'profiles lost a grant';
  end if;
end
$$;

notify pgrst, 'reload schema';

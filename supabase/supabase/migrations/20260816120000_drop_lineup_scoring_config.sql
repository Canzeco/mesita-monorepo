-- MESITA-1048 — delete the Lineup recommendation engine.
--
-- The scoring engine is gone from the code: the subscore/lane modules, both
-- admin config EFs (get/update lineup-config and their scoring-config compat
-- aliases), the map recommender, and every ranker under _shared/. The consumer
-- swipe deck is now a flat random query over active places, pending a rebuilt
-- engine. Nothing reads app_settings.scoring_config anymore, so the column goes
-- with the engine that owned it. This is a one-way drop: the blob was pure
-- tuning state (weights, lane sizes, rung tables), not product data, and it is
-- fully documented in Notion.
--
-- DELIBERATELY NOT TOUCHED — public.places.manual_priority.
-- The MP subscore that read it is deleted and no code references the column
-- anymore, but the column itself STAYS. Dropping it would force a rebuild of
-- public.projects_view plus both of its INSTEAD OF triggers, and a rebuilt
-- view that omits `with (security_invoker = true)` silently reopens the
-- anon-browse RLS leak — exactly the regression MESITA-599 had to fix once
-- already. One unused numeric column is not worth that blast radius. A
-- follow-up issue covers removing it properly.
--
-- Also NOT touched: the place embedding columns. They are paid OpenAI vectors
-- (data, not algorithm), still read by Memo's RAG recall, and wanted for the
-- rebuilt engine.

-- 1. The Lineup tuning blob.
comment on column public.app_settings.scoring_config is null;
alter table public.app_settings alter column scoring_config drop default;
alter table public.app_settings drop column scoring_config;

-- 2. The HNSW vector index on places.embedding.
-- It was created for an in-database `<=>` nearest-neighbour search that never
-- shipped: every cosine rank in this repo happens in TypeScript
-- (_shared/embeddings-vector.ts) over rows already pulled into the Edge
-- Function, and there is no `<=>` operator or vector_cosine_ops reference
-- anywhere in supabase/functions. It has only ever cost write amplification.
-- The `embedding` COLUMN stays; only the unused index goes.
drop index if exists public.places_embedding_hnsw;

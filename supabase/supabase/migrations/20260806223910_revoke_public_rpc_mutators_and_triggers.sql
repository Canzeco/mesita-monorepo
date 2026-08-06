-- MESITA-941: revoke PostgREST EXECUTE on mutators + trigger-only helpers.
--
-- Clients never call the DB (Product Rules). These functions still had default
-- PUBLIC/anon/authenticated EXECUTE from create-time grants:
--   generate_consumer_code  — mutates consumer_code_counter (EF-only)
--   seed_place_*            — upserts Atlas vocabulary (operator/EF-only)
--   set_updated_at          — BEFORE UPDATE trigger helper (not an RPC)
--   sync_place_category_label — category label sync trigger (not an RPC)
--
-- Triggers keep firing (table owner / postgres retains EXECUTE). service_role
-- keeps EXECUTE on the mutators for rare backfill / admin scripts.

revoke execute on function public.generate_consumer_code()
  from public, anon, authenticated;
grant execute on function public.generate_consumer_code() to service_role;

revoke execute on function public.seed_place_categories()
  from public, anon, authenticated;
grant execute on function public.seed_place_categories() to service_role;

revoke execute on function public.seed_place_tags()
  from public, anon, authenticated;
grant execute on function public.seed_place_tags() to service_role;

revoke execute on function public.set_updated_at()
  from public, anon, authenticated, service_role;

revoke execute on function public.sync_place_category_label()
  from public, anon, authenticated, service_role;

comment on function public.generate_consumer_code() is
  'Allocates the next public.consumers.code. EF-only; EXECUTE granted to service_role (not anon/authenticated).';

comment on function public.seed_place_categories() is
  'Upserts Atlas place_categories vocabulary. Operator/EF-only; EXECUTE service_role.';

comment on function public.seed_place_tags() is
  'Upserts Atlas place_tags vocabulary. Operator/EF-only; EXECUTE service_role.';

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger helper that stamps updated_at = now(). Not a PostgREST RPC.';

comment on function public.sync_place_category_label() is
  'Trigger helper syncing places.category_label from place_categories. Not a PostgREST RPC.';

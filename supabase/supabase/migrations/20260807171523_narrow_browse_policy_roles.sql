-- MESITA-943: narrow browse/vocabulary RLS policies off PUBLIC.
-- PUBLIC includes every role in the database; client browse only needs
-- anon + authenticated. consumers_select_self is authenticated-only
-- (anon has auth.uid() = null, so the policy never matched anyway).

drop policy if exists "classes_select_all" on public.classes;
create policy "classes_select_all" on public.classes
  for select to anon, authenticated
  using (true);

drop policy if exists "place_categories_select_all" on public.place_categories;
create policy "place_categories_select_all" on public.place_categories
  for select to anon, authenticated
  using (true);

drop policy if exists "place_tags_select_all" on public.place_tags;
create policy "place_tags_select_all" on public.place_tags
  for select to anon, authenticated
  using (true);

drop policy if exists "consumers_select_self" on public.consumers;
create policy "consumers_select_self" on public.consumers
  for select to authenticated
  using (id = (select auth.uid()));

comment on view public.projects_view is
  'Consumer browse view. SECURITY INVOKER (MESITA-599) — must keep with (security_invoker = true). Client roles: SELECT-only. MESITA-943.';

comment on function public.seed_place_categories() is
  'Admin/reset seed for place_categories vocabulary. Service-role / DEFINER callers only; EXECUTE revoked from clients (MESITA-941). Empty search_path + schema-qualified names is intentional.';

comment on function public.seed_place_tags() is
  'Admin/reset seed for place_tags vocabulary. Service-role only; EXECUTE revoked from clients (MESITA-941). Empty search_path + schema-qualified names is intentional.';

comment on function public.sync_place_category_label() is
  'BEFORE trigger: denormalize places.category_label from place_categories. Trigger-only; EXECUTE revoked from clients (MESITA-941).';

comment on function public.generate_consumer_code() is
  'Allocates next consumers.code from consumer_code_counter. Service-role EF path only; EXECUTE revoked from clients (MESITA-941).';

comment on function public.bump_reservation_call_counter(uuid) is
  'Atomic per-place daily reservation-call meter. Service-role Reservationist path only; EXECUTE revoked from clients (MESITA-940).';

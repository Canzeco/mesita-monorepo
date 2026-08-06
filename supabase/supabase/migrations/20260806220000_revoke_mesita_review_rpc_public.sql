-- MESITA-940: revoke public EXECUTE on mesita-review SECURITY DEFINER helpers.
--
-- Advisor 0028/0029: refresh_place_mesita_reviews + tg_ticket_reviews_refresh_place
-- were executable by anon/authenticated via PostgREST /rpc. Both are internal:
-- the trigger owns refresh; clients never call either. Triggers still fire
-- (table owner / postgres retains EXECUTE). Keep service_role for rare backfill.

revoke execute on function public.refresh_place_mesita_reviews(uuid)
  from public, anon, authenticated;

revoke execute on function public.tg_ticket_reviews_refresh_place()
  from public, anon, authenticated;

grant execute on function public.refresh_place_mesita_reviews(uuid)
  to service_role;

-- Trigger function: no PostgREST grant needed; keep postgres/table-owner path.
revoke execute on function public.tg_ticket_reviews_refresh_place()
  from service_role;

comment on function public.refresh_place_mesita_reviews(uuid) is
  'Recomputes places.mesita_review_count + mesita_stars_* from public.ticket_reviews for one project. Called by the ticket_reviews trigger; EXECUTE granted to service_role only (not anon/authenticated).';

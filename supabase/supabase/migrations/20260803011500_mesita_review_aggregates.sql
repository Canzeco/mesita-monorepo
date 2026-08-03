-- Mesita review aggregates: recompute places.mesita_* from ticket_reviews.
--
-- The six aggregate columns (mesita_stars_overall/_food/_service/_ambience/
-- _value + mesita_review_count) have existed since 0018 and are read by the
-- consumer place header, the Reviews tab, the business stats panel and the
-- admin console — but NOTHING ever wrote them from real reviews. No trigger,
-- no cron, no Edge Function: they were enricher/admin-written values only.
-- So a guest submitting a Mesita review (consumer-web-submit-ticket-review,
-- one per account per place since 20260802232526) moved nothing, and every
-- place read 0 reviews forever.
--
-- A trigger, not a cron: review volume is low, the recompute is a single
-- indexed aggregate over one project's rows, and correctness-on-read matters
-- more than write latency here — the guest who just left a review expects to
-- see it counted.
--
-- Zero reviews leaves the stars NULL rather than 0.0: the UI distinguishes
-- "no rating yet" (em dash) from a genuine 0.0, and the CHECK constraints
-- allow 0..5, so a 0.0 would silently read as the worst possible score.

create or replace function public.refresh_place_mesita_reviews(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.places p
  set mesita_review_count  = agg.n,
      -- numeric(2,1) columns: round to the one decimal they can hold, else
      -- the assignment rounds implicitly and the intent is invisible.
      mesita_stars_overall  = round(agg.overall::numeric, 1),
      mesita_stars_food     = round(agg.food::numeric, 1),
      mesita_stars_service  = round(agg.service::numeric, 1),
      mesita_stars_ambience = round(agg.ambiance::numeric, 1),
      -- `value` is the only nullable sub-score on ticket_reviews (added after
      -- the first reviews shipped), so avg() legitimately returns NULL here
      -- even when n > 0.
      mesita_stars_value    = agg.value
  from (
    -- Scalar aggregate, no GROUP BY — always yields exactly one row, so the
    -- "last review deleted" case falls out for free: n = 0 and every avg() is
    -- NULL, which clears the stars instead of freezing the last average.
    select
      count(*)        as n,
      avg(r.overall)  as overall,
      avg(r.food)     as food,
      avg(r.service)  as service,
      avg(r.ambiance) as ambiance,
      avg(r.value)    as value
    from public.ticket_reviews r
    where r.project_id = p_project_id
  ) agg
  where p.id = p_project_id;
end;
$$;

comment on function public.refresh_place_mesita_reviews(uuid) is
  'Recomputes places.mesita_review_count + mesita_stars_* from public.ticket_reviews for one project. Called by the ticket_reviews trigger; safe to call directly for a backfill.';

create or replace function public.tg_ticket_reviews_refresh_place()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- An UPDATE that moves a review between places has to refresh both sides.
  if tg_op = 'UPDATE' and new.project_id is distinct from old.project_id then
    perform public.refresh_place_mesita_reviews(old.project_id);
    perform public.refresh_place_mesita_reviews(new.project_id);
  else
    perform public.refresh_place_mesita_reviews(
      coalesce(new.project_id, old.project_id)
    );
  end if;
  return null; -- AFTER trigger: return value is ignored.
end;
$$;

drop trigger if exists ticket_reviews_refresh_place on public.ticket_reviews;
create trigger ticket_reviews_refresh_place
after insert or update or delete on public.ticket_reviews
for each row
execute function public.tg_ticket_reviews_refresh_place();

-- Backfill every place that already has reviews, and zero out the ones that
-- carry a stale non-null count with no rows behind it.
do $$
declare
  pid uuid;
begin
  for pid in
    select distinct project_id from public.ticket_reviews
    union
    select id from public.places where coalesce(mesita_review_count, 0) > 0
  loop
    perform public.refresh_place_mesita_reviews(pid);
  end loop;
end;
$$;

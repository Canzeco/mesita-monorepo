-- Mesita reviews: ONE per account per place, updatable (MESITA-825).
--
-- Pato's rule: "you can only review the place in Mesita once — or you can
-- UPDATE your review, but it's one review per account per place."
--
-- The table shipped with UNIQUE (ticket_id), which enforces one review per
-- TICKET. Since a guest gets a fresh ticket on every visit, five visits to
-- the same place produced five independent reviews of that place from one
-- account — exactly what the rule forbids. consumer-web-submit-ticket-review
-- upserts on the ticket key, so re-reviewing the SAME ticket updated the row,
-- but a new visit silently inserted a second one.
--
-- After this migration the identity of a review is (consumer, place):
--   * first visit  -> INSERT
--   * later visits -> UPDATE the same row (the upsert now conflicts on the
--                     new key), and ticket_id is rewritten to the ticket the
--                     review was last edited from.
--
-- ticket_id stays single-valued per row, so dropping UNIQUE (ticket_id) does
-- not permit two reviews to share a ticket in practice; the (consumer, place)
-- key is now the stricter constraint. It is kept as a column because it
-- records WHERE the review was last written, which the check page and
-- notifications still join on.
--
-- Backfill: the table holds 0 rows at time of writing (verified against
-- production), so no dedupe is required. The DELETE below is written anyway
-- so this migration is safe to run against a populated database — it keeps
-- the newest review per (consumer, place) and drops the older duplicates.

begin;

-- Keep only the most recent review per (consumer, place). No-op on 0 rows.
delete from public.ticket_reviews t
using public.ticket_reviews newer
where t.consumer_id = newer.consumer_id
  and t.project_id  = newer.project_id
  and (t.created_at, t.id) < (newer.created_at, newer.id);

alter table public.ticket_reviews
  drop constraint if exists ticket_reviews_ticket_id_key;

alter table public.ticket_reviews
  add constraint ticket_reviews_one_per_consumer_place
  unique (consumer_id, project_id);

commit;

comment on constraint ticket_reviews_one_per_consumer_place
  on public.ticket_reviews is
  'One Mesita review per account per place (MESITA-825). A repeat visit UPDATES the existing review via consumer-web-submit-ticket-review''s upsert; ticket_id records the visit it was last written from.';

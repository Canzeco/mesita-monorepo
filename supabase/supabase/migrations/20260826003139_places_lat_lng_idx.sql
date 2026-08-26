-- Viewport list-places filters lat/lng. Tiny catalog today; the index keeps
-- pan/zoom from seq-scanning places once the pool grows. Not CONCURRENTLY:
-- hosted migrations run inside a transaction.
create index if not exists places_lat_lng_idx
  on public.places (lat, lng)
  where lat is not null and lng is not null;

-- A guest vote is not a profile edit (MESITA-2420).
--
-- At the vote threshold the vote door now starts an Enrich run on Render, and
-- that run's one write (enricher-edgefunc-write-place) refuses a profile whose
-- updated_at moved after the run started: that is how it keeps an operator's
-- edit. apply_place_request bumps place_profiles.request_count, and this
-- trigger stamped updated_at on that bump too, so one more guest voting while
-- the run was in flight made the run look edited and threw its profile away.
--
-- The trigger now skips the stamp when request_count changed.
-- apply_place_request is the only writer of request_count, and it writes
-- nothing else, so every other update still stamps updated_at.

drop trigger if exists place_profiles_set_updated_at on public.place_profiles;

create trigger place_profiles_set_updated_at
  before update on public.place_profiles
  for each row
  when (old.request_count is not distinct from new.request_count)
  execute function public.set_updated_at();

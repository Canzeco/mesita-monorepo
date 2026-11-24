-- MESITA-4920 — read by nothing since one code per place (MESITA-4904).
drop function public.place_waiter_list(uuid, boolean, timestamptz);

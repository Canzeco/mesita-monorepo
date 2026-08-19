-- seed.sql — applied by `supabase db reset` after every migration.
-- Idempotent: safe to re-run.
--
-- Inserts go through `profiles` so INSTEAD OF triggers create the
-- underlying projects + places rows (same path as production create EFs).
-- Do not insert into `places`/`projects` directly here — the view is the
-- supported local-seed surface.

insert into public.profiles (slug, name, category, vibe, price_level, listing_type, status, closes_at, free_rate, premium_rate)
values
  ('casa-luminar-seed', 'Casa Luminar (seed)', 'mediterranean', 'rooftop', 3, 'partner', 'active', '02:00', 20, 50)
on conflict (slug) do nothing;

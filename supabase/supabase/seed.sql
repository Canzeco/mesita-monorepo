-- seed.sql — applied by `supabase db reset` after every migration.
-- Idempotent: safe to re-run.
--
-- Inserts go through `profiles` so INSTEAD OF triggers create the
-- underlying places + place_profiles rows (same path as production create
-- EFs). Do not insert into `places`/`place_profiles` directly here — the view
-- is the supported local-seed surface.

insert into public.profiles (slug, name, category, vibe, price_level, state, closes_at)
select
  'casa-luminar-seed', 'Casa Luminar (seed)', 'mediterranean', 'rooftop', 3, 'active', '02:00'
where not exists (
  select 1 from public.profiles where slug = 'casa-luminar-seed'
);

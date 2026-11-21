-- MESITA-4552: the matched Foursquare place's details, raw, for staff (the
-- Business place page's Foursquare box). Never in the guest `profiles` view.
alter table public.place_profiles
  add column if not exists foursquare_details jsonb,
  add column if not exists foursquare_details_at timestamptz;

comment on column public.place_profiles.foursquare_details is
  'MESITA-4552: the matched Foursquare place''s details as the Places API returned them (description, categories, rating, price, hours, stats, tastes, attributes, popularity…). Staff only.';
comment on column public.place_profiles.foursquare_details_at is
  'MESITA-4552: when foursquare_details was last stored. A failed read does not move it.';

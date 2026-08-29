-- Order-rail acceptance INTENT BITS (Pato gate 2026-08-29, Promotion score):
-- the operator's pickup / delivery offering toggles on the Partner tab
-- (admin-web-set-place-rails). Distinct from content-derived orders_enabled
-- (the guest Order CTA, menu-driven). Engines still gate the rails; these
-- bits say what the place WANTS to offer once the order rail ships.
-- Admin-only: deliberately NOT added to the anon-readable profiles view.

alter table public.places
  add column pickup_orders_enabled boolean not null default false,
  add column delivery_orders_enabled boolean not null default false;

comment on column public.places.pickup_orders_enabled is
  'Acceptance intent bit: the place offers pickup orders (operator toggle, admin-web-set-place-rails). The order rail engine gates the rail itself.';
comment on column public.places.delivery_orders_enabled is
  'Acceptance intent bit: the place offers delivery orders (operator toggle, admin-web-set-place-rails). The order rail engine gates the rail itself.';

do $$
begin
  -- Both columns exist, boolean, not null, default false.
  if (select count(*)
      from information_schema.columns
      where table_schema = 'public' and table_name = 'places'
        and column_name in ('pickup_orders_enabled', 'delivery_orders_enabled')
        and data_type = 'boolean' and is_nullable = 'NO'
        and column_default = 'false') <> 2 then
    raise exception 'places order-rail intent bits missing or misshaped';
  end if;
  -- The anon-readable profiles view must NOT expose them.
  if exists (select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name in ('pickup_orders_enabled', 'delivery_orders_enabled')) then
    raise exception 'profiles view must not expose the order-rail intent bits';
  end if;
end $$;

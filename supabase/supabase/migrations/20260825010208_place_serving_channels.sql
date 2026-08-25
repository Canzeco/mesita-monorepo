-- Five serving doors on reservations + orders (Pato 2026-08-25):
-- phone · whatsapp · instagram · web · none.
-- The Reservationist still only DIALS phone.

alter table public.places drop constraint if exists places_reservation_channel_check;
alter table public.places
  add constraint places_reservation_channel_check
  check (
    reservation_channel is null
    or reservation_channel in ('phone', 'whatsapp', 'instagram', 'web', 'none')
  );

alter table public.places drop constraint if exists places_order_channel_check;
alter table public.places
  add constraint places_order_channel_check
  check (
    order_channel is null
    or order_channel in ('phone', 'whatsapp', 'instagram', 'web', 'none')
  );

comment on column public.places.reservation_channel is
  'How a guest books: phone | whatsapp | instagram | web | none. The Reservationist dials only phone.';

comment on column public.places.order_channel is
  'How a guest orders: phone | whatsapp | instagram | web | none. Rail is staged.';

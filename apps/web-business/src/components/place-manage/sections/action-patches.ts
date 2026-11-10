import type { AdminPlace } from "../actions";

// What the Reservations switch writes (Business › Reservations, MESITA-3600): its own columns on this place, nothing else.
// The door refuses a reservation flip whose channel does not match: off is
// 'none'; on keeps the channel the place already has, else 'phone', how the
// Reservationist books.
export function reservationsPatch(place: AdminPlace) {
  const on = place.reservations_enabled === true;
  const current = place.reservation_channel;
  return {
    id: place.id,
    reservations_enabled: !on,
    reservation_channel: on ? "none" : current && current !== "none" ? current : "phone",
  };
}

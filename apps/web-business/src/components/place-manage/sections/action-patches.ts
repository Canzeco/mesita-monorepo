import type { AdminPlace } from "../actions";

// What the Reservations switch writes (Business › Reservations, MESITA-3600): its own column on this place, nothing else.
// The switch alone since MESITA-3622: reservations are received by phone, so no channel rides the flip.
export function reservationsPatch(place: AdminPlace) {
  return { id: place.id, reservations_enabled: place.reservations_enabled !== true };
}

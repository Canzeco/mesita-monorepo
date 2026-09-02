import { Armchair } from "lucide-react";

// One sidebar entry — "Visits". The LOCAL context: the guest is in the room
// and THE TICKET carries the whole table moment. Sits between Reservations and
// Orders because that is a guest's night — find a place, book it, sit down, or
// order instead — with Rewards pricing whatever happened.
//
// What a visit PAYS is not configured here (the Promos grid). Who reads a
// proof (Ojo) IS — same page, own blob (`ojo_config`), own Save.
export const VISITS_PARENT = {
  href: "/visits-config",
  label: "Visits",
  Icon: Armchair,
} as const;

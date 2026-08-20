import { Armchair } from "lucide-react";

// One sidebar entry — "Visits". The LOCAL context: the guest is in the room
// and THE TICKET carries the whole table moment. Sits between Reservations and
// Orders because that is a guest's night — find a place, book it, sit down, or
// order instead — with Promos pricing whatever happened.
//
// What a visit PAYS is not configured here (the Promos grid), and neither is
// who reads a proof (Ojo). This page is how the journey behaves.
export const VISITS_PARENT = {
  href: "/visits-config",
  label: "Visits",
  Icon: Armchair,
} as const;

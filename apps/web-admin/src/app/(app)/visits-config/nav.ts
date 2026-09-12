import { Armchair } from "lucide-react";

// One sidebar entry — "Visits". The LOCAL context: the guest is in the room
// and THE TICKET carries the whole table moment. Sits between Discovery and
// Orders because that is a guest's night — find a place, sit down, or
// order instead.
//
// What a visit PAYS (Visits Rewards) IS configured here — same page, own
// blob (`promos_config`), own Save; /rewards-config redirects. Who reads a
// proof (Ojo) IS too — own blob (`ojo_config`), own Save.
export const VISITS_PARENT = {
  href: "/visits-config",
  label: "Visits",
  Icon: Armchair,
} as const;

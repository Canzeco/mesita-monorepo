import { Armchair } from "lucide-react";

// One sidebar entry — "Visits". The LOCAL context: the guest is in the room
// and THE TICKET carries the whole table moment. Where it sits in the rail is
// `CONFIGS_NAV`'s call, not this file's — see `(app)/configs-nav.ts`.
//
// What a visit PAYS is not configured here (the Promos grid), and neither is
// who reads a proof (Ojo). This page is how the journey behaves.
export const VISITS_PARENT = {
  href: "/visits-config",
  label: "Visits",
  Icon: Armchair,
} as const;

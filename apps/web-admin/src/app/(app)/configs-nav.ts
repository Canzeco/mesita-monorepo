import type { LucideIcon } from "lucide-react";
import { Settings2 } from "lucide-react";
import { ENRICHER_PARENT } from "./enricher-config/nav";
import { FILTERS_PARENT } from "./filters-config/nav";
import { ORDERS_PARENT } from "./orders-config/nav";
import { RESERVATIONS_PARENT } from "./reservations-config/nav";
import { REWARDS_PARENT } from "./rewards-config/nav";
import { SOURCING_PARENT } from "./sourcing-config/nav";
import { VISITS_PARENT } from "./visits-config/nav";

// THE CONFIG PAGE SET IS CODE-DEFINED. `CONFIGS_NAV` below is the list of
// record — the Sidebar renders it, the doctor skill audits it, and prose that
// needs the set POINTS HERE instead of re-typing the rows. Same rule
// `_shared/channels.ts::ChannelKey` carries for channels: a list that is never
// copied cannot drift. Every prose copy of this one had drifted within two days
// of the rail rework that produced it (MESITA-1225).
//
// Each row's label and icon live in that route's own `nav.ts`; this file only
// decides WHICH pages exist and in what order.
//
// Order is the product flow, not the alphabet — two lifecycles end to end, a
// place's and then a guest's:
//   General       platform settings too small to earn a row of their own.
//                 Verification and Models were folded in (MESITA-1175), Ojo
//                 after them (MESITA-1178); all three routes survive as
//                 redirects to `/general-config`.
//   Sourcing      a place's life begins: which Google places may enter Mesita.
//   Enrichment    the pipeline that fills a place's profile (route stays
//                 `/enricher-config`).
//   Discovery     a guest's night begins: how they find a place (route stays
//                 `/filters-config`).
//   Visits        the LOCAL context — the guest is in the room.
//   Orders        the REMOTE one — the guest never walks in.
//   Reservations  booking the table, and how the Reservationist may call.
//   Promos        what either context pays (route stays `/rewards-config`).
//
// Memo is deliberately not a row: `memo_config` is EF-managed with no console
// page at all. `admin-web-get-memo-config` / `admin-web-update-memo-config`
// still read and write it, and `consumer-web-ask-memo` loads it at run time —
// so it is a live blob without an editor, not a dead one.
//
// Access (`/admin-config`) and Testing are not config pages and are not here —
// they are their own Sidebar groups, for the reasons stated there.
export const CONFIGS_NAV = [
  { href: "/general-config", label: "General", Icon: Settings2 },
  SOURCING_PARENT,
  ENRICHER_PARENT,
  FILTERS_PARENT,
  VISITS_PARENT,
  ORDERS_PARENT,
  RESERVATIONS_PARENT,
  REWARDS_PARENT,
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;

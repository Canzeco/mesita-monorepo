import { permanentRedirect } from "next/navigation";

// Sourcing folded into Intake (Pato, 2026-08-23) — one page for how a place
// gets into Mesita and becomes a profile. The channel matrix is the "Before
// the place exists" band there.
//
// The ROUTE is all that died. This folder still holds `actions.ts`,
// `catalog.ts` and `SourcingConfigClient.tsx`, which the Intake page imports:
// `catalog.ts` is cited by path from web-consumer, mobile-consumer and
// `_shared/sourcing.ts` as the FAMILIES authoring source, so moving it would
// break four comments to buy nothing. Without a `page.tsx` rendering anything,
// this is a module folder that happens to sit under app/.
export default function SourcingConfigRedirect() {
  permanentRedirect("/enricher-config");
}

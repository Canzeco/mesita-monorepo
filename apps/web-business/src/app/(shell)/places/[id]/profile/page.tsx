// Profile — the Place screen's landing tab.
//
// Two shapes, one route, and NO READ OF ITS OWN (MESITA-1875). A place the
// caller can MANAGE renders admin's Single Place profile editor verbatim; a
// place still in the POOL renders identity and the claim door. The layout
// above resolved which of the two this is — it branches on the same fact to
// decide whether to mount `PlaceManageShell` — so `PlaceProfileBody` reads it
// from `PlaceScope` instead of spending `business-web-get-overview` (p50
// 472ms) to re-learn a boolean on every navigation back to this tab.
import { PlaceProfileBody } from "./PlaceProfileBody";

export default function PlaceProfilePage() {
  return <PlaceProfileBody />;
}

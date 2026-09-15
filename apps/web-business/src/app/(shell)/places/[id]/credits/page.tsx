// Credits — accepting and selling branded credits: the two prepay rungs,
// which are one product and were two rows inside Capabilities (MESITA-1885).
//
// The gate is Capabilities' gate unchanged: a viewer may read the place,
// never configure it. `PlaceTabGate` enforces it from the matrix the layout
// already resolved (MESITA-1875).
import { ProductLadderTab } from "@/components/place-manage/ProductLadderTab";

export default function CreditsPage() {
  return <ProductLadderTab zone="credits" />;
}

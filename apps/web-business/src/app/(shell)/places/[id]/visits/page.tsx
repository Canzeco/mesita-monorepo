// Visits — the place's own room: Visit Rewards, the strategy ladder that
// prices it, the Partnership body it depends on, and the internal "How this
// place is run" box.
//
// ITS OWN VIEW SINCE MESITA-1885, when Pato put all eight products in the
// rail. It took over Rewards' address — MESITA-1884 folded the Rewards CARD
// into the Visits card, and this is the same fold one layer down — and
// Capabilities' internal box, which had to pick one of five views rather than
// be split or repeated. It picked this one because that box is about visits:
// how they are run here, and who runs them.
//
// The gate is Capabilities' and Rewards' gate unchanged, because the write is
// the same write: a viewer may read the place, never configure it.
// `PlaceTabGate` in the layout enforces it from the matrix the layout already
// resolved (MESITA-1875).
import { ProductLadderTab } from "@/components/place-manage/ProductLadderTab";

export default function VisitsPage() {
  return <ProductLadderTab zone="visits" />;
}

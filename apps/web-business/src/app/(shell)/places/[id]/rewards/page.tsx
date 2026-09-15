// Rewards — THE PLACE's earning: Visit Rewards and the strategy behind it.
//
// Split out of Capabilities in MESITA-1841. The gate is Capabilities' gate,
// because the write is the same write: a viewer may read the place but never
// price it. `PlaceTabGate` in the layout enforces it now (MESITA-1875), from
// the matrix the layout already resolved — this page spent two Edge Function
// calls per navigation to re-derive it.
import { RewardsTab } from "./RewardsTab";

export default function RewardsPage() {
  return <RewardsTab />;
}

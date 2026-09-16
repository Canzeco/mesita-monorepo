// Rewards — what a guest EARNS here: Visit Rewards, the strategy cards that
// price it, and the Partnership body the strategies are bought with.
//
// IT IS A VIEW AGAIN (MESITA-1900), and this is the fourth time the answer has
// moved. It was `/rewards` until MESITA-1885 folded it into Visits; MESITA-1884
// had already folded its CARD into Visits' card on Pato's *"should i separate
// visits and rewards into two?? i don't think so."* Pato's 2026-09-16 product
// list separates them, and WHERE it puts Rewards is the argument: beside
// Payments and Credits, not beside Visits. A reward is what a place pays out.
//
// THE FORWARD HAD TO DIE IN THE SAME COMMIT. `/places/:id/rewards` and the
// flat `/rewards` were redirect rules in `next.config.ts`, and a config rule
// runs BEFORE filesystem routes — so this file with those rules still in place
// would never render, with every check green. That is `/settings` in
// MESITA-1839 and `/credits` in MESITA-1885; `legacy-redirects.test.ts` walks
// every address in the contract through the table for exactly this.
//
// THE PARTNERSHIP BODY CAME WITH IT, and Visits kept the internal box. The two
// were on Visits together from MESITA-1885, but they are about different
// things: the body prices Conservative and Aggressive — its own docblock calls
// it *"Rewards' own box"* — while "How this place is run" is how visits are
// run here. Each went to the view it is about.
//
// The gate is Visits' gate unchanged: a viewer may read the place, never
// configure it. `PlaceTabGate` enforces it from the matrix the layout already
// resolved (MESITA-1875).
import { ProductLadderTab } from "@/components/place-manage/ProductLadderTab";

export default function RewardsPage() {
  return <ProductLadderTab zone="rewards" />;
}

// Pay — THE PLACE's Mesita Pay switch, and only it (MESITA-1885).
//
// ONE LEVEL NOW, STILL TWO SCREENS (MESITA-1892). There were two Mesita Pay
// bits — the organization's and the place's — ANDed into one effective
// capability, and this page owned the second. The layer is gone, the two
// collapsed into `place_profiles.mesita_pay_enabled`, and the Stripe account
// hangs off the place as `place_payment_accounts`.
//
// The SCREENS did not merge, because they never answered one question:
// `/places/<id>/products/pay` is where an operator connects the account and
// reads its Stripe state — buying the product — and this page is where the
// rung is flipped for the place — running it. The ladder's `mesita_pay` rung
// still locks until the account is Connect-ready, and the prerequisite line
// still carries the door, so this page never repeats the Stripe box.
//
// The gate is Capabilities' gate unchanged: a viewer may read the place,
// never configure it. `PlaceTabGate` enforces it from the matrix the layout
// already resolved (MESITA-1875).
import { ProductLadderTab } from "@/components/place-manage/ProductLadderTab";

export default function PayPage() {
  return <ProductLadderTab zone="pay" />;
}

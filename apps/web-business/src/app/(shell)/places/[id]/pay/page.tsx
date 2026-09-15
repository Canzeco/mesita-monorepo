// Pay — THE PLACE's Mesita Pay switch, and only it (MESITA-1885).
//
// TWO LEVELS, TWO SCREENS, ONE PRODUCT. The ORGANIZATION's switch
// (`mesita_pay_enabled`) and its Stripe account live one level up, at
// `/orgs/<id>/products/pay`, which is what the catalogue card means by "On for
// the organization. Each place turns it on too." The ladder's `mesita_pay`
// rung is the place's half, and it locks until the organization's half is
// done — the prerequisite line carries the door, so this page never repeats
// the Stripe box it cannot own.
//
// The gate is Capabilities' gate unchanged: a viewer may read the place,
// never configure it. `PlaceTabGate` enforces it from the matrix the layout
// already resolved (MESITA-1875).
import { ProductLadderTab } from "@/components/place-manage/ProductLadderTab";

export default function PayPage() {
  return <ProductLadderTab zone="pay" />;
}

import { PremierBadge } from "./PremierBadge";

// THE TWO MARKS AFTER A PLACE'S NAME (Pato, MESITA-3321: "if the product is
// premier put a red icon. if the product is mesita pay (meaning it has
// payments activated), then put an extra icon in green. that means Mesita
// Pay after the red thing"): the red Premier rosette (MESITA-2925), then the
// green Mesita Payments mark, each alone when only one applies, in that order,
// on every surface that draws a name (the top bar, the Home tile, the
// Search card). The server says which: `boost_tier`, and `mesita_pay` on a
// list row or `money.mesita_pay` on the place read (moneyState's mark,
// MESITA-3408); the client never
// decides. The Pay mark is the QR, the one Pay mark everywhere (the Pay
// tile, the bar), in green. Since MESITA-3420 both are the same seal: red
// for Premier, green with a $ for Mesita Payments, and no words beside them.

/** The red Premier seal after a name. The green Mesita Payments mark is gone
 *  (Pato, MESITA-3628: "we already have red for premier and that is enough"). */
export function PlaceMarks({
  tier,
  compact = false,
  ad = false,
}: {
  tier: number | null | undefined;
  compact?: boolean;
  ad?: boolean;
}) {
  return (
    <>
      <PremierBadge tier={tier} compact={compact} ad={ad} />
    </>
  );
}

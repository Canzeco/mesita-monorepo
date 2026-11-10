import { cn } from "../lib/format";
import { PremierBadge, SEAL_PATH } from "./PremierBadge";

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

/** The green Mesita Payments mark alone: Premier's seal in green with a white $
 *  (Pato, MESITA-3420, B of four: "kinda like the verified icon"; a green
 *  rounded square with the QR until then). Display only. */
export function MesitaPayMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="Mesita Payments and Prepayments"
      className={cn("inline-block h-5 w-5 shrink-0", className)}
      data-mesita-pay
    >
      <title>Mesita Payments and Prepayments</title>
      <path d={SEAL_PATH} fill="#00BA4A" />
      <g transform="translate(12 12) scale(0.5) translate(-12 -12)" fill="none" stroke="#fff" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </g>
    </svg>
  );
}

/** Premier (red), then Mesita Payments (green), after a name. */
export function PlaceMarks({
  tier,
  mesitaPay = false,
  compact = false,
  ad = false,
}: {
  tier: number | null | undefined;
  mesitaPay?: boolean;
  compact?: boolean;
  ad?: boolean;
}) {
  return (
    <>
      <PremierBadge tier={tier} compact={compact} ad={ad} />
      {mesitaPay ? <MesitaPayMark /> : null}
    </>
  );
}

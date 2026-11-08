import { QrCode } from "lucide-react";

import { cn } from "../lib/format";
import { PremierBadge } from "./PremierBadge";

// THE TWO MARKS AFTER A PLACE'S NAME (Pato, MESITA-3321: "if the product is
// premier put a red icon. if the product is mesita pay (meaning it has
// payments activated), then put an extra icon in green. that means Mesita
// Pay after the red thing"): the red Premier rosette (MESITA-2925), then the
// green Mesita Pay mark, each alone when only one applies, in that order,
// on every surface that draws a name (the top bar, the Home tile, the
// Search card). The server says which: `boost_tier`, and `mesita_pay` on a
// list row or `money.mesita_pay` on the place read (moneyState's mark,
// MESITA-3408); the client never
// decides. The Pay mark is the QR, the one Pay mark everywhere (the Pay
// tile, the bar), in green.

/** The green Mesita Pay mark alone. Display only. */
export function MesitaPayMark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Mesita Pay"
      title="Mesita Pay"
      className={cn("inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white", className)}
      data-mesita-pay
    >
      <QrCode className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
    </span>
  );
}

/** Premier (red), then Mesita Pay (green), after a name. */
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

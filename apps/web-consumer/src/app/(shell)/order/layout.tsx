import type { ReactNode } from "react";
import { ModeRail, ORDER_MODES } from "@/components/consumer/ModeRail";

// Order's frame (Pato, MESITA-2050: "Order must have Home. and thats it, i
// guess."). One pill, Home. See ModeRail.tsx for why a one-pill row ships
// here when the Pay section row was deleted for being one: the row is what
// makes Order the same kind of tab as Visit, and the next mode is an append.
export default function OrderLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ModeRail modes={ORDER_MODES} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}

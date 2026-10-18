"use client";

import { CalendarCheck, QrCode } from "lucide-react";

import type { PlaceActions } from "../../actions";
import { inertButtonProps } from "../../actions";
import type { PlaceDetail } from "../../place-detail";
import { cn } from "../../lib/format";
import { isReserveActionEnabled } from "../../lib/place-profile-actions";

// decision: Pato (2026-10-16) — the action pair is Reserve and Pay (Soon).
// Save sits with Contact and Share in the header and is not Soon.
// Icon beside the label, one row, pill shape. Reserve is the filled
// primary; Pay is muted with its Soon tag (MESITA-2315).
const actionBtn =
  "type-body relative inline-flex h-12 items-center justify-center gap-2 rounded-full px-3 font-semibold whitespace-nowrap transition active:scale-[0.99]";

export function PlaceActionBar({
  place,
  onReserve,
  className,
}: {
  place: PlaceDetail;
  onReserve?: PlaceActions["onReserve"];
  className?: string;
}) {
  const reserveLive = isReserveActionEnabled(place) && Boolean(onReserve);

  return (
    <div
      className={cn(
        "border-border bg-card/95 shrink-0 border-t px-4 pt-3 pb-3 backdrop-blur",
        className,
      )}
    >
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          {...(reserveLive
            ? { onClick: onReserve, "aria-haspopup": "dialog" as const }
            : inertButtonProps(false))}
          aria-label="Reserve a table"
          className={cn(actionBtn, "bg-foreground text-paper hover:opacity-90")}
        >
          <CalendarCheck className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          Reserve
        </button>
        <button
          type="button"
          {...inertButtonProps(false)}
          aria-label="Pay, Soon"
          className={cn(actionBtn, "bg-muted text-foreground")}
        >
          <QrCode className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          Pay
          <span className="bg-card text-muted-foreground type-meta rounded-full px-1.5 py-0.5 leading-none font-semibold">
            Soon
          </span>
        </button>
      </div>
    </div>
  );
}

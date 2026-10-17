"use client";

import { CalendarCheck, QrCode } from "lucide-react";

import type { PlaceActions } from "../../actions";
import { inertButtonProps } from "../../actions";
import type { PlaceDetail } from "../../place-detail";
import { cn } from "../../lib/format";
import { isReserveActionEnabled } from "../../lib/place-profile-actions";

// decision: Pato (2026-10-16) — the action pair is Reserve and Pay (Soon).
// Save sits with Contact and Share in the header and is not Soon.
const outlineBtn =
  "border-border bg-card text-foreground hover:bg-muted type-body relative inline-flex flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2.5 font-semibold whitespace-nowrap transition active:scale-[0.99]";

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
        "border-border bg-card/95 shrink-0 border-t px-4 pt-3 pb-4 backdrop-blur",
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
          className={outlineBtn}
        >
          <CalendarCheck className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          Reserve
        </button>
        <button
          type="button"
          {...inertButtonProps(false)}
          aria-label="Pay, Soon"
          className={outlineBtn}
        >
          <QrCode className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          Pay
          <span className="bg-muted text-muted-foreground type-meta rounded-full px-1.5 leading-none font-semibold">
            Soon
          </span>
        </button>
      </div>
    </div>
  );
}

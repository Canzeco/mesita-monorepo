"use client";

import { CalendarCheck } from "lucide-react";

import type { PlaceActions } from "../../actions";
import { inertButtonProps } from "../../actions";
import type { PlaceDetail } from "../../place-detail";
import { cn } from "../../lib/format";
import { isReserveActionEnabled } from "../../lib/place-profile-actions";

// Reserve, pinned under the scroll. The booking sheet stays in the consumer.
// A missing onReserve leaves the button visible and inert. A walk-in place
// still renders no bar.
export function PlaceActionBar({
  place,
  onReserve,
  className,
}: {
  place: PlaceDetail;
  onReserve?: PlaceActions["onReserve"];
  className?: string;
}) {
  if (!isReserveActionEnabled(place)) return null;
  const live = Boolean(onReserve);

  return (
    <div
      className={cn(
        "border-border bg-card/95 shrink-0 border-t px-4 pt-3 pb-4 backdrop-blur",
        className,
      )}
    >
      <button
        type="button"
        {...(live
          ? {
              onClick: onReserve,
              "aria-haspopup": "dialog" as const,
            }
          : inertButtonProps(false))}
        aria-label="Reserve a table"
        className="border-border bg-card text-foreground hover:bg-muted type-body inline-flex w-full flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2.5 font-semibold whitespace-nowrap transition active:scale-[0.99]"
      >
        <CalendarCheck className="h-4 w-4 shrink-0" strokeWidth={2.25} />
        Reserve
      </button>
    </div>
  );
}

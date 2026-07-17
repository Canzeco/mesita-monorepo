import { Calendar } from "lucide-react";
import type { LinkedReservationSummary } from "@/lib/mock/coupons-mock";
import { cn, guestNoun } from "@/lib/utils";

// Linked reservation ticket stub — dashed perforated edge below a
// coupon card sells the "ticket pair" metaphor when a reservation is
// tied to the coupon.

export function LinkedReservationStub({
  reservation,
}: {
  reservation: LinkedReservationSummary;
}) {
  const isBooking = reservation.state === "booking";
  return (
    <div className="border-border/70 flex items-center gap-2.5 border-t border-dashed bg-emerald-500/[0.04] px-3 py-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/20">
        <Calendar className="h-4 w-4 text-emerald-700" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[9px] font-bold tracking-[0.18em] uppercase">
          Reservation tied
        </p>
        <p className="text-foreground mt-0.5 truncate text-[13px] leading-tight font-semibold">
          {reservation.when}{" "}
          <span className="text-muted-foreground font-normal">
            · {reservation.partySize}{" "}
            {guestNoun(reservation.partySize)}
          </span>
        </p>
      </div>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold",
          isBooking
            ? "border-amber-500/30 bg-amber-50 text-amber-800"
            : "border-emerald-500/30 bg-emerald-50 text-emerald-800",
        )}
      >
        {isBooking ? "Booking" : "Booked"}
      </span>
    </div>
  );
}

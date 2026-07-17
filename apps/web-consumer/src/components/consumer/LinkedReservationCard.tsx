import Link from "next/link";
import { Calendar } from "lucide-react";

import type { LinkedReservationSummary } from "@/lib/mock/coupons-mock";
import { reservationPath } from "@/lib/consumer-route-contract";
import { cn, guestNoun } from "@/lib/utils";

export function LinkedReservationCard({
  reservation,
}: {
  reservation: LinkedReservationSummary;
}) {
  const isBooking = reservation.state === "booking";
  return (
    <Link
      href={reservationPath(reservation.id)}
      className="flex items-center gap-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3.5 transition hover:bg-emerald-500/[0.06]"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/20">
        <Calendar className="h-5 w-5 text-emerald-700" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[9px] font-bold tracking-[0.18em] uppercase">
          Reservation tied to this coupon
        </p>
        <p className="text-foreground mt-0.5 truncate text-[14px] leading-tight font-semibold">
          {reservation.when}{" "}
          <span className="text-muted-foreground font-normal">
            · {reservation.partySize} {guestNoun(reservation.partySize)}
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
    </Link>
  );
}

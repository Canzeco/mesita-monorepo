"use client";

import { Check, Loader2, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BusinessReservation } from "@/lib/api/reservations";
import {
  reservationGuestName,
  reservationPartyLabel,
  reservationPlan,
  reservationStatusLabel,
  reservationStatusTone,
  reservationWhen,
} from "@/lib/reservation-display";

function statusAccentClass(status: BusinessReservation["status"]): string {
  if (status === "pending") return "bg-amber-500";
  if (status === "confirmed") return "bg-emerald-500";
  if (status === "no_show") return "bg-violet-500";
  if (status === "declined" || status === "cancelled") {
    return "bg-muted-foreground/40";
  }
  return "bg-border";
}

export function ReservationCard({
  reservation,
  busy,
  onDecide,
}: {
  reservation: BusinessReservation;
  busy: string | null;
  onDecide: (reservationId: string, decision: "confirm" | "decline") => void;
}) {
  const { id, status, party_size, notes } = reservation;
  const guest = reservationGuestName(reservation);
  const plan = reservationPlan(reservation);
  const when = reservationWhen(reservation.reserved_at);
  const pending = status === "pending";
  const terminal =
    status === "declined" || status === "cancelled" || status === "no_show";
  const confirmBusy = busy === `confirm:${id}`;
  const declineBusy = busy === `decline:${id}`;
  const anyBusy = confirmBusy || declineBusy || busy === "refresh";

  return (
    <article
      className={cn(
        "group relative flex flex-col gap-3 rounded-2xl border p-4 transition",
        pending
          ? "border-primary/25 bg-card ring-primary/10 shadow-sm ring-1"
          : "border-border/50 bg-card/80 hover:border-border/80 hover:bg-card",
        terminal && "opacity-60",
      )}
    >
      <span
        className={cn(
          "absolute top-4 bottom-4 left-0 w-0.5 rounded-full",
          statusAccentClass(status),
        )}
        aria-hidden
      />

      <div className="flex items-start gap-3 pl-1">
        <div
          className="font-display bg-pink-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
          aria-hidden
        >
          {guest.charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold tracking-tight">
                {guest}
              </p>
              <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[11px] leading-snug">
                <Users className="h-3 w-3 shrink-0" />
                {reservationPartyLabel(party_size)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[15px] font-semibold tracking-tight">
                {when.time}
              </p>
              <p className="text-muted-foreground mt-0.5 text-[11px] font-medium">
                {when.date}
              </p>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                reservationStatusTone(status),
              )}
            >
              {reservationStatusLabel(status)}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                plan.premium
                  ? "bg-secondary/12 text-secondary"
                  : "text-muted-foreground bg-muted/60",
              )}
              title={plan.door ? `Premium · ${plan.door}` : plan.label}
            >
              {plan.premium && plan.door
                ? `Premium · ${plan.door}`
                : plan.label}
            </span>
          </div>

          {notes ? (
            <p className="text-muted-foreground mt-2 line-clamp-2 text-[12px] leading-snug">
              “{notes}”
            </p>
          ) : null}
        </div>
      </div>

      {pending ? (
        <div className="flex flex-wrap items-center gap-2 pl-11 sm:pl-12">
          <button
            type="button"
            onClick={() => onDecide(id, "confirm")}
            disabled={anyBusy}
            className="bg-primary text-primary-foreground inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-semibold shadow-sm transition hover:opacity-90 disabled:opacity-40"
          >
            {confirmBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Confirm
          </button>
          <button
            type="button"
            onClick={() => onDecide(id, "decline")}
            disabled={anyBusy}
            className="text-muted-foreground hover:text-destructive border-border/60 hover:border-border inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition disabled:opacity-40"
          >
            {declineBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
            Decline
          </button>
        </div>
      ) : null}
    </article>
  );
}

"use client";

import Image from "next/image";
import { Calendar, Hash, Users } from "lucide-react";
import { useState } from "react";

import type { ReservationItem } from "@/lib/mock/reservations-mock";
import { cn, guestNoun } from "@/lib/utils";
import { RESERVATION_FLOW, statusMeta } from "@/lib/reservation-status";
import { MetaRow } from "@/components/consumer/reservation-detail-ui";
import { ReservationActions } from "@/components/consumer/reservation-actions";
import { apiConfirmReservation } from "@/lib/api/reservations";
import { useBrowserSupabase } from "@/lib/supabase/browser";

// Shared body for /reservation/[id]. Used by both the intercepted modal
// (ReservationDetailModalShell) and the hard-nav page. Stays narrow on
// purpose — the ticket's lifecycle, its metadata, and the actions that can
// move it. No reward surface (a discount is earned by showing up, on the
// visit ticket); no payment, no bill math (that happens at the table); no
// full place detail (that lives on /places/[id]).

// The happy path as a stepper: created → booking → confirmed → passed. A
// ticket that exited the path (cancelled / failed) shows the banner instead —
// drawing a half-lit ladder for a dead ticket reads as "still going".
function LifecycleStepper({ status }: { status: ReservationItem["status"] }) {
  const index = RESERVATION_FLOW.indexOf(status);
  if (index < 0) return null;
  return (
    <section
      aria-label="Reservation progress"
      className="flex items-center gap-1.5"
    >
      {RESERVATION_FLOW.map((step, i) => {
        const done = i <= index;
        const meta = statusMeta(step);
        return (
          <div key={step} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span
              className={cn(
                "h-1 rounded-full transition",
                done ? "bg-primary" : "bg-border",
              )}
            />
            <span
              className={cn(
                "type-label truncate font-medium",
                i === index
                  ? "text-foreground"
                  : done
                    ? "text-muted-foreground"
                    : "text-muted-foreground/60",
              )}
            >
              {meta.label}
            </span>
          </div>
        );
      })}
    </section>
  );
}

export function ReservationDetailBody({
  r,
  onChanged,
}: {
  r: ReservationItem;
  onChanged?: () => void;
}) {
  const meta = statusMeta(r.status);
  const banner = r.statusNote ?? meta.banner;
  const supabase = useBrowserSupabase();
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const offers = (r.alternatives ?? []).filter((a) => a.time);
  const showOffers = r.status === "booking" && offers.length > 0;
  const showAck =
    r.status === "confirmed" && !r.guestConfirmedAt && r.guestNotify === "app";

  async function confirm(args?: { newDate?: string; newTime?: string }) {
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      await apiConfirmReservation(supabase, {
        reservationId: r.id,
        ...args,
      });
      onChanged?.();
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : "Couldn't confirm");
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
      {/* Hero — place photo + name + status pill stacked. Larger than the
          list card so the screen reads like a ticket, not a list row. */}
      <section className="border-border bg-card overflow-hidden rounded-2xl border">
        <div className="bg-muted relative aspect-[16/9] w-full">
          {r.placePhoto ? (
            <Image
              src={r.placePhoto}
              alt={r.placeName}
              fill
              sizes="(max-width: 640px) 100vw, 480px"
              className={cn(
                "object-cover",
                meta.spent && "opacity-80 grayscale",
              )}
            />
          ) : null}
        </div>
        <div className="flex items-start justify-between gap-2 px-4 py-3">
          <h1
            className={cn(
              "font-display text-xl leading-tight font-semibold tracking-tight",
              r.status === "cancelled" && "line-through",
            )}
          >
            {r.placeName}
          </h1>
          <span
            className={cn(
              "type-label inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-0.5 font-semibold",
              meta.pillClass,
            )}
          >
            <meta.Icon
              className={cn("h-3 w-3", meta.iconClass)}
              strokeWidth={2.25}
            />
            {meta.label}
          </span>
        </div>
      </section>

      <LifecycleStepper status={r.status} />

      {banner && (
        <p
          className={cn(
            "type-body rounded-2xl px-3 py-2.5 leading-snug",
            r.status === "booking" || r.status === "created"
              ? "bg-amber-50 text-amber-900 ring-1 ring-amber-400/30"
              : r.status === "failed"
                ? "bg-rose-50 text-rose-900 ring-1 ring-rose-400/30"
                : "bg-muted text-muted-foreground",
          )}
        >
          {banner}
        </p>
      )}

      {/* Reservation metadata list. iOS Settings-style rows. */}
      <section className="border-border bg-card divide-border/70 divide-y overflow-hidden rounded-2xl border">
        <MetaRow Icon={Calendar} label="When" value={r.when} />
        <MetaRow
          Icon={Users}
          label="Party"
          value={`${r.partySize} ${guestNoun(r.partySize)}`}
        />
        <MetaRow
          Icon={meta.Icon}
          iconClass={meta.iconClass}
          label="Status"
          value={meta.label}
        />
        {r.referenceCode && (
          <MetaRow Icon={Hash} label="Reference" value={r.referenceCode} />
        )}
      </section>

      {showOffers && (
        <section className="border-border bg-card flex flex-col gap-2 rounded-2xl border p-3">
          <p className="type-body font-semibold">Pick an offered time</p>
          {offers.map((alt) => {
            const label = [alt.date, alt.time, alt.note]
              .filter(Boolean)
              .join(" · ");
            return (
              <button
                key={`${alt.date ?? ""}-${alt.time}-${alt.note ?? ""}`}
                type="button"
                disabled={confirmBusy}
                onClick={() =>
                  confirm({
                    ...(alt.date ? { newDate: alt.date } : {}),
                    newTime: alt.time,
                  })
                }
                className="border-border hover:bg-muted rounded-xl border px-3 py-2.5 text-left text-sm font-medium disabled:opacity-60"
              >
                {label}
              </button>
            );
          })}
          {confirmError && (
            <p className="text-xs font-medium text-red-600">{confirmError}</p>
          )}
        </section>
      )}

      {showAck && (
        <button
          type="button"
          disabled={confirmBusy}
          onClick={() => confirm()}
          className="bg-primary text-primary-foreground inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold disabled:opacity-60"
        >
          {confirmBusy ? "Confirming…" : "Got it — confirm in app"}
        </button>
      )}

      <ReservationActions r={r} onChanged={onChanged} />
    </div>
  );
}

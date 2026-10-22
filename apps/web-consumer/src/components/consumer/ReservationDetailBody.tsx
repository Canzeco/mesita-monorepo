"use client";

import Image from "next/image";
import { Calendar, Hash, Users } from "lucide-react";
import { useState, type ComponentProps } from "react";

import type { ReservationItem } from "@/lib/reservation-types";
import { cn, errMsg, guestNoun } from "@/lib/utils";
import { RESERVATION_FLOW, stateMeta } from "@/lib/reservation-state";
import { MetaRow } from "@/components/consumer/reservation-detail-ui";
import { ReservationActions } from "@/components/consumer/reservation-actions";
import { apiConfirmReservation } from "@/lib/api/reservations";
import { useBrowserSupabase } from "@/lib/supabase/browser";

// Shared body for /reservation/[id]. Used by both the intercepted modal
// (ReservationDetailModalShell) and the hard-nav page. Stays narrow on
// purpose — the booking's lifecycle, its metadata, and the actions that can
// move it. No full place detail (that lives on /place/[id]).

/** The metadata card's rows, in order. Every reservation carries a
 *  reference code (8 digits, set on insert since 2026-07-27), so the loaded
 *  card holds all four. ReservationBodySkeleton draws one row per label
 *  here, so its card can never be a row short of this one (Pato,
 *  MESITA-2701: "the placeholders must be similar to the page you are
 *  loading, like the sizes"); it drew three, and everything under the card
 *  dropped a row when the reservation landed. */
export const RESERVATION_META_LABELS = [
  "When",
  "Party",
  "State",
  "Reference",
] as const;

export type ReservationMetaLabel = (typeof RESERVATION_META_LABELS)[number];

// The happy path as a stepper: created → booking → confirmed → passed. A
// reservation that exited the path (cancelled / failed) shows the banner
// instead — drawing a half-lit ladder for a dead one reads as "still going".
function LifecycleStepper({ state }: { state: ReservationItem["state"] }) {
  const index = RESERVATION_FLOW.indexOf(state);
  if (index < 0) return null;
  return (
    <section
      aria-label="Reservation progress"
      className="flex items-center gap-1.5"
    >
      {RESERVATION_FLOW.map((step, i) => {
        const done = i <= index;
        const meta = stateMeta(step);
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
  const meta = stateMeta(r.state);
  const banner = r.stateNote ?? meta.banner;
  const supabase = useBrowserSupabase();
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const offers = (r.alternatives ?? []).filter((a) => a.time);
  const showOffers = r.state === "booking" && offers.length > 0;
  const showAck =
    r.state === "confirmed" && !r.guestConfirmedAt && r.guestNotify === "app";
  // One entry per RESERVATION_META_LABELS; a row with nothing to say is
  // null and draws nothing.
  const metaRows: Record<
    ReservationMetaLabel,
    Omit<ComponentProps<typeof MetaRow>, "label"> | null
  > = {
    When: { Icon: Calendar, value: r.when },
    Party: { Icon: Users, value: `${r.partySize} ${guestNoun(r.partySize)}` },
    State: { Icon: meta.Icon, iconClass: meta.iconClass, value: meta.label },
    Reference: r.referenceCode ? { Icon: Hash, value: r.referenceCode } : null,
  };

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
      setConfirmError(errMsg(e, "Couldn't confirm"));
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
      {/* Hero — place photo + name + state pill stacked. Larger than the
          list card so the screen reads as one reservation, not a list row. */}
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
              r.state === "cancelled" && "line-through",
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

      <LifecycleStepper state={r.state} />

      {banner && (
        <p
          className={cn(
            "type-body rounded-2xl px-3 py-2.5 leading-snug",
            r.state === "booking" ||
              r.state === "created" ||
              r.state === "failed"
              ? "bg-muted text-foreground ring-1 ring-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {banner}
        </p>
      )}

      {/* Reservation metadata list. iOS Settings-style rows. */}
      <section className="border-border bg-card divide-border/70 divide-y overflow-hidden rounded-2xl border">
        {RESERVATION_META_LABELS.map((label) => {
          const row = metaRows[label];
          return row ? <MetaRow key={label} label={label} {...row} /> : null;
        })}
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
            <p className="text-xs font-medium text-destructive">{confirmError}</p>
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

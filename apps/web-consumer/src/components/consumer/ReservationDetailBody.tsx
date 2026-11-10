"use client";

import { SizedImage } from "@mesita/place-profile";
import { Copy } from "lucide-react";
import { useState } from "react";

import type { ReservationItem } from "@/lib/reservation-types";
import { cn, errMsg } from "@/lib/utils";
import { RESERVATION_FLOW, stateMeta } from "@/lib/reservation-state";
import { ReservationActions } from "@/components/consumer/reservation-actions";
import { apiConfirmReservation } from "@/lib/api/reservations";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";

// Shared body for /reservation/[id]. Used by both the intercepted modal
// (ReservationDetailModalShell) and the hard-nav page. Stays narrow on
// purpose — the booking's lifecycle, its metadata, and the actions that can
// move it. No full place detail (that lives on /place/[id]).

// THE TIME IS THE HEADLINE (Pato, MESITA-3649: "THIS UI LOOKS LIKE SHIT";
// decided: the state once, the time first, no form table). One card holds
// a short photo, the place and its state pill, then the time large and the
// table's size under it. The state is said once, by the pill: no struck-out
// name, no STATE row, no note that only restates it. The reference is one
// quiet line under the card, copied on a tap. The When · Party · State ·
// Reference table of uppercase labels it replaced read like a form.

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
  const reference = r.referenceCode ?? null;
  async function copyReference() {
    if (!reference) return;
    try {
      await navigator.clipboard.writeText(reference);
      toast.success("Reference copied.");
    } catch {
      toast.error("Couldn't copy. The reference is " + reference + ".");
    }
  }

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
      <section className="border-border bg-card overflow-hidden rounded-2xl border">
        <div className="bg-muted relative aspect-[5/2] w-full">
          {r.placePhoto ? (
            <SizedImage
              src={r.placePhoto}
              size="full"
              alt={r.placeName}
              fill
              sizes="(max-width: 640px) 100vw, 480px"
              className={cn("object-cover", meta.spent && "opacity-60")}
            />
          ) : null}
        </div>
        <div className="px-4 pt-3 pb-4">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-base font-semibold">{r.placeName}</p>
            <span
              className={cn(
                "type-label inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 font-semibold",
                meta.pillClass,
              )}
            >
              {meta.label}
            </span>
          </div>
          <h1
            className={cn(
              "font-display mt-3 text-2xl leading-tight font-semibold tracking-tight tabular-nums",
              meta.spent && "text-muted-foreground",
            )}
          >
            {r.when}
          </h1>
          <p className="text-muted-foreground mt-1 text-base">Table for {r.partySize}</p>
        </div>
      </section>

      {reference ? (
        <button
          type="button"
          onClick={() => void copyReference()}
          aria-label={`Copy reference ${reference}`}
          className="text-muted-foreground hover:text-foreground -mt-1 flex items-center gap-1.5 self-start px-1 text-sm tabular-nums transition"
        >
          Reference {reference}
          <Copy className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}

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

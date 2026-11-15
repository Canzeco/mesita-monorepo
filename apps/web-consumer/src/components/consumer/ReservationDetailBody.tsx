"use client";

import { Copy } from "lucide-react";
import { useState } from "react";

import type { ReservationItem } from "@/lib/reservation-types";
import { cn, errMsg } from "@/lib/utils";
import { RESERVATION_FLOW, stateMeta } from "@/lib/reservation-state";
import { ReservationActions } from "@/components/consumer/reservation-actions";
import { TicketHeader } from "@/components/consumer/activity/TicketParts";
import { PANEL_CLASS } from "@/components/shared/Panel";
import { placeHref } from "@/lib/place-route";
import {
  apiAnswerReservationChange,
  apiConfirmReservation,
} from "@/lib/api/reservations";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";

// Shared body for /reservation/[id]. Used by both the intercepted modal
// (ReservationDetailModalShell) and the hard-nav page. Stays narrow on
// purpose — the booking's lifecycle, its metadata, and the actions that can
// move it. No full place detail (that lives on /place/[id]).

// THE TICKET'S OWN HEADER (MESITA-4097, Pato: "use the same header for
// reservation tickets ... standardize design across app"): a reservation is
// a ticket like a visit, so it opens with TicketHeader, the one every ticket
// page wears: the place photo with the calendar badge, the place (a link to
// it), the table's size, the time large (where a visit puts its amount) and
// the state once, coloured. It replaced MESITA-3649's photo card. The
// reference is one quiet line under it, copied on a tap.

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
  // "Sun Nov 15 · 2:00 PM": the time is the large line, the day goes under
  // the place with the table's size.
  const day = r.when.split(" · ");
  const time = day.length > 1 ? day.pop() : null;
  async function copyReference() {
    if (!reference) return;
    try {
      await navigator.clipboard.writeText(reference);
      toast.success("Reference copied.");
    } catch {
      toast.error("Couldn't copy. The reference is " + reference + ".");
    }
  }

  const change = r.pendingChange;
  async function answerChange(accept: boolean) {
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      await apiAnswerReservationChange(supabase, {
        reservationId: r.id,
        accept,
      });
      toast.success(
        accept
          ? "Change accepted."
          : "You kept your table. Mesita tells the place.",
      );
      onChanged?.();
    } catch (e) {
      setConfirmError(errMsg(e, "Couldn't answer"));
    } finally {
      setConfirmBusy(false);
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
    <div className="flex flex-col gap-4 px-5 pt-5 pb-8">
      {/* Modular (MESITA-4115, Pato: "remember modular design ... inside
          boxes"): the ticket, its progress and its actions are three panels. */}
      <section className={cn(PANEL_CLASS, "p-4")}>
        <TicketHeader
          kind="reservation"
          photo={r.placePhoto}
          place={r.placeName}
          placeHref={placeHref(r.projectId)}
          when={[...day, `Table for ${r.partySize}`].join(" · ")}
          amount={time ?? r.when}
          state={meta.label}
          tone={r.state === "confirmed" ? "green" : meta.spent ? "grey" : "ink"}
          dim={meta.spent}
        />
      </section>

      {reference || RESERVATION_FLOW.includes(r.state) ? (
        <section className={cn(PANEL_CLASS, "flex flex-col gap-3 p-4")}>
          {reference ? (
            <button
              type="button"
              onClick={() => void copyReference()}
              aria-label={`Copy reference ${reference}`}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 self-start text-sm tabular-nums transition"
            >
              Reference {reference}
              <Copy className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}

          <LifecycleStepper state={r.state} />
        </section>
      ) : null}

      {banner && (
        <p
          className={cn(
            "type-body rounded-2xl px-3 py-2.5 leading-snug",
            r.state === "booking" ||
              r.state === "created" ||
              r.state === "failed"
              ? "bg-muted text-foreground ring-foreground ring-1"
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
            <p className="text-destructive text-xs font-medium">
              {confirmError}
            </p>
          )}
        </section>
      )}

      {change && (
        <section className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-4">
          <p className="type-body font-semibold">
            The place asks to change your table
          </p>
          <div className="flex flex-col gap-1 text-sm">
            {change.when ? (
              <p>
                <span className="text-muted-foreground">Time </span>
                <span className="tabular-nums">{r.when}</span>
                {" → "}
                <span className="font-semibold tabular-nums">
                  {change.when}
                </span>
              </p>
            ) : null}
            {change.partySize ? (
              <p>
                <span className="text-muted-foreground">Table for </span>
                {r.partySize}
                {" → "}
                <span className="font-semibold">{change.partySize}</span>
              </p>
            ) : null}
            {change.note ? (
              <p className="text-muted-foreground">“{change.note}”</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={confirmBusy}
              onClick={() => void answerChange(true)}
              className="bg-primary text-primary-foreground inline-flex h-11 flex-1 items-center justify-center rounded-full text-sm font-semibold disabled:opacity-60"
            >
              Accept
            </button>
            <button
              type="button"
              disabled={confirmBusy}
              onClick={() => void answerChange(false)}
              className="border-border hover:bg-muted inline-flex h-11 flex-1 items-center justify-center rounded-full border text-sm font-semibold disabled:opacity-60"
            >
              Decline
            </button>
          </div>
          {confirmError && (
            <p className="text-destructive text-xs font-medium">
              {confirmError}
            </p>
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

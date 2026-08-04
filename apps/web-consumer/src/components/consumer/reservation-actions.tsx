"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Loader2, MapPin, XCircle } from "lucide-react";

import {
  LocalDialog,
  LocalSheet,
} from "@/components/consumer/overlay/LocalOverlay";
import {
  buildDateOptions,
  firstOpenDate,
  ReservationDatePicker,
  ReservationPartyPicker,
  ReservationTimePicker,
  resolveSlot,
} from "@/components/consumer/reservation-pickers";
import {
  apiCancelReservation,
  apiUpdateReservation,
} from "@/lib/api/reservations";
import type { ReservationItem } from "@/lib/mock/reservations-mock";
import { placeHref } from "@/lib/place-route";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import {
  ERROR_BOX_CLASS,
  SHEET_BODY_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import { cn, errMsg, guestNoun } from "@/lib/utils";
import { MX_OFFSET, venueDateTime } from "@/lib/venue-time";

// Action cluster for reservation detail. The two that MOVE the ticket —
// reschedule and cancel — are live: each hits its consumer-web-* EF, and a
// reschedule sends the ticket back to `booking` because Mesita has to ask the
// venue again. `onChanged` lets the detail view refetch so the phase, banner
// and available actions update in place.

const DATE_WINDOW = 14;
const DEFAULT_TIME = "20:00";

// The venue's wall clock (CDMX) — the pickers speak local date + HH:mm, and
// @/lib/venue-time owns the offset for the whole app.
function localDate(iso: string | undefined): string {
  return (iso ? venueDateTime(iso)?.date : "") ?? "";
}

function localTime(iso: string | undefined): string {
  return (iso ? venueDateTime(iso)?.time : DEFAULT_TIME) ?? DEFAULT_TIME;
}

export function ReservationActions({
  r,
  onChanged,
}: {
  r: ReservationItem;
  onChanged?: () => void;
}) {
  const supabase = useBrowserSupabase();
  const dateOptions = useMemo(() => buildDateOptions(DATE_WINDOW), []);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seeded from the current booking so "just move it an hour" is two taps.
  const [dateChoice, setDateChoice] = useState(() => localDate(r.reservedAt));
  const [timeChoice, setTimeChoice] = useState(() => localTime(r.reservedAt));
  const [party, setParty] = useState(r.partySize);

  // Derived, never stored: the seeded slot can already be behind the venue's
  // clock (tonight's table, rescheduled inside the 4h grace), so fall through
  // to the first slot that's still ahead of it.
  const date =
    dateOptions.find((d) => d.iso === dateChoice && !d.disabled)?.iso ??
    firstOpenDate(dateOptions);
  const time = resolveSlot(date, timeChoice);

  const canReschedule = r.canReschedule ?? false;
  const canCancel = r.canCancel ?? false;

  async function submitReschedule() {
    if (busy || !date || !time) return;
    setBusy(true);
    setError(null);
    try {
      await apiUpdateReservation(supabase, {
        reservationId: r.id,
        reservedAt: `${date}T${time}:00${MX_OFFSET}`,
        partySize: party,
      });
      setSheetOpen(false);
      toast.success("Mesita is calling the place with your new time.");
      onChanged?.();
    } catch (e) {
      setError(errMsg(e, "Couldn't update the reservation."));
    } finally {
      setBusy(false);
    }
  }

  async function submitCancel() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiCancelReservation(supabase, { reservationId: r.id });
      setConfirmOpen(false);
      toast.success("Reservation cancelled.");
      onChanged?.();
    } catch (e) {
      setError(errMsg(e, "Couldn't cancel the reservation."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <Link
        href={placeHref(r.projectId, "saved")}
        className="border-border bg-card hover:bg-muted flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition"
      >
        <span className="flex items-center gap-3">
          <span className="bg-muted text-foreground flex h-9 w-9 items-center justify-center rounded-full">
            <MapPin className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold">View place</span>
        </span>
        <span className="text-muted-foreground text-[12px]">
          Details, map, menu
        </span>
      </Link>

      {canReschedule && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setSheetOpen(true);
          }}
          className="border-border bg-card hover:bg-muted flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition"
        >
          <span className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-full">
              <CalendarClock className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold">Reschedule</span>
          </span>
          <span className="text-muted-foreground text-[12px]">
            We call the place again
          </span>
        </button>
      )}

      {canCancel && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setConfirmOpen(true);
          }}
          className="border-border bg-card hover:bg-muted text-foreground/80 flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition"
        >
          <XCircle className="h-4 w-4" />
          Cancel reservation
        </button>
      )}

      {/* ── Reschedule ─────────────────────────────────────────────────── */}
      <LocalSheet
        open={sheetOpen}
        onClose={() => (busy ? undefined : setSheetOpen(false))}
        ariaLabel={`Reschedule at ${r.placeName}`}
      >
        <div className={SHEET_BODY_CLASS}>
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
              <CalendarClock className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className={SHEET_TITLE_CLASS}>Move your table</h2>
              <p className="text-muted-foreground truncate text-[12px]">
                {r.placeName} · now {r.when}
              </p>
            </div>
          </div>

          <p className="text-muted-foreground mt-3 text-[12.5px] leading-snug">
            Pick a new slot and Mesita calls {r.placeName} again to confirm it.
            Your table isn&apos;t moved until they say yes.
          </p>

          <div className="mt-4 flex flex-col gap-4">
            <ReservationDatePicker
              options={dateOptions}
              value={date}
              onChange={setDateChoice}
            />
            <ReservationTimePicker
              value={time}
              onChange={setTimeChoice}
              date={date}
            />
            <ReservationPartyPicker value={party} onChange={setParty} />
          </div>

          {error && <p className={cn(ERROR_BOX_CLASS, "mt-4")}>{error}</p>}

          <button
            type="button"
            onClick={submitReschedule}
            disabled={busy || !date || !time}
            className="bg-primary text-primary-foreground mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition active:scale-[0.99] disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy
              ? "Updating…"
              : !time
                ? "No times left"
                : `Ask for ${party} ${guestNoun(party)} at ${time}`}
          </button>
        </div>
      </LocalSheet>

      {/* ── Cancel ─────────────────────────────────────────────────────── */}
      <LocalDialog
        open={confirmOpen}
        onClose={() => (busy ? undefined : setConfirmOpen(false))}
        ariaLabel="Cancel this reservation"
      >
        <div className="flex flex-col gap-3 p-5 text-center">
          <span className="bg-muted text-foreground mx-auto flex h-12 w-12 items-center justify-center rounded-full">
            <XCircle className="h-5 w-5" />
          </span>
          <h2 className={SHEET_TITLE_CLASS}>Cancel this reservation?</h2>
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            {r.placeName} · {r.when}. We&apos;ll stop calling and let the place
            know. You can always book again.
          </p>

          {error && <p className={ERROR_BOX_CLASS}>{error}</p>}

          <div className="mt-1 flex flex-col gap-2">
            <button
              type="button"
              onClick={submitCancel}
              disabled={busy}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-rose-600 text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Cancelling…" : "Yes, cancel it"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={busy}
              className="border-border bg-card hover:bg-muted inline-flex h-11 w-full items-center justify-center rounded-full border text-sm font-semibold transition disabled:opacity-60"
            >
              Keep it
            </button>
          </div>
        </div>
      </LocalDialog>
    </section>
  );
}

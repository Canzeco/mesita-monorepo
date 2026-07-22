"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, Loader2, PhoneCall } from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  buildDateOptions,
  ReservationDatePicker,
  ReservationPartyPicker,
  ReservationTimePicker,
} from "@/components/consumer/reservation-pickers";
import { apiCreateReservation } from "@/lib/api/reservations";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { SHEET_BODY_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import type { PlaceDetail } from "@/lib/mock/place";
import { cn } from "@/lib/utils";

const DATE_WINDOW = 14; // two weeks of pills
const DEFAULT_TIME = "20:00";
const DEFAULT_PARTY = 2;
// Mexico City is UTC-6 year-round (no DST since 2022). The picked slot is the
// venue's wall-clock, so we stamp that offset — the agent reads the time back
// in America/Mexico_City and it matches what the guest chose.
const MX_OFFSET = "-06:00";

export function ReservationSheet({
  place,
  open,
  onClose,
}: {
  place: PlaceDetail;
  open: boolean;
  onClose: () => void;
}) {
  const supabase = useBrowserSupabase();
  const dateOptions = useMemo(() => buildDateOptions(DATE_WINDOW), []);

  const [date, setDate] = useState(dateOptions[0]?.iso ?? "");
  const [time, setTime] = useState(DEFAULT_TIME);
  const [party, setParty] = useState(DEFAULT_PARTY);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const chosen = dateOptions.find((d) => d.iso === date);
  const whenLabel = chosen
    ? `${chosen.weekday === "Today" || chosen.weekday === "Tom." ? chosen.weekday : `${chosen.weekday} ${chosen.day}`} · ${time}`
    : time;

  function handleClose() {
    onClose();
    // Reset the transient states so a re-open starts clean; keep the picked
    // slot so a mistap doesn't lose the selection.
    setDone(false);
    setError(null);
    setSubmitting(false);
  }

  async function submit() {
    if (!date || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiCreateReservation(supabase, {
        projectId: place.id,
        reservedAt: `${date}T${time}:00${MX_OFFSET}`,
        partySize: party,
        notes,
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't request the reservation.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <LocalSheet open={open} onClose={handleClose} ariaLabel={`Reserve at ${place.name}`}>
      <div className={SHEET_BODY_CLASS}>
        {done ? (
          <div className="py-2 text-center">
            <span className="bg-primary/10 text-primary mx-auto flex h-14 w-14 items-center justify-center rounded-full">
              <PhoneCall className="h-6 w-6" />
            </span>
            <h2 className={cn(SHEET_TITLE_CLASS, "mt-4")}>Reservation requested</h2>
            <p className="text-muted-foreground mx-auto mt-2 max-w-xs text-[13px] leading-relaxed">
              Mesita is calling <span className="text-foreground font-medium">{place.name}</span> to
              book your table for {party} on {whenLabel}. We&apos;ll update this reservation once the
              place confirms.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="bg-primary text-primary-foreground mt-6 inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold transition active:scale-[0.99]"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
                <CalendarCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className={SHEET_TITLE_CLASS}>Reserve a table</h2>
                <p className="text-muted-foreground truncate text-[12px]">
                  {place.name} · Mesita calls the place for you
                </p>
              </div>
            </div>

            <ReservationDatePicker options={dateOptions} value={date} onChange={setDate} />
            <ReservationTimePicker value={time} onChange={setTime} />
            <ReservationPartyPicker value={party} onChange={(u) => setParty(u)} />

            <div className="mt-4">
              <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
                Notes for the place{" "}
                <span className="tracking-normal normal-case">(optional)</span>
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={280}
                placeholder="Birthday, terrace seating, high chair…"
                className="border-border bg-card focus:border-foreground/40 mt-2 w-full resize-none rounded-2xl border px-4 py-3 text-sm outline-none"
              />
            </div>

            {error && (
              <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-[13px] font-medium text-red-600">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={submitting || !date}
              className="bg-primary text-primary-foreground mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition active:scale-[0.99] disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Requesting…
                </>
              ) : (
                `Request reservation · ${whenLabel}`
              )}
            </button>
            <p className="text-muted-foreground mt-2 text-center text-[11px]">
              Mesita&apos;s AI agent calls the place to book — you&apos;ll be notified.
            </p>
          </>
        )}
      </div>
    </LocalSheet>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Minus, Plus, Check } from "lucide-react";
import { useReservationActions } from "@/lib/reservations";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// Mock reservation sheet — opens from the venue ActionBar's Reserve table
// (and Save+reserve) and lets the consumer pick a date, a time, and a
// party size. Confirm persists the booking to the localStorage reservations
// store and surfaces a toast that deep-links to /saved Reservations.
//
// Layout is a full-modal "bottom sheet on top of the existing venue modal".
// We render at z-[60] (one above VenueDetailModalShell's z-50) and rely on
// the venue's slide-in animation already covering the page underneath; the
// sheet itself fades in.

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// 30-min slots from 6pm to 11pm — the realistic dinner window. Lunch +
// brunch slots arrive when the slot config moves to per-venue data.
const TIME_SLOTS = [
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
  "22:00",
  "22:30",
  "23:00",
];

const MIN_PARTY = 1;
const MAX_PARTY = 12;

type DateOption = { iso: string; weekday: string; day: number; month: string };

function buildDateOptions(count: number): DateOption[] {
  const out: DateOption[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push({
      iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      weekday: i === 0 ? "Today" : i === 1 ? "Tom." : DAY_NAMES[d.getDay()],
      day: d.getDate(),
      month: MONTH_NAMES[d.getMonth()],
    });
  }
  return out;
}

export function ReservationSheet({
  venueId,
  venueName,
  open,
  onClose,
}: {
  venueId: string;
  venueName: string;
  open: boolean;
  onClose: () => void;
}) {
  // Unmount the form when closed so reopening always starts fresh — same
  // initial date / time / party. Lets us avoid the setState-in-effect
  // anti-pattern and gives us free state reset.
  if (!open) return null;
  return (
    <ReservationSheetContent
      venueId={venueId}
      venueName={venueName}
      onClose={onClose}
    />
  );
}

function ReservationSheetContent({
  venueId,
  venueName,
  onClose,
}: {
  venueId: string;
  venueName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { add } = useReservationActions();

  const dateOptions = useMemo(() => buildDateOptions(14), []);
  const [dateIso, setDateIso] = useState<string>(dateOptions[0].iso);
  const [time, setTime] = useState<string>("20:00");
  const [partySize, setPartySize] = useState<number>(2);
  const [submitting, setSubmitting] = useState(false);

  // Escape closes the sheet, matching the venue modal's own dismiss key.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onConfirm() {
    setSubmitting(true);
    // Tiny artificial latency so the success state doesn't read as a
    // no-op — once the EF call lands the spinner is real anyway.
    setTimeout(() => {
      add({ venueId, venueName, date: dateIso, time, partySize });
      const prettyDate = (() => {
        const opt = dateOptions.find((d) => d.iso === dateIso);
        if (!opt) return dateIso;
        return `${opt.weekday} ${opt.month} ${opt.day}`;
      })();
      toast.action(
        `Reserved ${venueName} · ${prettyDate} · ${time} · ${partySize} guests`,
        { label: "View", onClick: () => router.push("/saved") },
        { tone: "success" },
      );
      onClose();
    }, 400);
  }

  return (
    <div
      className="animate-in fade-in absolute inset-0 z-[60] flex items-end justify-center bg-black/60 duration-200"
      onClick={(e) => {
        // Clicking the backdrop dismisses; clicks inside the sheet
        // shouldn't bubble up here.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-in slide-in-from-bottom-4 bg-background border-border w-full max-w-md rounded-t-3xl border-t p-5 duration-300 ease-out">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-muted-foreground text-[10px] font-medium tracking-[0.16em] uppercase">
              Reserve table
            </p>
            <p className="font-display mt-0.5 truncate text-xl font-semibold tracking-tight">
              {venueName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="bg-muted text-foreground hover:bg-muted/70 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Date row — horizontally scrollable pills, two weeks out. */}
        <div className="mt-5">
          <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
            Date
          </p>
          <div className="scrollbar-hide -mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1">
            {dateOptions.map((d) => {
              const active = d.iso === dateIso;
              return (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => setDateIso(d.iso)}
                  className={cn(
                    "flex shrink-0 flex-col items-center rounded-2xl border px-3 py-2 transition",
                    active
                      ? "border-pink-500/40 bg-pink-500/10"
                      : "border-border bg-card",
                  )}
                >
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase",
                      active ? "text-pink-300" : "text-muted-foreground",
                    )}
                  >
                    {d.weekday}
                  </span>
                  <span
                    className={cn(
                      "font-display text-lg font-semibold tracking-tight",
                      active ? "text-foreground" : "text-foreground",
                    )}
                  >
                    {d.day}
                  </span>
                  <span className="text-muted-foreground text-[9px]">
                    {d.month}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Time grid — 4 columns of 30-min slots. */}
        <div className="mt-4">
          <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
            Time
          </p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {TIME_SLOTS.map((slot) => {
              const active = slot === time;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setTime(slot)}
                  className={cn(
                    "rounded-xl border py-2 text-sm font-semibold tabular-nums transition",
                    active
                      ? "border-pink-500/40 bg-pink-500/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {slot}
                </button>
              );
            })}
          </div>
        </div>

        {/* Party-size stepper — min 1, max 12. */}
        <div className="mt-4">
          <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
            Party size
          </p>
          <div className="border-border bg-card mt-2 flex items-center justify-between rounded-2xl border p-2">
            <button
              type="button"
              onClick={() =>
                setPartySize((n) => Math.max(MIN_PARTY, n - 1))
              }
              disabled={partySize <= MIN_PARTY}
              aria-label="Decrease party size"
              className="bg-muted text-foreground hover:bg-muted/70 flex h-9 w-9 items-center justify-center rounded-full transition disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="font-display text-2xl font-semibold tracking-tight tabular-nums">
              {partySize}
            </span>
            <button
              type="button"
              onClick={() =>
                setPartySize((n) => Math.min(MAX_PARTY, n + 1))
              }
              disabled={partySize >= MAX_PARTY}
              aria-label="Increase party size"
              className="bg-muted text-foreground hover:bg-muted/70 flex h-9 w-9 items-center justify-center rounded-full transition disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Confirm — pink CTA matching the venue ActionBar's primary. */}
        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting}
          className="bg-pink-gradient shadow-glow mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.99] disabled:opacity-70"
        >
          {submitting ? (
            "Reserving…"
          ) : (
            <>
              <Check className="h-4 w-4" />
              Confirm reservation
            </>
          )}
        </button>
        <p className="text-muted-foreground mt-3 text-center text-[10px]">
          Preview — once the booking integration ships this confirms with the
          venue directly. For now the reservation lands on /saved.
        </p>
      </div>
    </div>
  );
}

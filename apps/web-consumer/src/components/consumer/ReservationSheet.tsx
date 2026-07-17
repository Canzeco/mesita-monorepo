"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Check } from "lucide-react";
import { useReservationActions } from "@/lib/reservations";
import { toast } from "@/lib/toast";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import {
  buildDateOptions,
  ReservationDatePicker,
  ReservationPartyPicker,
  ReservationTimePicker,
} from "./reservation-pickers";

// Mock reservation sheet — opens from the place ActionBar's Reserve table
// (and Save+reserve) and lets the consumer pick a date, a time, and a
// party size. Confirm persists the booking to the localStorage reservations
// store and surfaces a toast that deep-links to /saved Reservations.
//
// Layout is a full-modal "bottom sheet on top of the existing place modal".
// We render at z-[60] (one above PlaceDetailModalShell's z-50) and rely on
// the place's slide-in animation already covering the page underneath; the
// sheet itself fades in.

export function ReservationSheet({
  projectId,
  placeName,
  open,
  onClose,
}: {
  projectId: string;
  placeName: string;
  open: boolean;
  onClose: () => void;
}) {
  // Unmount the form when closed so reopening always starts fresh — same
  // initial date / time / party. Lets us avoid the setState-in-effect
  // anti-pattern and gives us free state reset.
  if (!open) return null;
  return (
    <ReservationSheetContent
      projectId={projectId}
      placeName={placeName}
      onClose={onClose}
    />
  );
}

function ReservationSheetContent({
  projectId,
  placeName,
  onClose,
}: {
  projectId: string;
  placeName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { add } = useReservationActions();

  const dateOptions = useMemo(() => buildDateOptions(14), []);
  const [dateIso, setDateIso] = useState<string>(dateOptions[0].iso);
  const [time, setTime] = useState<string>("20:00");
  const [partySize, setPartySize] = useState<number>(2);
  const [submitting, setSubmitting] = useState(false);

  // Escape closes the sheet, matching the place modal's own dismiss key.
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
      add({ projectId, placeName, date: dateIso, time, partySize });
      const prettyDate = (() => {
        const opt = dateOptions.find((d) => d.iso === dateIso);
        if (!opt) return dateIso;
        return `${opt.weekday} ${opt.month} ${opt.day}`;
      })();
      toast.action(
        `Reserved ${placeName} · ${prettyDate} · ${time} · ${partySize} guests`,
        {
          label: "View",
          onClick: () => router.push(CONSUMER_ROUTES.saved.reservations),
        },
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
              {placeName}
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

        <ReservationDatePicker
          options={dateOptions}
          value={dateIso}
          onChange={setDateIso}
        />

        <ReservationTimePicker value={time} onChange={setTime} />

        <ReservationPartyPicker value={partySize} onChange={setPartySize} />

        {/* Confirm — pink CTA matching the place ActionBar's primary. */}
        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting}
          className="bg-pink-gradient shadow-glow mt-5 flex w-full items-center justify-center gap-2 rounded-lg py-3.5 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.99] disabled:opacity-70"
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
          place directly. For now the reservation lands on /saved.
        </p>
      </div>
    </div>
  );
}

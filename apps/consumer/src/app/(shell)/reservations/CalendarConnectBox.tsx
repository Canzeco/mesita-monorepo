"use client";

import { CalendarPlus, ChevronRight } from "lucide-react";
import { toast } from "@/lib/toast";

// Promo strip at the top of /reservations pitching the calendar-sync
// integration. Tap → reveals provider choices via toast for now;
// post-MVP this opens a sheet that handles the OAuth flow per
// provider (Google, Apple iCal subscription, Outlook).
//
// Sky-tinted icon block + bg-card-soft surface so the box reads as
// helpful chrome instead of competing with the loud pink coupon /
// cashback banners elsewhere. Calendar is utility, not promo.

export function CalendarConnectBox() {
  return (
    <button
      type="button"
      onClick={() =>
        toast.action(
          "Calendar sync is coming soon — we'll auto-add reservations to Google, Apple, or Outlook.",
          { label: "Notify me", onClick: () => {} },
        )
      }
      className="border-border bg-card-soft group flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition active:scale-[0.99] hover:bg-muted/40"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 ring-1 ring-sky-500/20">
        <CalendarPlus className="h-5 w-5 text-sky-600" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
          Calendar sync
        </p>
        <p className="font-display mt-0.5 text-[15px] leading-tight font-semibold">
          Add reservations to your calendar
        </p>
        <p className="text-muted-foreground mt-0.5 text-[12px] leading-snug">
          Google · Apple · Outlook — auto-add bookings, get reminders.
        </p>
      </div>
      <ChevronRight
        className="text-muted-foreground h-5 w-5 shrink-0 transition group-hover:translate-x-0.5"
        strokeWidth={2}
      />
    </button>
  );
}

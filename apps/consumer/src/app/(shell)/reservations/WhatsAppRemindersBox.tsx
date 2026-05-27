"use client";

import { ChevronRight } from "lucide-react";
import { toast } from "@/lib/toast";

// WhatsApp reminders connector. Sits below CalendarConnectBox on
// /reservations. Sibling intent, different channel: calendar = silent
// background sync, WhatsApp = active ping when the reservation is
// close (day-before, hour-before). Both eventually drive the same
// "don't miss it" outcome but via different surfaces, so they each
// earn their own card.

export function WhatsAppRemindersBox() {
  function onConnect() {
    toast.action(
      "WhatsApp reminders are coming soon — confirmations + day-of pings on your phone.",
      { label: "Notify me", onClick: () => {} },
    );
  }
  return (
    <section className="border-border bg-card-soft flex flex-col gap-3 rounded-2xl border p-4">
      <header>
        <p className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
          Reminders
        </p>
        <p className="font-display mt-0.5 text-base font-semibold tracking-tight">
          Get reservation pings on WhatsApp
        </p>
        <p className="text-muted-foreground mt-0.5 text-[12px] leading-snug">
          Confirmations the moment a venue accepts your booking, plus a
          day-of reminder an hour before your table.
        </p>
      </header>

      <button
        type="button"
        onClick={onConnect}
        className="bg-card border-border hover:bg-muted/40 group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.99]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center">
          <WhatsAppLogo />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">WhatsApp</span>
          <span className="text-muted-foreground block truncate text-[11px]">
            Booking confirmations & day-of reminders
          </span>
        </span>
        <ChevronRight
          className="text-muted-foreground h-4 w-4 shrink-0 transition group-hover:translate-x-0.5"
          strokeWidth={2}
        />
      </button>
    </section>
  );
}

// Inline WhatsApp brand mark — green rounded square with the speech-
// bubble glyph cut out. Recognisable at 36px without needing an
// external asset.
function WhatsAppLogo() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-9 w-9"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="32" height="32" rx="6" fill="#25D366" />
      <path
        d="M22.8 9.2A9.5 9.5 0 0 0 16 6.4a9.6 9.6 0 0 0-8.3 14.4l-1 4.3 4.4-1.1a9.6 9.6 0 0 0 4.9 1.3h.0a9.6 9.6 0 0 0 6.8-16.1zM16 23.7h-.0a8 8 0 0 1-4.1-1.1l-.3-.2-2.6.7.7-2.6-.2-.3a8 8 0 1 1 6.5 3.5zm4.4-6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.5c.1-.1.2-.3.3-.4.1-.2.0-.3 0-.4l-.7-1.7c-.2-.5-.4-.4-.5-.4h-.4c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.6 2.4 3.9 3.4l1.4.5c.6.2 1.1.2 1.6.1.5-.1 1.4-.6 1.6-1.2.2-.6.2-1.1.1-1.2-.1-.1-.3-.2-.5-.3z"
        fill="#ffffff"
      />
    </svg>
  );
}

"use client";

import { ChevronRight } from "lucide-react";
import { toast } from "@/lib/toast";

// Calendar-sync card. Same shape as the WhatsApp card so the two read
// as a series: branded logo on the left, eyebrow + headline in the
// middle, chevron arrow on the right. The 3 supported providers
// (Google / Apple / Outlook) are named in the subtitle instead of
// rendered as three separate tiles — the tap reveals the per-provider
// choice via the toast for now and a sheet post-MVP.

export function CalendarConnectBox() {
  function onConnect() {
    toast.action(
      "Calendar sync is coming soon — connect Google, Apple, or Outlook to auto-add reservations.",
      { label: "Notify me", onClick: () => {} },
    );
  }
  return (
    <button
      type="button"
      onClick={onConnect}
      aria-label="Connect calendar"
      className="border-border bg-card-soft hover:bg-muted/40 group flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center">
        <GoogleCalendarLogo />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-muted-foreground block text-[9px] font-bold tracking-[0.18em] uppercase">
          Calendar sync
        </span>
        <span className="font-display block text-[13px] leading-tight font-semibold">
          Auto-add to Google, Apple, or Outlook
        </span>
      </span>
      <ChevronRight
        className="text-muted-foreground h-4 w-4 shrink-0 transition group-hover:translate-x-0.5"
        strokeWidth={2}
      />
    </button>
  );
}

// Google Calendar logo as the lead — most-used provider, immediately
// telegraphs "calendar". Apple + Outlook show up by name in the
// subtitle and on the connect sheet that opens post-tap.
function GoogleCalendarLogo() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-9 w-9"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="1" y="1" width="30" height="30" rx="6" fill="#ffffff" stroke="#dadce0" />
      <rect x="1" y="1" width="8" height="6" fill="#1A73E8" />
      <rect x="9" y="1" width="7" height="6" fill="#EA4335" />
      <rect x="16" y="1" width="7" height="6" fill="#FBBC04" />
      <rect x="23" y="1" width="8" height="6" fill="#34A853" />
      <text
        x="16"
        y="24"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill="#1A73E8"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        31
      </text>
    </svg>
  );
}

"use client";

import { toast } from "@/lib/toast";

// Calendar-sync tile. Compact vertical layout so it can sit side-by-side
// with WhatsAppRemindersBox at 50/50 width on /reservations. Branded
// Google Calendar logo leads since Google is the dominant provider; the
// "Apple, Outlook" reminder lives in the subtitle and the per-provider
// pick reveals via the connect sheet post-tap.

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
      className="border-border bg-card-soft hover:bg-muted/40 flex flex-col items-start gap-2 rounded-2xl border p-3 text-left transition active:scale-[0.99]"
    >
      <GoogleCalendarLogo />
      <span className="text-muted-foreground text-[9px] font-bold tracking-[0.18em] uppercase">
        Calendar sync
      </span>
      <span className="font-display text-[13px] leading-tight font-semibold">
        Google, Apple, Outlook
      </span>
    </button>
  );
}

// Google Calendar product mark — modern (post-2020) look: white rounded
// tile, Google-blue "31" in the center, and a colored corner accent that
// echoes the product icon (blue page corner with a tiny shadow). Avoids
// the old multi-colored top stripe in favor of a cleaner blue-heavy
// silhouette that scales down well to 40px and reads as Google's calendar
// at a glance.
function GoogleCalendarLogo() {
  return (
    <svg
      viewBox="0 0 40 40"
      className="h-9 w-9"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* White tile body */}
      <rect
        x="2"
        y="2"
        width="36"
        height="36"
        rx="6"
        fill="#FFFFFF"
        stroke="#DADCE0"
        strokeWidth="0.5"
      />
      {/* Top-right blue corner accent — folded-page silhouette */}
      <path d="M30 2 L38 2 L38 10 Z" fill="#1A73E8" />
      {/* Bottom-left green corner accent */}
      <path d="M2 30 L2 38 L10 38 Z" fill="#34A853" />
      {/* Top-left red dot, bottom-right yellow dot — subtle brand color
          touches without dominating */}
      <rect x="2" y="2" width="6" height="2" fill="#EA4335" />
      <rect x="32" y="36" width="6" height="2" fill="#FBBC04" />
      {/* "31" centered in Google blue */}
      <text
        x="20"
        y="27"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="#1A73E8"
        fontFamily="Roboto, ui-sans-serif, system-ui, sans-serif"
      >
        31
      </text>
    </svg>
  );
}

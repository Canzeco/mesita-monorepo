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

// Google Calendar product mark — faithful render of the official 2020+
// product icon. White rounded tile, bold blue "31" centered, and the
// four canonical Google brand-color edges:
//   - top    : red    (#EA4335)
//   - right  : yellow (#FBBC04)
//   - bottom : green  (#34A853)
//   - left   : blue   (#4285F4) — same hue family as the central "31"
// Each edge is a short bar starting from the corner of an adjacent side,
// so the silhouette reads as the well-known multi-color outlined tile
// you see on Android / iOS app icons and the GCal web favicon.
function GoogleCalendarLogo() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="h-9 w-9"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* White tile body */}
      <rect
        x="6"
        y="6"
        width="36"
        height="36"
        rx="2"
        fill="#FFFFFF"
        stroke="#E8EAED"
        strokeWidth="1"
      />
      {/* Top-right red corner: short horizontal red bar on top edge */}
      <rect x="24" y="6" width="18" height="3" fill="#EA4335" />
      {/* Right-side yellow corner: short vertical yellow bar on right edge */}
      <rect x="39" y="6" width="3" height="18" fill="#FBBC04" />
      {/* Bottom-right green corner: short horizontal green bar on bottom */}
      <rect x="24" y="39" width="18" height="3" fill="#34A853" />
      {/* Left-side blue corner: short vertical blue bar on left edge */}
      <rect x="6" y="24" width="3" height="18" fill="#4285F4" />
      {/* Bold "31" centered in Google blue */}
      <text
        x="24"
        y="31"
        textAnchor="middle"
        fontSize="16"
        fontWeight="700"
        fill="#1A73E8"
        fontFamily="'Google Sans', 'Product Sans', Roboto, ui-sans-serif, system-ui, sans-serif"
      >
        31
      </text>
    </svg>
  );
}

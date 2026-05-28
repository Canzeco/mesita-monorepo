"use client";

import { ChevronRight } from "lucide-react";
import { toast } from "@/lib/toast";

// Calendar-sync row. Horizontal iOS Settings–style layout — icon on the
// left, label + provider hint in the middle, chevron on the right. Sits
// stacked with WhatsAppRemindersBox inside a single grouped card on
// /reservations so the pair reads like a native settings list.

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
      className="hover:bg-muted/40 flex w-full items-center gap-3 px-3 py-3 text-left transition active:bg-muted/60"
    >
      <GoogleCalendarLogo />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-display text-[14px] leading-tight font-semibold">
          Calendar sync
        </span>
        <span className="text-muted-foreground mt-0.5 text-[12px] leading-tight">
          Google, Apple, Outlook
        </span>
      </span>
      <ChevronRight className="text-muted-foreground/70 h-4 w-4 shrink-0" />
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
      className="h-8 w-8 shrink-0"
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

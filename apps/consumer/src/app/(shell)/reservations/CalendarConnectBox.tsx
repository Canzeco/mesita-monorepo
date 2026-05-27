"use client";

import { toast } from "@/lib/toast";

// Calendar-sync card. Compact version: an eyebrow + a one-line
// affordance row with three branded provider tiles. Subtitle and
// per-tile labels gone — the metaphor "tap a logo to connect" is
// enough on its own, and the calendar tiles need to disappear once
// the user has tapped one anyway.

type ProviderId = "google" | "apple" | "outlook";

const PROVIDERS: {
  id: ProviderId;
  fullLabel: string;
  Logo: React.FC;
}[] = [
  { id: "google", fullLabel: "Google Calendar", Logo: GoogleCalendarLogo },
  { id: "outlook", fullLabel: "Outlook", Logo: OutlookLogo },
  { id: "apple", fullLabel: "Apple Calendar", Logo: AppleCalendarLogo },
];

export function CalendarConnectBox() {
  function onConnect(p: ProviderId) {
    const fullLabel = PROVIDERS.find((x) => x.id === p)?.fullLabel ?? p;
    toast.action(
      `${fullLabel} sync is coming soon — we'll auto-add reservations the moment you connect.`,
      { label: "Notify me", onClick: () => {} },
    );
  }
  return (
    <section className="border-border bg-card-soft flex items-center gap-3 rounded-2xl border p-3">
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[9px] font-bold tracking-[0.18em] uppercase">
          Calendar sync
        </p>
        <p className="font-display mt-0.5 text-[13px] leading-tight font-semibold">
          Auto-add reservations
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onConnect(p.id)}
            aria-label={`Connect ${p.fullLabel}`}
            className="bg-card border-border hover:bg-muted/40 flex h-10 w-10 items-center justify-center rounded-xl border transition active:scale-[0.97]"
          >
            <p.Logo />
          </button>
        ))}
      </div>
    </section>
  );
}

// ── Brand logos ────────────────────────────────────────────────────────

function GoogleCalendarLogo() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-7 w-7"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="1" y="1" width="30" height="30" rx="5" fill="#ffffff" stroke="#dadce0" />
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

function AppleCalendarLogo() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-7 w-7"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="1" y="1" width="30" height="30" rx="6" fill="#ffffff" stroke="#e5e7eb" />
      <text
        x="16"
        y="11"
        textAnchor="middle"
        fontSize="5"
        fontWeight="700"
        fill="#9ca3af"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        letterSpacing="0.5"
      >
        WED
      </text>
      <text
        x="16"
        y="26"
        textAnchor="middle"
        fontSize="16"
        fontWeight="500"
        fill="#FF3B30"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        31
      </text>
    </svg>
  );
}

function OutlookLogo() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-7 w-7"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="1" y="1" width="30" height="30" rx="5" fill="#0078D4" />
      <rect x="6" y="11" width="20" height="14" rx="1" fill="#ffffff" />
      <rect x="6" y="11" width="20" height="3" fill="#0078D4" />
      <line x1="11" y1="14" x2="11" y2="25" stroke="#0078D4" strokeWidth="1" />
      <line x1="16" y1="14" x2="16" y2="25" stroke="#0078D4" strokeWidth="1" />
      <line x1="21" y1="14" x2="21" y2="25" stroke="#0078D4" strokeWidth="1" />
      <line x1="6" y1="18" x2="26" y2="18" stroke="#0078D4" strokeWidth="1" />
      <line x1="6" y1="22" x2="26" y2="22" stroke="#0078D4" strokeWidth="1" />
    </svg>
  );
}

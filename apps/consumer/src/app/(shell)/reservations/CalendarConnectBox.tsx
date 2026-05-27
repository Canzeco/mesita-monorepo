"use client";

import { toast } from "@/lib/toast";

// Calendar-sync card at the top of /reservations. Three providers
// laid out as a single 3-column row of branded tiles so the surface
// stays compact and the choice is one glance, not a scroll. Each
// tile is its own button that toasts the "coming soon" state and
// will own its OAuth flow post-MVP.

type ProviderId = "google" | "apple" | "outlook";

const PROVIDERS: {
  id: ProviderId;
  label: string;
  fullLabel: string; // used in the toast for clarity
  Logo: React.FC;
}[] = [
  {
    id: "google",
    label: "Google",
    fullLabel: "Google Calendar",
    Logo: GoogleCalendarLogo,
  },
  {
    id: "outlook",
    label: "Outlook",
    fullLabel: "Outlook",
    Logo: OutlookLogo,
  },
  {
    id: "apple",
    label: "Apple",
    fullLabel: "Apple Calendar",
    Logo: AppleCalendarLogo,
  },
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
    <section className="border-border bg-card-soft flex flex-col gap-3 rounded-2xl border p-4">
      <header>
        <p className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
          Calendar sync
        </p>
        <p className="font-display mt-0.5 text-base font-semibold tracking-tight">
          Add reservations to your calendar
        </p>
        <p className="text-muted-foreground mt-0.5 text-[12px] leading-snug">
          Connect once — every booking lands on your calendar with a
          reminder the day of.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onConnect(p.id)}
            aria-label={`Connect ${p.fullLabel}`}
            className="bg-card border-border hover:bg-muted/40 flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center transition active:scale-[0.99]"
          >
            <p.Logo />
            <span className="text-[12px] font-semibold leading-tight">
              {p.label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

// ── Brand logos ────────────────────────────────────────────────────────
//
// Inline SVGs rather than asset files so the icons inherit the same
// build pipeline as everything else and the multi-color marks render
// crisply at any DPR. Stripped down to the essential brand cues —
// not pixel-accurate corporate logos.

function GoogleCalendarLogo() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-9 w-9"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* White rounded body */}
      <rect x="1" y="1" width="30" height="30" rx="5" fill="#ffffff" stroke="#dadce0" />
      {/* Four-color brand stripe at the top */}
      <rect x="1" y="1" width="8" height="6" fill="#1A73E8" />
      <rect x="9" y="1" width="7" height="6" fill="#EA4335" />
      <rect x="16" y="1" width="7" height="6" fill="#FBBC04" />
      <rect x="23" y="1" width="8" height="6" fill="#34A853" />
      {/* Date "31" in Google blue */}
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
      className="h-9 w-9"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="1" y="1" width="30" height="30" rx="6" fill="#ffffff" stroke="#e5e7eb" />
      {/* iOS calendar app stripes the weekday in muted gray + the date in red */}
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
      className="h-9 w-9"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="1" y="1" width="30" height="30" rx="5" fill="#0078D4" />
      {/* White grid suggesting a calendar */}
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

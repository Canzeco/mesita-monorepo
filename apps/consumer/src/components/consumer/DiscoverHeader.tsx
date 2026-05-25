"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Calendar, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CURRENT_USER, TIERS, tierBadgeClass } from "@/lib/consumer-data";

const CITIES = [
  "Monterrey",
  "CDMX",
  "Guadalajara",
  "Miami",
  "New York",
  "Madrid",
  "Barcelona",
  "Tokyo",
];
const DATES = [
  "Tonight",
  "Tomorrow",
  "Thu May 14",
  "Fri May 15",
  "Sat May 16",
  "Sun May 17",
];
const TIMES = [
  "6:00 PM",
  "6:30 PM",
  "7:00 PM",
  "7:30 PM",
  "8:00 PM",
  "8:30 PM",
  "9:00 PM",
  "9:30 PM",
  "10:00 PM",
];

function formatTimeShort(t: string) {
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*([AP]M)$/i);
  if (!m) return t;
  const [, h, mm, mer] = m;
  return mm && mm !== "00" ? `${h}:${mm}${mer}` : `${h}${mer}`;
}

export function DiscoverHeader() {
  const [open, setOpen] = useState<null | "city" | "when">(null);
  const [city, setCity] = useState("Monterrey");
  const [whenDate, setWhenDate] = useState("Tonight");
  const [whenTime, setWhenTime] = useState("8:00 PM");

  return (
    <div className="border-border/60 relative z-30 border-b px-3 pt-2 pb-2.5">
      <div className="flex items-center gap-2">
        <Link
          href="/profile"
          className="bg-peacock shadow-glow flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg"
          aria-label="Profile"
        >
          🦚
        </Link>
        <div className="border-border bg-card/70 flex min-w-0 flex-1 items-center gap-1 rounded-full border p-1 backdrop-blur">
          <button
            type="button"
            onClick={() => setOpen(open === "city" ? null : "city")}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-1.5 rounded-full px-3 py-1.5 text-left transition",
              open === "city" ? "bg-muted" : "hover:bg-muted/50",
            )}
          >
            <MapPin className="text-secondary h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-muted-foreground/80 text-[8px] leading-none font-medium tracking-[0.18em] uppercase">
                Where
              </div>
              <div className="font-display text-foreground mt-0.5 truncate text-[13px] leading-none font-semibold">
                {city}
              </div>
            </div>
          </button>
          <div className="bg-border/70 h-6 w-px" />
          <button
            type="button"
            onClick={() => setOpen(open === "when" ? null : "when")}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-1.5 rounded-full px-3 py-1.5 text-left transition",
              open === "when" ? "bg-muted" : "hover:bg-muted/50",
            )}
          >
            <Calendar className="text-secondary h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1">
                <span className="text-muted-foreground/80 text-[8px] leading-none font-medium tracking-[0.18em] uppercase">
                  When
                </span>
                <span className="font-display text-muted-foreground/70 truncate text-[10px] leading-none font-semibold">
                  {formatTimeShort(whenTime)}
                </span>
              </div>
              <div className="font-display text-foreground mt-0.5 truncate text-[13px] leading-none font-semibold">
                {whenDate}
              </div>
            </div>
          </button>
        </div>
        <ClassChip />
      </div>

      {open && (
        <>
          {/* Backdrop. Sits below the picker but above everything else so a
              tap outside the picker dismisses it without scrolling or
              reflowing the discover surface underneath. */}
          <button
            type="button"
            aria-label="Close picker"
            onClick={() => setOpen(null)}
            className="fixed inset-0 z-40 cursor-default bg-black/40 backdrop-blur-sm"
          />
          <div className="absolute inset-x-3 top-full z-50 mt-2">
            {open === "city" && (
              <div className="border-border bg-popover scrollbar-hide shadow-elev max-h-72 overflow-y-auto rounded-2xl border p-1">
                {CITIES.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setCity(opt);
                      setOpen(null);
                    }}
                    className={cn(
                      "hover:bg-muted/60 flex w-full items-center justify-between rounded-xl px-3 py-2 text-[13px] transition",
                      opt === city
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground",
                    )}
                  >
                    <span>{opt}</span>
                    {opt === city && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            )}

            {open === "when" && (
              <div className="border-border bg-popover shadow-elev grid grid-cols-2 gap-1.5 rounded-2xl border p-2">
                <div>
                  <div className="text-muted-foreground px-1 pb-1 text-[9px] font-medium tracking-[0.18em] uppercase">
                    Date
                  </div>
                  <div className="scrollbar-hide max-h-64 space-y-0.5 overflow-y-auto pr-0.5">
                    {DATES.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setWhenDate(d)}
                        className={cn(
                          "hover:bg-muted/60 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[12px] transition",
                          d === whenDate
                            ? "bg-muted text-foreground font-semibold"
                            : "text-muted-foreground",
                        )}
                      >
                        <span>{d}</span>
                        {d === whenDate && <Check className="h-3 w-3" />}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground px-1 pb-1 text-[9px] font-medium tracking-[0.18em] uppercase">
                    Time
                  </div>
                  <div className="scrollbar-hide max-h-64 space-y-0.5 overflow-y-auto pr-0.5">
                    {TIMES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setWhenTime(t)}
                        className={cn(
                          "hover:bg-muted/60 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[12px] transition",
                          t === whenTime
                            ? "bg-muted text-foreground font-semibold"
                            : "text-muted-foreground",
                        )}
                      >
                        <span>{t}</span>
                        {t === whenTime && <Check className="h-3 w-3" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Top-right header chip. Replaces the old QR-only square with a tier-colored
// avatar showing the user's current Mesita class (B / S / G / D). Tap still
// routes to /qr, which carries the QR and the balance — so the
// affordance is preserved and the class becomes glanceable at all times.
function ClassChip() {
  const meta = TIERS.find((t) => t.id === CURRENT_USER.tier);
  const initial = (meta?.label ?? CURRENT_USER.tier).charAt(0).toUpperCase();
  return (
    <Link
      href="/qr"
      aria-label={`My QR · Mesita ${meta?.label ?? "class"}`}
      className={cn(
        "font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-base font-bold transition hover:opacity-90",
        tierBadgeClass(CURRENT_USER.tier),
      )}
    >
      {initial}
    </Link>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { X, Tag, MapPin, Calendar, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Discovery filters, lifted out of the old inline What/Where/When band into a
// bottom sheet opened from the Filter button in the swipe action bar. State is
// local and presentational for now — wiring to real results lands with the
// search backend. Kept mounted (toggled via `open`) so selections survive a
// close.

type WhatOption = { id: string; label: string; soon: boolean };
const WHAT_OPTIONS: WhatOption[] = [
  { id: "places", label: "Places", soon: false },
  { id: "events", label: "Events", soon: true },
  { id: "services", label: "Services", soon: true },
  { id: "products", label: "Products", soon: true },
  { id: "communities", label: "Communities", soon: true },
];
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

export function FilterSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [whatId, setWhatId] = useState("places");
  const [city, setCity] = useState("Monterrey");
  const [whenDate, setWhenDate] = useState("Tonight");
  const [whenTime, setWhenTime] = useState("8:00 PM");

  const reset = () => {
    setWhatId("places");
    setCity("Monterrey");
    setWhenDate("Tonight");
    setWhenTime("8:00 PM");
  };

  return (
    <div
      aria-hidden={!open}
      className={cn(
        "fixed inset-0 z-50 transition-opacity duration-300",
        open ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm"
      />
      <div
        className={cn(
          "border-border bg-popover shadow-elev absolute inset-x-0 bottom-0 flex max-h-[82vh] flex-col rounded-t-3xl border-t transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="bg-foreground/20 mx-auto mt-2 h-1 w-10 shrink-0 rounded-full" />

        <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-3">
          <h2 className="font-display text-foreground text-lg font-semibold">
            Filters
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={reset}
              className="text-muted-foreground hover:text-foreground rounded-full px-3 py-1.5 text-xs font-medium transition"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground hover:bg-muted/60 flex h-8 w-8 items-center justify-center rounded-full transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="scrollbar-hide flex-1 space-y-5 overflow-y-auto px-4 pb-2">
          <Section icon={Tag} label="What">
            <div className="flex flex-wrap gap-2">
              {WHAT_OPTIONS.map((o) => (
                <Chip
                  key={o.id}
                  active={o.id === whatId}
                  soon={o.soon}
                  onClick={() => setWhatId(o.id)}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          </Section>

          <Section icon={MapPin} label="Where">
            <ChipRow>
              {CITIES.map((c) => (
                <Chip key={c} active={c === city} onClick={() => setCity(c)}>
                  {c}
                </Chip>
              ))}
            </ChipRow>
          </Section>

          <Section icon={Calendar} label="When">
            <ChipRow>
              {DATES.map((d) => (
                <Chip
                  key={d}
                  active={d === whenDate}
                  onClick={() => setWhenDate(d)}
                >
                  {d}
                </Chip>
              ))}
            </ChipRow>
            <ChipRow className="mt-2">
              {TIMES.map((t) => (
                <Chip
                  key={t}
                  active={t === whenTime}
                  onClick={() => setWhenTime(t)}
                >
                  {t}
                </Chip>
              ))}
            </ChipRow>
          </Section>
        </div>

        <div className="border-border/60 shrink-0 border-t p-4">
          <button
            type="button"
            onClick={onClose}
            className="bg-pink-gradient shadow-glow flex h-12 w-full items-center justify-center rounded-full text-sm font-semibold text-white"
          >
            Show places
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className="text-secondary h-3.5 w-3.5" />
        <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function ChipRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Chip({
  active,
  soon,
  onClick,
  children,
}: {
  active: boolean;
  soon?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={soon}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-medium whitespace-nowrap transition",
        soon
          ? "border-border/60 text-muted-foreground/50 cursor-not-allowed"
          : active
            ? "bg-pink-gradient border-transparent text-white shadow-sm"
            : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      {soon && (
        <span className="border-border/70 text-muted-foreground/70 ml-1.5 inline-block rounded-full border px-1.5 py-0.5 align-middle text-[9px] font-medium tracking-[0.14em] uppercase">
          Soon
        </span>
      )}
    </button>
  );
}

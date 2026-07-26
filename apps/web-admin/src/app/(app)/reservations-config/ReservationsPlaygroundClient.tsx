"use client";

import { useState } from "react";
import {
  Building2,
  CalendarClock,
  MessageSquareText,
  Phone,
  Sparkles,
  TriangleAlert,
  User,
  Users,
} from "lucide-react";
import { ErrorNote, SectionCard } from "../enricher-config/atlas-ui";
import type { ReservationsConfig } from "./catalog";

// Reservations Playground — a DRY RUN. It resolves the exact brief
// supabase-edgefunc-reservation-call would build for a booking (the number it
// would dial + the Spanish call variables) without ever placing a call. No EF,
// no Twilio/ElevenLabs spend, no config write.

// Spanish (es-MX), mirroring the EF's esDate/esTime. We echo the wall-clock the
// operator entered as-is (NO timezone conversion): the datetime-local input
// already IS the venue's local Mexico-City time, so formatting its literal
// components reproduces the agent's spoken date/time regardless of the operator's
// own browser timezone. (Setting timeZone here would shift it for anyone not on
// Mexico-City time.)
function esDate(d: Date): string {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(d);
  } catch {
    return "—";
  }
}
function esTime(d: Date): string {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return "—";
  }
}

const inputCls =
  "border-border bg-card focus:border-foreground h-9 w-full rounded-lg border px-3 text-sm outline-none";

function Labeled({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
      <span className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

export function ReservationsPlaygroundClient({
  config,
  loadError,
}: {
  config: ReservationsConfig;
  loadError: string | null;
}) {
  const [guest, setGuest] = useState("Ana López");
  const [party, setParty] = useState(2);
  const [when, setWhen] = useState("");
  const [venue, setVenue] = useState("Bar Oriente");
  const [venuePhone, setVenuePhone] = useState("");
  const [notes, setNotes] = useState("");

  const testMode = config.testCall.enabled;
  const dialNumber = testMode
    ? config.testCall.number || null
    : venuePhone.trim() || null;
  const via = testMode ? "test-mode number" : "place phone endpoint";

  const date = when ? new Date(when) : null;
  // Empty strings mean "nothing entered" — rendered as a muted placeholder, never
  // a fake literal. special_requests is what the EF actually transmits: the
  // trimmed note, or an empty string.
  const vars: { key: string; value: string }[] = [
    { key: "venue_name", value: venue.trim() || "el lugar" },
    { key: "guest_name", value: guest.trim() || "el cliente" },
    { key: "party_size", value: String(party) },
    { key: "reservation_date", value: date ? esDate(date) : "" },
    { key: "reservation_time", value: date ? esTime(date) : "" },
    { key: "special_requests", value: notes.trim() },
  ];

  return (
    <div className="space-y-6">
      {loadError && <ErrorNote message={loadError} />}

      <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3.5 text-xs text-amber-700">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <span className="font-semibold">Preview only.</span> Nothing here
          places a call, spends ElevenLabs/Twilio budget, or changes config — it
          just shows the brief the Reservationist would receive. A real “place a
          test call” trigger is a deploy-gated follow-up.
        </p>
      </div>

      <SectionCard
        icon={<CalendarClock className="text-secondary h-4 w-4" />}
        title="The booking"
        subtitle="A stand-in reservation — the guest-supplied parameters a real booking would carry into the call brief."
      >
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <Labeled icon={<User className="h-3.5 w-3.5" />} label="Guest name">
            <input
              className={inputCls}
              value={guest}
              onChange={(e) => setGuest(e.target.value)}
              placeholder="Ana López"
            />
          </Labeled>
          <Labeled icon={<Users className="h-3.5 w-3.5" />} label="Party size">
            <input
              type="number"
              min={1}
              max={20}
              className={inputCls + " tabular-nums"}
              value={party}
              onChange={(e) =>
                setParty(
                  Math.max(1, Math.min(20, Math.round(Number(e.target.value) || 1))),
                )
              }
            />
          </Labeled>
          <Labeled
            icon={<CalendarClock className="h-3.5 w-3.5" />}
            label="Date & time"
          >
            <input
              type="datetime-local"
              className={inputCls}
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </Labeled>
          <Labeled icon={<Building2 className="h-3.5 w-3.5" />} label="Venue name">
            <input
              className={inputCls}
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Bar Oriente"
            />
          </Labeled>
          <Labeled
            icon={<Phone className="h-3.5 w-3.5" />}
            label={testMode ? "Venue phone (ignored in test mode)" : "Venue phone"}
          >
            <input
              type="tel"
              className={inputCls + (testMode ? " opacity-50" : "")}
              value={venuePhone}
              disabled={testMode}
              onChange={(e) => setVenuePhone(e.target.value)}
              placeholder="+52 81 1234 5678"
            />
          </Labeled>
          <Labeled
            icon={<MessageSquareText className="h-3.5 w-3.5" />}
            label="Special requests"
          >
            <input
              className={inputCls}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="mesa afuera, cumpleaños…"
            />
          </Labeled>
        </div>
      </SectionCard>

      <SectionCard
        icon={<Sparkles className="text-secondary h-4 w-4" />}
        title="What the Reservationist would do"
        subtitle="Resolved from the booking above plus the saved config — mirroring what supabase-edgefunc-reservation-call would build."
      >
        <div className="border-border bg-muted/30 mt-4 rounded-xl border p-4">
          <p className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
            Dials
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Phone className="text-secondary h-4 w-4" />
            <span className="font-mono text-sm font-semibold">
              {dialNumber ?? "— no number resolved"}
            </span>
            <span className="text-muted-foreground border-border bg-card rounded-full border px-2 py-0.5 text-[10px] font-medium">
              via {via}
            </span>
          </div>
          {testMode ? (
            <p className="mt-2 text-xs text-amber-600">
              Test mode is ON — every reservation dials this fixed number, never
              the venue. Turn it off in Config to call real places.
            </p>
          ) : !dialNumber ? (
            <p className="mt-2 text-xs text-amber-600">
              No venue phone entered — a real booking would fall back to{" "}
              <code className="font-mono">places.phone</code>, and the call is
              skipped if that’s empty too.
            </p>
          ) : null}
          <p className="text-muted-foreground mt-2 text-xs">
            It tries up to{" "}
            <span className="text-foreground font-semibold tabular-nums">
              {config.attempts}
            </span>{" "}
            time{config.attempts === 1 ? "" : "s"} (attempt 1 immediately, the
            rest across the venue’s opening hours).
          </p>
        </div>

        <div className="mt-4">
          <p className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
            Call variables (es-MX)
          </p>
          <dl className="divide-border/60 border-border mt-2 divide-y overflow-hidden rounded-xl border">
            {vars.map((v) => (
              <div key={v.key} className="flex items-baseline gap-3 px-3 py-2">
                <dt className="text-muted-foreground w-40 shrink-0 font-mono text-xs">
                  {v.key}
                </dt>
                <dd className="min-w-0 flex-1 text-sm">
                  {v.value ? (
                    <span className="text-foreground">{v.value}</span>
                  ) : (
                    <span className="text-muted-foreground/60 italic">
                      empty — nothing sent
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-muted-foreground/80 mt-2 text-[11px]">
            Dates and times echo the venue-local (Mexico City) clock you entered,
            in Spanish — what the agent reads back to the venue.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}

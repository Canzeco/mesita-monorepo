"use client";

import { useState } from "react";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Lock,
  MessageSquareText,
  Phone,
  PhoneCall,
  Sparkles,
  Ticket,
  TriangleAlert,
  User,
  Users,
} from "lucide-react";
import { ErrorNote, SectionCard } from "../enricher-config/atlas-ui";
import { placeReservationTestCall } from "./actions";
import { looksLikePhone, type ReservationsConfig } from "./catalog";

// Reservations Playground — two modes for exercising the Reservationist:
//
//  • Fake user  — the FUNCTIONAL test path. Places a REAL Reservationist call
//    that ALWAYS dials the configured test number (never a venue), with a
//    stand-in booking as the spoken variables. It spends ElevenLabs/Twilio
//    budget and returns a live conversation_id. Backed by
//    admin-web-place-reservation-test-call.
//
//  • Actual user — the real reservation flow (creates a ticket, calls the real
//    venue). Coming soon; shown as a placeholder for now.

type Mode = "fake" | "actual";

// Spanish (es-MX), mirroring the EF's esDate/esTime. We echo the wall-clock the
// operator entered as-is (NO timezone conversion): the datetime-local input
// already IS the venue's local Mexico-City time, so formatting its literal
// components reproduces the agent's spoken date/time regardless of the operator's
// own browser timezone. (Setting timeZone here would shift it for anyone not on
// Mexico-City time.) These strings are sent verbatim to the call EF.
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

function ModeTabs({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  const tabs: {
    key: Mode;
    label: string;
    sub: string;
    icon: React.ReactNode;
    soon: boolean;
  }[] = [
    {
      key: "fake",
      label: "Fake user",
      sub: "Places a real call to the test number",
      icon: <PhoneCall className="h-4 w-4" />,
      soon: false,
    },
    {
      key: "actual",
      label: "Actual user",
      sub: "Creates a real reservation ticket",
      icon: <Ticket className="h-4 w-4" />,
      soon: true,
    },
  ];
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {tabs.map((t) => {
        const active = mode === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            aria-pressed={active}
            className={
              "flex items-start gap-3 rounded-2xl border p-4 text-left transition " +
              (active
                ? "border-secondary bg-secondary/[0.06] ring-secondary/30 ring-1"
                : "border-border bg-card hover:border-foreground/30")
            }
          >
            <span
              className={
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full " +
                (active
                  ? "bg-secondary/15 text-secondary"
                  : "bg-muted text-muted-foreground")
              }
            >
              {t.icon}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold">{t.label}</span>
                {t.soon ? (
                  <span className="text-muted-foreground bg-muted inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                    <Lock className="h-2.5 w-2.5" />
                    soon
                  </span>
                ) : (
                  <span className="bg-secondary/10 text-secondary rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                    live
                  </span>
                )}
              </span>
              <span className="text-muted-foreground mt-0.5 block text-xs">
                {t.sub}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ActualUserPanel() {
  return (
    <SectionCard
      icon={<Ticket className="text-secondary h-4 w-4" />}
      title="Actual user — coming soon"
      subtitle="The real reservation flow, triggered from here without waiting on a guest."
    >
      <div className="border-border bg-muted/30 mt-4 flex items-start gap-3 rounded-xl border p-4">
        <Lock className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
        <div className="text-sm">
          <p className="text-foreground font-medium">Not available yet.</p>
          <p className="text-muted-foreground mt-1 leading-relaxed">
            Actual-user mode will create a real reservation ticket for a guest and
            have the Reservationist call the venue’s real line over Twilio — the
            same path a guest tapping <span className="font-medium">Reserve</span>{" "}
            triggers, but launched from here. It respects the live Test-mode
            setting in Config, so it can still be exercised safely before we ring
            real venues.
          </p>
          <p className="text-muted-foreground mt-2 leading-relaxed">
            Until then, use <span className="font-medium">Fake user</span> to place
            a working test call.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

export function ReservationsPlaygroundClient({
  config,
  loadError,
}: {
  config: ReservationsConfig;
  loadError: string | null;
}) {
  const [mode, setMode] = useState<Mode>("fake");
  const [guest, setGuest] = useState("Ana López");
  const [party, setParty] = useState(2);
  const [when, setWhen] = useState("");
  const [venue, setVenue] = useState("Bar Oriente");
  const [notes, setNotes] = useState("");

  const [placing, setPlacing] = useState(false);
  const [result, setResult] = useState<
    | { ok: true; conversationId: string | null; dialed: string }
    | { ok: false; error: string }
    | null
  >(null);

  // Fake-user always dials the configured test number — never a venue. The EF
  // resolves it the same way (coerceReservationsCallConfig), so what we show here
  // is what it will dial.
  const dialNumber = config.testCall.number.trim();
  const numberValid = looksLikePhone(dialNumber);

  const date = when ? new Date(when) : null;
  const reservationDate = date ? esDate(date) : "";
  const reservationTime = date ? esTime(date) : "";

  const vars: { key: string; value: string }[] = [
    { key: "venue_name", value: venue.trim() || "el lugar" },
    { key: "guest_name", value: guest.trim() || "el cliente" },
    { key: "party_size", value: String(party) },
    { key: "reservation_date", value: reservationDate },
    { key: "reservation_time", value: reservationTime },
    { key: "special_requests", value: notes.trim() },
  ];

  const canCall = numberValid && !!date && !placing;

  async function onPlaceCall() {
    setResult(null);
    setPlacing(true);
    try {
      const r = await placeReservationTestCall({
        guest_name: guest.trim(),
        party_size: party,
        venue_name: venue.trim(),
        notes: notes.trim(),
        reservation_date: reservationDate,
        reservation_time: reservationTime,
      });
      setResult(r);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="space-y-6">
      {loadError && <ErrorNote message={loadError} />}

      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "actual" ? (
        <ActualUserPanel />
      ) : (
        <>
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3.5 text-xs text-amber-700">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-semibold">This places a real call.</span> Fake-user
              mode dials the test number over ElevenLabs/Twilio (spending real
              budget) with the stand-in booking below as the spoken variables. It
              can only ever dial the test number from Config — never a real venue —
              and it does not create a reservation ticket.
            </p>
          </div>

          <SectionCard
            icon={<CalendarClock className="text-secondary h-4 w-4" />}
            title="The booking"
            subtitle="A stand-in reservation — the guest-supplied parameters the Reservationist reads back on the call."
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
            title="What the Reservationist will do"
            subtitle="Resolved from the booking above plus the saved config — the number it dials and the Spanish variables it speaks."
          >
            <div className="border-border bg-muted/30 mt-4 rounded-xl border p-4">
              <p className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
                Dials
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Phone className="text-secondary h-4 w-4" />
                <span className="font-mono text-sm font-semibold">
                  {numberValid ? dialNumber : "— no test number configured"}
                </span>
                <span className="text-muted-foreground border-border bg-card rounded-full border px-2 py-0.5 text-[10px] font-medium">
                  via test-mode number
                </span>
              </div>
              {numberValid ? (
                <p className="mt-2 text-xs text-amber-600">
                  Fake-user mode always dials this fixed test number, never the
                  venue. Change it in Config.
                </p>
              ) : (
                <p className="mt-2 text-xs text-amber-600">
                  No valid test number is set — add an E.164 number in Config before
                  placing a call.
                </p>
              )}
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
                Dates and times echo the venue-local (Mexico City) clock you
                entered, in Spanish — what the agent reads back to the venue.
              </p>
            </div>
          </SectionCard>

          <SectionCard
            icon={<PhoneCall className="text-secondary h-4 w-4" />}
            title="Place the test call"
            subtitle="Dials the test number for real and hands the booking above to the Reservationist."
          >
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onPlaceCall}
                disabled={!canCall}
                className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
              >
                {placing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Placing call…
                  </>
                ) : (
                  <>
                    <PhoneCall className="h-3.5 w-3.5" />
                    Place test call
                  </>
                )}
              </button>
              {numberValid && (
                <span className="text-muted-foreground text-xs">
                  Dials <span className="text-foreground font-mono">{dialNumber}</span>
                </span>
              )}
            </div>

            {!numberValid ? (
              <p className="text-muted-foreground mt-3 text-xs">
                Set a valid test number in the Config tab to enable this.
              </p>
            ) : !date ? (
              <p className="text-muted-foreground mt-3 text-xs">
                Pick a date &amp; time first — the agent needs it to book.
              </p>
            ) : null}

            {result?.ok && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-3.5 text-xs text-emerald-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold">Call placed.</p>
                  <p className="mt-0.5">
                    Dialing <span className="font-mono">{result.dialed}</span>
                    {result.conversationId ? (
                      <>
                        {" "}
                        · conversation{" "}
                        <span className="font-mono break-all">
                          {result.conversationId}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
            )}
            {result && !result.ok && (
              <div className="mt-4">
                <ErrorNote message={result.error} />
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}

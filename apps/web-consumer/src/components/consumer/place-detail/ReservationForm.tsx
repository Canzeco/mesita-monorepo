"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Loader2, PhoneCall } from "lucide-react";

import {
  buildDateOptions,
  ClosedSlotNotice,
  firstOpenDate,
  ReservationDatePicker,
  ReservationPartyPicker,
  ReservationTimePicker,
} from "@/components/consumer/reservation-pickers";
import {
  apiCreateReservation,
  apiUpdateReservation,
  type EFReservationRow,
} from "@/lib/api/reservations";
import { EFError } from "@/lib/api/_invoke";
import { apiFetchConsumerProfile } from "@/lib/api/profile";
import { parseHoursTable, resolveSlot } from "@/lib/reservation-slots";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { cn, errMsg, guestNoun } from "@/lib/utils";
import { MX_OFFSET, placeDateTime } from "@mesita/place-profile/lib/place-time";

const DEFAULT_PARTY = 2;

// consumer-web-create-reservation refuses a booking past the guest's monthly
// cap with this code and this message (_shared/reservation-cap.ts); change the
// two together.
const RESERVATION_LIMIT_CODE = "reservation_limit_reached";
const RESERVATION_LIMIT_MESSAGE =
  "You've reached this month's reservation limit.";

// The guest already holds a live table here at that time
// (_shared/reservation-create.ts); the server's message is shown as is.
const ALREADY_RESERVED_CODE = "already_reserved";

// MX_OFFSET (and everything else about the place's clock) lives in
// @/lib/place-time — the single source of truth. The picked slot is the
// place's wall-clock, so we stamp that offset: the agent reads the time back
// in America/Mexico_City and it matches what the guest chose.

/**
 * Everything the form needs from a place: the place id it books against and a
 * name to show. Deliberately narrower than PlaceDetail (which structurally
 * satisfies it).
 *
 * `hours_table` rides along when the caller has it — that's what turns the
 * slot grid hours-aware. Absent, the form uses the baseline window and nothing
 * is flagged closed.
 */
export type ReservationFormPlace = {
  id: string;
  name: string;
  hours_table?: Array<{ day: string; range: string }>;
};

// What to do when the guest already holds a live table here.
//   null         → they haven't answered the banner yet; submit stays locked
//   "another"    → book a second table (normal create flow)
//   "reschedule" → move the existing booking instead of creating a twin
type DuplicateChoice = "another" | "reschedule";

function resolveSubmitLabel(args: {
  checking: boolean;
  awaitingChoice: boolean;
  time: string | null;
  rescheduling: boolean;
  whenLabel: string;
}): string {
  if (args.checking) return "Checking your reservations…";
  if (args.awaitingChoice) return "Choose an option above";
  if (!args.time) return "No times left";
  return args.rescheduling
    ? `Move my table · ${args.whenLabel}`
    : `Reserve · ${args.whenLabel}`;
}

/**
 * THE RESERVE FORM (MESITA-3609): the body of the old Reserve sheet, now
 * drawn by the full Reserve page (/place/<id>/reserve), which owns the list
 * of the guest's tables here and hands the first one in as `existing` for
 * the duplicate guard (reschedule vs another).
 */
export function ReservationForm({
  place,
  existing,
  checking,
  onBooked,
  onDone,
}: {
  place: ReservationFormPlace;
  /** The guest's live table at THIS place, if any (the duplicate guard). */
  existing: EFReservationRow | null;
  /** The page is still reading the guest's tables: submit waits. */
  checking: boolean;
  /** A booking or a move landed: the page re-reads its list. */
  onBooked: () => void;
  /** The confirmation's Done. */
  onDone: () => void;
}) {
  const supabase = useBrowserSupabase();

  // Null when the place has no usable hours — the grid falls back to the
  // baseline window and nothing is flagged closed.
  const hours = useMemo(
    () => parseHoursTable(place.hours_table),
    [place.hours_table],
  );

  // Recomputed every render (one month of tiny objects) rather than memoised:
  // the page can sit open across midnight, and a stale "Today" pill would
  // offer slots that are a day gone.
  const dateOptions = buildDateOptions(hours);

  const [dateChoice, setDateChoice] = useState("");
  // Null = "no explicit pick yet", so the default lands on a slot the place is
  // actually open for instead of a hardcoded 20:00 the place may be closed at.
  const [timeChoice, setTimeChoice] = useState<string | null>(null);
  const [party, setParty] = useState(DEFAULT_PARTY);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // THE NAME THE TABLE IS UNDER (MESITA-3607, Pato: "First Name and Last
  // Name (don't prepopulate first name)"). Saved on the reservation, not the
  // profile; the last name starts as the profile's.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [choice, setChoice] = useState<DuplicateChoice | null>(null);

  // ONE REQUEST, ONE TABLE (MESITA-3619): the same booking keeps its
  // request id across retries, so a lost response or a second tap gets the
  // ticket the first one made. A changed booking is a new request.
  const request = useRef<{ key: string; id: string } | null>(null);
  function requestIdFor(key: string): string {
    if (request.current?.key !== key) {
      request.current = { key, id: crypto.randomUUID() };
    }
    return request.current.id;
  }

  // Selection is DERIVED, not stored: if the guest's pick has since passed (or
  // they switched to today late at night), we fall through to the first slot
  // that's still ahead of the place's clock. No effect, nothing to desync.
  const date =
    dateOptions.find((d) => d.iso === dateChoice && !d.disabled)?.iso ??
    firstOpenDate(dateOptions);
  const time = resolveSlot(date, timeChoice, hours);

  const chosen = dateOptions.find((d) => d.iso === date);
  const whenLabel = chosen
    ? `${chosen.weekday === "Today" || chosen.weekday === "Tom." ? chosen.weekday : `${chosen.weekday} ${chosen.day}`} · ${time ?? "—"}`
    : (time ?? "—");

  const rescheduling = choice === "reschedule" && existing !== null;
  // A found duplicate locks submit until the guest answers the banner — the
  // whole point is that a second table is never created silently.
  const awaitingChoice = existing !== null && choice === null;

  // The profile's last name seeds the field, once.
  useEffect(() => {
    let cancelled = false;
    apiFetchConsumerProfile(supabase)
      .then((r) => (r.consumer?.last_name ?? "").trim())
      .catch(() => "")
      .then((profileLast) => {
        if (!cancelled && profileLast) setLastName((v) => v || profileLast);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  /** Move the existing table: seed the pickers from what's already booked. */
  function chooseReschedule() {
    if (!existing) return;
    const seed = placeDateTime(existing.reserved_at);
    if (seed) {
      setDateChoice(seed.date);
      setTimeChoice(seed.time);
    }
    setParty(existing.party_size);
    if (existing.notes) setNotes(existing.notes);
    setChoice("reschedule");
  }

  // A new table needs both names (MESITA-3629, Pato: "first and last names
  // must be mandatory"); Reserve stays off until they are typed.
  const needsName = !rescheduling && (!firstName.trim() || !lastName.trim());

  async function submit() {
    if (!date || !time || submitting || checking || awaitingChoice) return;
    // Rescheduling moves a table that is already booked under a name, so it
    // never asks for one.
    if (!rescheduling && (!firstName.trim() || !lastName.trim())) {
      setError("Add the first and last name the table is under.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const reservedAt = `${date}T${time}:00${MX_OFFSET}`;
      if (rescheduling) {
        await apiUpdateReservation(supabase, {
          reservationId: existing.id,
          reservedAt,
          partySize: party,
          notes,
        });
      } else {
        await apiCreateReservation(supabase, {
          projectId: place.id,
          reservedAt,
          partySize: party,
          notes,
          firstName,
          lastName,
          requestId: requestIdFor(
            [place.id, reservedAt, party, notes.trim(), firstName.trim(), lastName.trim()].join("|"),
          ),
        });
      }
      setDone(true);
      onBooked();
    } catch (e) {
      if (e instanceof EFError && e.code === RESERVATION_LIMIT_CODE) {
        setError(RESERVATION_LIMIT_MESSAGE);
        return;
      }
      if (e instanceof EFError && e.code === ALREADY_RESERVED_CODE) {
        setError(errMsg(e, "You already have a reservation here at that time."));
        onBooked(); // re-read the list so the table shows above the form
        return;
      }
      const msg = errMsg(e, "");
      setError(msg || "Couldn't request the reservation.");
    } finally {
      setSubmitting(false);
    }
  }

  const submitLabel = resolveSubmitLabel({
    checking,
    awaitingChoice,
    time,
    rescheduling,
    whenLabel,
  });

  if (done) {
    return (
      <div className="py-6 text-center">
        <span className="bg-primary/10 text-primary mx-auto flex h-14 w-14 items-center justify-center rounded-full">
          <PhoneCall className="h-6 w-6" />
        </span>
        <h2 className={cn(SHEET_TITLE_CLASS, "mt-4")}>
          {rescheduling ? "Reservation updated" : "Reservation requested"}
        </h2>
        <p className="text-muted-foreground type-body mx-auto mt-2 max-w-xs leading-relaxed">
          Mesita is calling{" "}
          <span className="text-foreground font-medium">{place.name}</span>{" "}
          to {rescheduling ? "move" : "book"} your table for {party} on{" "}
          {whenLabel}. We&apos;ll update this reservation once the place
          confirms.
        </p>
        <button
          type="button"
          onClick={onDone}
          className="bg-primary text-primary-foreground mt-6 inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold transition active:scale-[0.99]"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <>
      {existing && (
        <DuplicateBanner
          existing={existing}
          choice={choice}
          onReschedule={chooseReschedule}
          onAnother={() => setChoice("another")}
          onReset={() => setChoice(null)}
        />
      )}

      <ReservationDatePicker
        options={dateOptions}
        value={date}
        onChange={setDateChoice}
      />
      <ReservationTimePicker
        value={time}
        onChange={setTimeChoice}
        date={date}
        hours={hours}
      />
      <ClosedSlotNotice
        date={date}
        time={time}
        hours={hours}
        placeName={place.name}
      />
      <ReservationPartyPicker value={party} onChange={(u) => setParty(u)} />

      {!rescheduling && (
        <div className="mt-4">
          <p className="text-muted-foreground type-label font-medium tracking-[0.14em] uppercase">
            Name
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              maxLength={60}
              placeholder="First name"
              autoComplete="off"
              aria-label="First name"
              required
              className="border-border bg-card focus:border-foreground/40 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={60}
              placeholder="Last name"
              autoComplete="family-name"
              aria-label="Last name"
              required
              className="border-border bg-card focus:border-foreground/40 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
            />
          </div>
        </div>
      )}

      <div className="mt-4">
        <p className="text-muted-foreground type-label font-medium tracking-[0.14em] uppercase">
          Notes
        </p>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={280}
          placeholder="Optional"
          aria-label="Notes"
          className="border-border bg-card focus:border-foreground/40 mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
        />
      </div>

      {error && (
        <p className="type-body bg-destructive/10 text-destructive mt-3 rounded-xl px-3 py-2 font-medium">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={submitting || checking || awaitingChoice || !time || needsName}
        className="bg-primary text-primary-foreground mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition active:scale-[0.99] disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {rescheduling ? "Updating…" : "Requesting…"}
          </>
        ) : (
          submitLabel
        )}
      </button>
      <p className="text-muted-foreground type-body mt-2 text-center">
        Mesita calls the place and tells you the answer.
      </p>
    </>
  );
}

/**
 * "You already have a table here." Shown inline above the pickers rather than
 * as a blocking dialog: the guest keeps the whole form in view and just tells
 * us which of the two things they meant.
 */
function DuplicateBanner({
  existing,
  choice,
  onReschedule,
  onAnother,
  onReset,
}: {
  existing: EFReservationRow;
  choice: DuplicateChoice | null;
  onReschedule: () => void;
  onAnother: () => void;
  onReset: () => void;
}) {
  const seed = placeDateTime(existing.reserved_at);
  const when = seed ? `${seed.date} · ${seed.time}` : "an upcoming slot";

  return (
    <div className="border-border bg-muted/50 mt-4 rounded-2xl border p-3">
      <div className="flex items-start gap-2.5">
        <span className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
          <CalendarClock className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-foreground type-body font-semibold">
            You already have a table here
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
            {when} for {existing.party_size} {guestNoun(existing.party_size)}.
          </p>
        </div>
      </div>

      {choice === null ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onReschedule}
            className="bg-primary text-primary-foreground type-body flex-1 rounded-full py-2 font-semibold transition active:scale-[0.99]"
          >
            Reschedule that one
          </button>
          <button
            type="button"
            onClick={onAnother}
            className="border-border bg-card hover:bg-muted type-body flex-1 rounded-full border py-2 font-semibold transition"
          >
            Make another
          </button>
        </div>
      ) : (
        <p className="text-muted-foreground mt-2 text-xs">
          {choice === "reschedule"
            ? "Moving your existing table."
            : "Booking a second table here."}
          <button
            type="button"
            onClick={onReset}
            className="text-foreground ml-1.5 font-semibold underline underline-offset-2"
          >
            Change
          </button>
        </p>
      )}
    </div>
  );
}

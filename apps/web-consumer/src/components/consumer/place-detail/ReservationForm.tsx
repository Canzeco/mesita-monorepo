"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Loader2, PhoneCall } from "lucide-react";

import {
  buildDateOptions,
  firstOpenDate,
  ReservationDatePicker,
  ReservationField,
  ReservationUpdatesPicker,
  ReservationPartyPicker,
  ReservationSection,
  ReservationWindowPicker,
  DEFAULT_TIME_WINDOW,
  type ReservationNotify,
  type ReservationTimeWindow,
  ReservationTimePicker,
  ReserveStepNav,
  type ReserveStep,
} from "@/components/consumer/reservation-pickers";
import {
  apiCreateReservation,
  apiUpdateReservation,
  type EFReservationRow,
} from "@/lib/api/reservations";
import { EFError } from "@/lib/api/_invoke";
import { apiFetchConsumerProfile } from "@/lib/api/profile";
import { parseHoursTable, resolveSlot } from "@/lib/reservation-slots";
import { Panel } from "@/components/shared/Panel";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { cn, errMsg, guestNoun } from "@/lib/utils";
import { placeDateTime, placeInstantIso } from "@mesita/place-profile/lib/place-time";

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

// The place's clock lives in @mesita/place-profile/lib/place-time — the single
// source of truth. The picked slot is the place's wall clock in ITS zone
// (MESITA-3626), so reserved_at carries that zone's offset ("-05:00" in
// Cancún): the agent reads the time back in the same zone and it matches
// what the guest chose.

/**
 * Everything the form needs from a place: the place id it books against and a
 * name to show. Deliberately narrower than PlaceDetail (which structurally
 * satisfies it).
 *
 * `hours_table` rides along when the caller has it: the form then offers only
 * times inside those hours (MESITA-3951). Absent, it offers the baseline
 * window.
 */
export type ReservationFormPlace = {
  id: string;
  name: string;
  hours_table?: Array<{ day: string; range: string }>;
  /** The place's IANA zone; "" or absent reads as Mexico City. */
  timezone?: string | null;
  /** The round profile picture, for the header (MESITA-4183). */
  photo?: string | null;
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
  missing: string | null;
}): string {
  if (args.checking) return "Checking your reservations…";
  if (args.awaitingChoice) return "Choose an option above";
  if (!args.time) return "No times left";
  // The button says what is missing instead of greying out mutely.
  if (args.missing) return args.missing;
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
  intro,
}: {
  place: ReservationFormPlace;
  /** Drawn at the top of the first step only (the guest's tables here). */
  intro?: React.ReactNode;
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
  // baseline window.
  const hours = useMemo(
    () => parseHoursTable(place.hours_table),
    [place.hours_table],
  );

  // Recomputed every render (one month of tiny objects) rather than memoised:
  // the page can sit open across midnight, and a stale "Today" pill would
  // offer slots that are a day gone.
  const tz = place.timezone || null;
  const dateOptions = buildDateOptions(hours, tz);

  const [dateChoice, setDateChoice] = useState("");
  // Null = "no explicit pick yet", so the default lands on a slot the place is
  // actually open for instead of a hardcoded 20:00 the place may be closed at.
  const [timeChoice, setTimeChoice] = useState<string | null>(null);
  const [party, setParty] = useState(DEFAULT_PARTY);
  const [notes, setNotes] = useState("");
  // How the guest hears back (MESITA-4187, Pato: "On Confirmation (app +
  // call me) · On Rejection (app + call me)"). The app always tells; a call
  // is something the guest asks for (MESITA-3961), so both start at app.
  const [onConfirm, setOnConfirm] = useState<ReservationNotify>("app");
  const [onReject, setOnReject] = useState<ReservationNotify>("app");
  // The number Mesita calls, from the profile; shown, never edited here.
  const [phone, setPhone] = useState("");
  const [stepAt, setStepAt] = useState(0);
  const [timeWindow, setTimeWindow] = useState<ReservationTimeWindow>(DEFAULT_TIME_WINDOW);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // THE NAME THE TABLE IS UNDER: saved on the reservation, not the profile.
  // Both names start as the profile's (MESITA-4172, Pato: "DON'T ASK ME
  // FIRST NAME AGAIN, IT WAS PROVIDED ON ONBOARDING, PREPOPULATE THOSE
  // FIELDS" — this undoes MESITA-3607's empty first name). Review shows them
  // filled and editable.
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
  const time = resolveSlot(date, timeChoice, hours, tz);

  const chosen = dateOptions.find((d) => d.iso === date);
  const dayLabel = chosen
    ? chosen.weekday === "Today"
      ? "Today"
      : dateOptions.indexOf(chosen) === 1
        ? "Tomorrow"
        : `${chosen.weekday} ${chosen.day}`
    : "";
  const whenLabel = `${dayLabel ? `${dayLabel} ` : ""}${time ?? "—"} · ${party} ${guestNoun(party)}`;

  const rescheduling = choice === "reschedule" && existing !== null;
  // A found duplicate locks submit until the guest answers the banner — the
  // whole point is that a second table is never created silently.
  const awaitingChoice = existing !== null && choice === null;

  // The profile's names seed the fields, once; a typed name wins.
  useEffect(() => {
    let cancelled = false;
    apiFetchConsumerProfile(supabase)
      .then((r) => ({
        first: (r.consumer?.first_name ?? "").trim(),
        last: (r.consumer?.last_name ?? "").trim(),
        phone: (r.consumer?.phone ?? "").trim(),
      }))
      .catch(() => ({ first: "", last: "", phone: "" }))
      .then(({ first, last, phone: number }) => {
        if (cancelled) return;
        setPhone(number);
        if (first) setFirstName((v) => v || first);
        if (last) setLastName((v) => v || last);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  /** Move the existing table: seed the pickers from what's already booked. */
  function chooseReschedule() {
    if (!existing) return;
    const seed = placeDateTime(existing.reserved_at, tz);
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
  const missing = rescheduling
    ? null
    : !firstName.trim()
      ? "Add your first name"
      : !lastName.trim()
        ? "Add your last name"
        : null;

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
      const reservedAt = placeInstantIso(date, time, tz);
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
          guestNotify: onReject,
          confirmNotify: onConfirm,
          firstName,
          lastName,
          timeWindowMinutes: timeWindow,
          requestId: requestIdFor(
            [place.id, reservedAt, party, notes.trim(), firstName.trim(), lastName.trim(), onConfirm, onReject, timeWindow].join("|"),
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
        setError(errMsg(e, "You already have a reservation here. Change or cancel it first."));
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
    missing,
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
          to {rescheduling ? "move" : "book"} your table for {party}{" "}
          {guestNoun(party)}, {dayLabel ? `${dayLabel} ` : ""}at {time ?? "—"}. We&apos;ll update this reservation once the place
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

  // THE STEPS (MESITA-4183; fields MESITA-4187, Pato's list):
  //   Time     date and time
  //   Details  people, how flexible, notes ("keep notes in second page")
  //   Preview  the name (prefilled), the phone (shown, not edited), the
  //            Updates (when booked · if we can't book you), and Reserve
  // Seating is gone ("we don't have enough info to standardize that").
  // Each fits a phone screen, in Pay's panels on the grey page.
  const steps: ReserveStep[] = ["time", "details", "preview"];
  const at = Math.min(stepAt, steps.length - 1);
  const step = steps[at];
  const last = at === steps.length - 1;
  // Next waits for the duplicate answered and a time.
  const nextBlocked = step === "time" && (checking || awaitingChoice || !time);
  const next = () => {
    if (!nextBlocked && !last) setStepAt(at + 1);
  };
  const nextLabel = checking
    ? "Checking your reservations…"
    : awaitingChoice
      ? "Choose an option above"
      : !time
        ? "No times left"
        : step === "time"
          ? `Next · ${dayLabel ? `${dayLabel} ` : ""}${time}`
          : `Next · ${whenLabel}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4">
      {/* The step bar in its own panel, as on Pay (PayTop). */}
      <Panel className="mt-3">
        <ReserveStepNav
          steps={steps}
          at={at}
          onBack={at > 0 ? () => setStepAt(at - 1) : undefined}
          onNext={!last && !nextBlocked ? next : undefined}
        />
      </Panel>

      {/* One step a screen, nothing to scroll on a phone; the body scrolls
          only if a very short screen cannot hold it. */}
      <div className="scrollbar-thin-dark -mx-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        {step === "time" && (
          <>
            {intro}
            {existing && (
              <DuplicateBanner
                existing={existing}
                tz={tz}
                choice={choice}
                onReschedule={chooseReschedule}
                onAnother={() => setChoice("another")}
                onReset={() => setChoice(null)}
              />
            )}
            <ReservationDatePicker options={dateOptions} value={date} onChange={setDateChoice} />
            <ReservationTimePicker value={time} onChange={setTimeChoice} date={date} hours={hours} tz={tz} />
          </>
        )}

        {step === "details" && (
          <>
            <ReservationPartyPicker value={party} onChange={(u) => setParty(u)} />
            {!rescheduling && (
              <ReservationWindowPicker value={timeWindow} onChange={setTimeWindow} time={time} />
            )}
            <ReservationSection title="Notes">
              <ReservationField
                label="Optional"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={280}
                placeholder="Allergies, a birthday, a high chair…"
              />
            </ReservationSection>
          </>
        )}

        {step === "preview" && (
          <>
            {!rescheduling && (
              <ReservationSection title="Your details">
                <div className="grid grid-cols-2 gap-2">
                  <ReservationField
                    label="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    maxLength={60}
                    autoComplete="given-name"
                    required
                  />
                  <ReservationField
                    label="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    maxLength={60}
                    autoComplete="family-name"
                    required
                  />
                </div>
                {/* The number Mesita calls (MESITA-4187: "prepopulated,
                    cannot be edited"); it changes on Me, not here. */}
                <ReservationField
                  label="Phone"
                  className="mt-3"
                  value={phone || "No phone on your profile"}
                  readOnly
                  aria-readonly
                  tabIndex={-1}
                />
              </ReservationSection>
            )}
            {!rescheduling && (
              <ReservationUpdatesPicker
                onConfirm={onConfirm}
                onReject={onReject}
                setConfirm={setOnConfirm}
                setReject={setOnReject}
              />
            )}
          </>
        )}
      </div>

      {/* The step's one button, pinned (Pay's footer). */}
      <div className="border-border -mx-4 shrink-0 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {error && last && (
          <p className="type-body bg-destructive/10 text-destructive mb-3 rounded-xl px-3 py-2 font-medium">
            {error}
          </p>
        )}
        {last ? (
          <button
            type="button"
            onClick={submit}
            disabled={submitting || checking || awaitingChoice || !time || needsName}
            className="bg-primary text-primary-foreground inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold transition active:scale-[0.99] disabled:opacity-50"
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
        ) : (
          <button
            type="button"
            onClick={next}
            disabled={nextBlocked}
            className="bg-primary text-primary-foreground inline-flex h-14 w-full items-center justify-center rounded-2xl text-base font-semibold transition active:scale-[0.99] disabled:opacity-50"
          >
            {nextLabel}
          </button>
        )}
        {last && (
          <p className="text-muted-foreground type-body mt-2 text-center">
            Mesita calls the place for you and tells you the answer.
          </p>
        )}
      </div>
    </div>
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
  tz,
}: {
  existing: EFReservationRow;
  tz: string | null;
  choice: DuplicateChoice | null;
  onReschedule: () => void;
  onAnother: () => void;
  onReset: () => void;
}) {
  const seed = placeDateTime(existing.reserved_at, tz);
  const when = seed ? `${seed.date} · ${seed.time}` : "an upcoming slot";

  return (
    <div className="border-border bg-card shrink-0 rounded-2xl border p-4">
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

"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarClock, Loader2, PhoneCall } from "lucide-react";

import { clearSwipeProgress } from "@/components/consumer/home/swipe/swipe-deck-storage";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
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
  apiListReservations,
  apiUpdateReservation,
  type EFReservationRow,
} from "@/lib/api/reservations";
import { parseHoursTable, resolveSlot } from "@/lib/reservation-slots";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { SHEET_BODY_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { cn, errMsg, guestNoun } from "@/lib/utils";
import { MX_OFFSET, placeDateTime } from "@/lib/place-time";

const DEFAULT_PARTY = 2;

// MX_OFFSET (and everything else about the place's clock) lives in
// @/lib/place-time — the single source of truth. The picked slot is the
// place's wall-clock, so we stamp that offset: the agent reads the time back
// in America/Mexico_City and it matches what the guest chose.

/**
 * Everything the sheet needs from a place: the project id it books against and
 * a name to show. Deliberately narrower than PlaceDetail (which structurally
 * satisfies it) so the swipe deck can open this straight from a deck card,
 * without fetching the full place-detail payload.
 *
 * `hours_table` rides along when the caller has it (the detail page does; a deck
 * card doesn't) — that's what turns the slot grid hours-aware. Absent, the sheet
 * behaves exactly as before: baseline window, no closed-hours warning.
 */
type ReservationSheetPlace = {
  id: string;
  name: string;
  hours_table?: Array<{ day: string; range: string }>;
};

// What to do when the guest already holds a live table here.
//   null         → they haven't answered the banner yet; submit stays locked
//   "another"    → book a second table (normal create flow)
//   "reschedule" → move the existing ticket instead of creating a twin
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
    : `Request reservation · ${args.whenLabel}`;
}

export function ReservationSheet({
  place,
  open,
  onClose,
}: {
  place: ReservationSheetPlace;
  open: boolean;
  onClose: () => void;
}) {
  const supabase = useBrowserSupabase();

  // Null when the place has no usable hours — the grid falls back to the
  // baseline window and nothing is flagged closed.
  const hours = useMemo(
    () => parseHoursTable(place.hours_table),
    [place.hours_table],
  );

  // Recomputed every render (one month of tiny objects) rather than memoised:
  // the sheet can sit mounted across midnight, and a stale "Today" pill would
  // offer slots that are a day gone — and a stale last pill would sit a day
  // beyond the one-month horizon.
  const dateOptions = buildDateOptions(hours);

  const [dateChoice, setDateChoice] = useState("");
  // Null = "no explicit pick yet", so the default lands on a slot the place is
  // actually open for instead of a hardcoded 20:00 the place may be closed at.
  const [timeChoice, setTimeChoice] = useState<string | null>(null);
  const [party, setParty] = useState(DEFAULT_PARTY);
  const [notes, setNotes] = useState("");
  const [guestNotify, setGuestNotify] = useState<"call" | "app">("call");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Duplicate guard: the caller's live booking at THIS place, if any.
  const [checking, setChecking] = useState(false);
  const [existing, setExisting] = useState<EFReservationRow | null>(null);
  const [choice, setChoice] = useState<DuplicateChoice | null>(null);

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

  // Look for a live booking at this place whenever the sheet opens. `upcoming`
  // is exactly "active" server-side: consumer-web-list-reservations filters to
  // status pending|confirmed AND reserved_at >= now - 4h, so cancelled,
  // declined, unreachable and long-gone tickets never come back.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setChecking(true);
      try {
        const { reservations } = await apiListReservations(supabase, {
          scope: "upcoming",
          limit: 100,
        });
        // place.id is places.id == projects.id, the same id the list EF
        // stitches onto each row via attachPlaces.
        const hit = reservations.find((r) => r.place?.id === place.id) ?? null;
        if (!cancelled) setExisting(hit);
      } catch {
        // Fail OPEN: a flaky list read must not block someone from booking.
        // Worst case is the pre-existing behaviour (a possible second ticket).
        if (!cancelled) setExisting(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, place.id, supabase]);

  function handleClose() {
    onClose();
    // Reset the transient states so a re-open starts clean; keep the picked
    // slot so a mistap doesn't lose the selection.
    setDone(false);
    setError(null);
    setSubmitting(false);
    setChoice(null);
    setExisting(null);
  }

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

  async function submit() {
    if (!date || !time || submitting || checking || awaitingChoice) return;
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
          guestNotify,
        });
      }
      setDone(true);
    } catch (e) {
      const msg = errMsg(e, "");
      // The card came from a cached deck whose place no longer exists (an admin
      // reset re-creates places under fresh uuids). Drop the snapshot so the
      // next mount refetches instead of re-offering the same dead card.
      if (/isn't available anymore|place_not_found/i.test(msg)) {
        clearSwipeProgress();
      }
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

  return (
    <LocalSheet
      open={open}
      onClose={handleClose}
      ariaLabel={`Reserve at ${place.name}`}
    >
      <div className={SHEET_BODY_CLASS}>
        {done ? (
          <div className="py-2 text-center">
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
              onClick={handleClose}
              className="bg-primary text-primary-foreground mt-6 inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold transition active:scale-[0.99]"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
                <CalendarCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className={SHEET_TITLE_CLASS}>
                  {rescheduling ? "Move your table" : "Reserve a table"}
                </h2>
                <p className="text-muted-foreground truncate text-xs">
                  {place.name} · Mesita calls the place for you
                </p>
              </div>
            </div>

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
            <ReservationPartyPicker
              value={party}
              onChange={(u) => setParty(u)}
            />

            <div className="mt-4">
              <p className="text-muted-foreground type-label font-medium tracking-[0.14em] uppercase">
                Notes for the place{" "}
                <span className="tracking-normal normal-case">(optional)</span>
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={280}
                placeholder="Birthday, terrace seating, high chair…"
                className="border-border bg-card focus:border-foreground/40 mt-2 w-full resize-none rounded-2xl border px-4 py-3 text-sm outline-none"
              />
            </div>

            {!rescheduling && (
              <div className="mt-4">
                <p className="text-muted-foreground type-label font-medium tracking-[0.14em] uppercase">
                  When Mesita has news
                </p>
                <div className="border-border mt-2 grid grid-cols-2 gap-2 rounded-2xl border p-1">
                  {(
                    [
                      ["call", "Call me"],
                      ["app", "App only"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setGuestNotify(key)}
                      className={
                        guestNotify === key
                          ? "bg-primary text-primary-foreground rounded-xl px-3 py-2 text-sm font-semibold"
                          : "text-muted-foreground rounded-xl px-3 py-2 text-sm font-medium"
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="type-body mt-3 rounded-xl bg-red-500/10 px-3 py-2 font-medium text-red-600">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={submitting || checking || awaitingChoice || !time}
              className="bg-primary text-primary-foreground mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition active:scale-[0.99] disabled:opacity-60"
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
            <p className="text-muted-foreground type-label mt-2 text-center">
              {guestNotify === "app"
                ? "Mesita's AI agent calls the place to book — you'll see the answer here."
                : "Mesita's AI agent calls the place to book — then calls you to confirm."}
            </p>
          </>
        )}
      </div>
    </LocalSheet>
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

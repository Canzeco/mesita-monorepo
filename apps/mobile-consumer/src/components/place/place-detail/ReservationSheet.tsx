import { AlertTriangle, CalendarClock, PhoneCall } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { TextField } from '@/components/ui/TextField';
import {
  apiCreateReservation,
  apiListReservations,
  apiUpdateReservation,
  type EFReservationRow,
} from '@/lib/api/reservations';
import {
  BOOKING_HORIZON_MONTHS,
  bookingWindowDays,
  buildSlots,
  hoursLabelForDate,
  isDateSpent,
  parseHoursTable,
  resolveSlot,
  slotState,
  weekdayName,
  type WeeklyHours,
} from '@/lib/reservation-slots';
import { errMsg, guestNoun } from '@/lib/utils';
import {
  isSlotPast,
  MX_OFFSET,
  VENUE_TZ_LABEL,
  venueDateIso,
  venueDateParts,
  venueDateTime,
} from '@/lib/venue-time';

const DEFAULT_PARTY = 2;
const MIN_PARTY_SIZE = 1;
const MAX_PARTY_SIZE = 20;

// MX_OFFSET (and everything else about the venue's clock) lives in
// @/lib/venue-time — the single source of truth. The picked slot is the
// venue's wall-clock; stamping the offset lets the agent read it back in
// America/Mexico_City and match what the guest chose.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type DateOption = {
  iso: string;
  weekday: string;
  day: number;
  /** Every slot on this day is already behind the venue's clock. */
  disabled: boolean;
};

/**
 * The next `count` days on the VENUE's calendar — not the device's. A guest in
 * Tokyo and a guest in CDMX must see the same "Today", or they'd disagree
 * about which slots are still bookable.
 *
 * `hours` only widens the day: a place open past midnight has slots the
 * baseline window doesn't cover, so a day is "spent" only when none of ITS
 * slots are left.
 */
function buildDateOptions(hours: WeeklyHours | null): DateOption[] {
  const out: DateOption[] = [];
  for (let i = 0; i < bookingWindowDays(); i += 1) {
    const iso = venueDateIso(i);
    const { weekday, day } = venueDateParts(iso);
    out.push({
      iso,
      weekday: i === 0 ? 'Today' : i === 1 ? 'Tom.' : WEEKDAYS[weekday],
      day,
      // Late at night today has nothing left. The pill stays in the row and
      // goes dead — hiding it would shift every other pill sideways.
      disabled: isDateSpent(iso, hours),
    });
  }
  return out;
}

/** First day still open for booking — the safe default / fallback. */
function firstOpenDate(options: DateOption[]): string {
  return options.find((d) => !d.disabled)?.iso ?? '';
}

function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map((n) => Number(n));
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

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
export type ReservationSheetPlace = {
  id: string;
  name: string;
  hours_table?: { day: string; range: string }[];
};

// What to do when the guest already holds a live table here.
//   null         → they haven't answered the banner yet; submit stays locked
//   "another"    → book a second table (normal create flow)
//   "reschedule" → move the existing ticket instead of creating a twin
type DuplicateChoice = 'another' | 'reschedule';

export function ReservationSheet({
  place,
  visible,
  onClose,
}: {
  place: ReservationSheetPlace;
  visible: boolean;
  onClose: () => void;
}) {
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

  const [dateChoice, setDateChoice] = useState('');
  // Null = "no explicit pick yet", so the default lands on a slot the place is
  // actually open for instead of a hardcoded 20:00 the place may be closed at.
  const [timeChoice, setTimeChoice] = useState<string | null>(null);
  const [party, setParty] = useState(DEFAULT_PARTY);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Duplicate guard: the caller's live booking at THIS place, if any.
  const [checking, setChecking] = useState(false);
  const [existing, setExisting] = useState<EFReservationRow | null>(null);
  const [choice, setChoice] = useState<DuplicateChoice | null>(null);

  // Selection is DERIVED, not stored: if the guest's pick has since passed (or
  // they switched to today late at night), we fall through to the first slot
  // that's still ahead of the venue's clock. No effect, nothing to desync.
  const date =
    dateOptions.find((d) => d.iso === dateChoice && !d.disabled)?.iso ??
    firstOpenDate(dateOptions);
  const time = resolveSlot(date, timeChoice, hours);

  const chosen = dateOptions.find((d) => d.iso === date);
  const timeText = time ? timeLabel(time) : '—';
  const whenLabel = chosen
    ? `${chosen.weekday === 'Today' || chosen.weekday === 'Tom.' ? chosen.weekday : `${chosen.weekday} ${chosen.day}`} · ${timeText}`
    : timeText;

  const rescheduling = choice === 'reschedule' && existing !== null;
  // A found duplicate locks submit until the guest answers the banner — the
  // whole point is that a second table is never created silently.
  const awaitingChoice = existing !== null && choice === null;

  // Look for a live booking at this place whenever the sheet opens. `upcoming`
  // is exactly "active" server-side: consumer-web-list-reservations filters to
  // status pending|confirmed AND reserved_at >= now - 4h, so cancelled,
  // declined, unreachable and long-gone tickets never come back.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setChecking(true);
      try {
        const { reservations } = await apiListReservations({
          scope: 'upcoming',
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
  }, [visible, place.id]);

  function handleClose() {
    onClose();
    // Reset transient state so a re-open starts clean; keep the picked slot.
    setDone(false);
    setError(null);
    setSubmitting(false);
    setChoice(null);
    setExisting(null);
  }

  /** Move the existing table: seed the pickers from what's already booked. */
  function chooseReschedule() {
    if (!existing) return;
    const seed = venueDateTime(existing.reserved_at);
    if (seed) {
      setDateChoice(seed.date);
      setTimeChoice(seed.time);
    }
    setParty(existing.party_size);
    if (existing.notes) setNotes(existing.notes);
    setChoice('reschedule');
  }

  async function submit() {
    if (!date || !time || submitting || checking || awaitingChoice) return;
    setSubmitting(true);
    setError(null);
    try {
      const reservedAt = `${date}T${time}:00${MX_OFFSET}`;
      if (rescheduling) {
        await apiUpdateReservation({
          reservationId: existing.id,
          reservedAt,
          partySize: party,
          notes,
        });
      } else {
        await apiCreateReservation({
          projectId: place.id,
          reservedAt,
          partySize: party,
          notes,
        });
      }
      setDone(true);
    } catch (e) {
      setError(errMsg(e, "Couldn't request the reservation."));
    } finally {
      setSubmitting(false);
    }
  }

  const submitLabel = checking
    ? 'Checking your reservations…'
    : awaitingChoice
      ? 'Choose an option above'
      : !time
        ? 'No times left'
        : rescheduling
          ? `Move my table · ${whenLabel}`
          : `Request · ${whenLabel}`;

  return (
    <FullScreenSheet
      visible={visible}
      onClose={handleClose}
      title={
        done
          ? rescheduling
            ? 'Reservation updated'
            : 'Reservation requested'
          : rescheduling
            ? 'Move your table'
            : 'Reserve a table'
      }
      subtitle={done ? undefined : `${place.name} · Mesita calls the place for you`}
    >
      {done ? (
        <View className="items-center py-4">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <PhoneCall color="#ec006c" size={26} />
          </View>
          <Text className="mt-4 font-display text-xl font-semibold text-foreground">
            {rescheduling ? 'Reservation updated' : 'Reservation requested'}
          </Text>
          <Text className="mt-2 max-w-xs text-center text-[13px] leading-relaxed text-muted-foreground">
            Mesita is calling{' '}
            <Text className="font-medium text-foreground">{place.name}</Text> to{' '}
            {rescheduling ? 'move' : 'book'} your table for {party}{' '}
            {guestNoun(party)} on {whenLabel}. We&apos;ll update this
            reservation once the place confirms.
          </Text>
          <View className="mt-6 w-full">
            <Button onPress={handleClose}>Done</Button>
          </View>
        </View>
      ) : (
        <>
          {existing ? (
            <DuplicateBanner
              existing={existing}
              choice={choice}
              onReschedule={chooseReschedule}
              onAnother={() => setChoice('another')}
              onReset={() => setChoice(null)}
            />
          ) : null}

          {/* Date pills — today through the one-month horizon */}
          <View>
            <Text className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Date
            </Text>
            <Text className="mb-2 text-[11px] text-muted-foreground">
              Up to {BOOKING_HORIZON_MONTHS} month ahead
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 8 }}
            >
              {dateOptions.map((d) => {
                const active = d.iso === date;
                return (
                  <Pressable
                    key={d.iso}
                    onPress={() => setDateChoice(d.iso)}
                    disabled={d.disabled}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: active,
                      disabled: d.disabled,
                    }}
                    accessibilityHint={
                      d.disabled ? 'No times left on this day' : undefined
                    }
                    style={d.disabled ? { opacity: 0.45 } : undefined}
                    className={`h-16 w-14 items-center justify-center rounded-2xl border ${
                      d.disabled
                        ? 'border-border bg-muted'
                        : active
                          ? 'border-primary bg-primary'
                          : 'border-border bg-card'
                    }`}
                  >
                    <Text
                      className={`text-[11px] font-semibold ${active && !d.disabled ? 'text-primary-foreground' : 'text-muted-foreground'}`}
                    >
                      {d.weekday}
                    </Text>
                    <Text
                      className={`text-[17px] font-bold ${
                        d.disabled
                          ? 'text-muted-foreground'
                          : active
                            ? 'text-primary-foreground'
                            : 'text-foreground'
                      }`}
                    >
                      {d.day}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Time slots — past ones stay in the grid, muted, so it never jumps.
              Slots the place's hours don't cover stay TAPPABLE and render amber:
              hours are scraped and often wrong, and Mesita books by phone, so
              the guest decides — ClosedSlotNotice below warns. */}
          <View>
            <Text className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Time
            </Text>
            <Text className="mb-2 text-[11px] text-muted-foreground">
              Times shown in {VENUE_TZ_LABEL}
              {hoursLabelForDate(date, hours)
                ? ` · open ${hoursLabelForDate(date, hours)}`
                : ''}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {buildSlots(date, hours).map((slot) => {
                const past = isSlotPast(date, slot.time);
                const active = slot.time === time && !past;
                const closed = slot.state === 'closed';
                return (
                  <Pressable
                    key={slot.time}
                    onPress={() => setTimeChoice(slot.time)}
                    disabled={past}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active, disabled: past }}
                    accessibilityHint={
                      past
                        ? 'This time has already passed'
                        : closed
                          ? 'The place looks closed at this time — you can still request it'
                          : slot.afterMidnight
                            ? 'After midnight'
                            : undefined
                    }
                    style={
                      past
                        ? { opacity: 0.45 }
                        : closed && !active
                          ? { borderStyle: 'dashed' }
                          : undefined
                    }
                    className={`rounded-xl border px-3 py-2 ${
                      past
                        ? 'border-border bg-muted'
                        : closed
                          ? active
                            ? 'border-amber-500 bg-amber-500/15'
                            : 'border-border bg-card'
                          : active
                            ? 'border-primary bg-primary'
                            : 'border-border bg-card'
                    }`}
                  >
                    <Text
                      className={`text-[13px] font-semibold ${
                        past
                          ? 'text-muted-foreground'
                          : closed
                            ? active
                              ? 'text-foreground'
                              : 'text-muted-foreground'
                            : active
                              ? 'text-primary-foreground'
                              : 'text-foreground'
                      }`}
                    >
                      {timeLabel(slot.time)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <ClosedSlotNotice
            date={date}
            time={time}
            hours={hours}
            placeName={place.name}
          />

          {/* Party stepper */}
          <View>
            <Text className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Party size
            </Text>
            <View className="flex-row items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
              <Text className="text-[15px] font-semibold text-foreground">
                {party} {guestNoun(party)}
              </Text>
              <View className="flex-row items-center gap-3">
                <Stepper
                  label="Decrease party size"
                  symbol="−"
                  disabled={party <= MIN_PARTY_SIZE}
                  onPress={() => setParty((p) => Math.max(MIN_PARTY_SIZE, p - 1))}
                />
                <Stepper
                  label="Increase party size"
                  symbol="+"
                  disabled={party >= MAX_PARTY_SIZE}
                  onPress={() => setParty((p) => Math.min(MAX_PARTY_SIZE, p + 1))}
                />
              </View>
            </View>
          </View>

          {/* Notes */}
          <TextField
            label="Notes for the place (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Birthday, terrace seating, high chair…"
            multiline
            numberOfLines={2}
            maxLength={280}
          />

          {error ? (
            <View className="rounded-xl bg-red-500/10 px-3 py-2">
              <Text className="text-[13px] font-medium text-red-600">
                {error}
              </Text>
            </View>
          ) : null}

          <Button
            onPress={submit}
            loading={submitting}
            disabled={!date || !time || checking || awaitingChoice}
          >
            {submitting
              ? rescheduling
                ? 'Updating…'
                : 'Requesting…'
              : submitLabel}
          </Button>
          <Text className="text-center text-[11px] text-muted-foreground">
            Mesita&apos;s AI agent calls the place to book — you&apos;ll be notified.
          </Text>
        </>
      )}
    </FullScreenSheet>
  );
}

/**
 * "They look closed then — request anyway?" Inline, non-blocking, and only when
 * we actually hold hours for the place: an un-enriched place has no opinion and
 * must stay silent. Web parity:
 * apps/web-consumer/src/components/consumer/reservation-pickers.tsx.
 */
function ClosedSlotNotice({
  date,
  time,
  hours,
  placeName,
}: {
  date: string;
  time: string | null;
  hours: WeeklyHours | null;
  placeName: string;
}) {
  if (!time || !date || !hours) return null;
  if (slotState(date, time, hours) !== 'closed') return null;
  const dayHours = hoursLabelForDate(date, hours);

  return (
    <View className="flex-row items-start gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-3">
      <AlertTriangle color="#d97706" size={16} />
      <Text className="flex-1 text-[12.5px] leading-snug text-amber-900">
        <Text className="font-semibold">
          {placeName} looks closed at {timeLabel(time)} on {weekdayName(date)}.
        </Text>{' '}
        {dayHours
          ? `Our hours say ${dayHours}.`
          : 'Our hours show them closed all day.'}{' '}
        You can still request it — Mesita will tell you what the place says when
        we call.
      </Text>
    </View>
  );
}

/**
 * "You already have a table here." Shown inline above the pickers rather than
 * as a blocking dialog: the guest keeps the whole form in view and just tells
 * us which of the two things they meant. Web parity:
 * apps/web-consumer/src/components/consumer/place-detail/ReservationSheet.tsx.
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
  const seed = venueDateTime(existing.reserved_at);
  const when = seed
    ? `${seed.date} · ${timeLabel(seed.time)}`
    : 'an upcoming slot';

  return (
    <View className="rounded-2xl border border-border bg-muted px-3 py-3">
      <View className="flex-row items-start gap-2.5">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <CalendarClock color="#ec006c" size={16} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] font-semibold text-foreground">
            You already have a table here
          </Text>
          <Text className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
            {when} for {existing.party_size} {guestNoun(existing.party_size)}.
          </Text>
        </View>
      </View>

      {choice === null ? (
        <View className="mt-3 flex-row gap-2">
          <Pressable
            onPress={onReschedule}
            accessibilityRole="button"
            className="flex-1 items-center rounded-full bg-primary py-2"
          >
            <Text className="text-[12.5px] font-semibold text-primary-foreground">
              Reschedule that one
            </Text>
          </Pressable>
          <Pressable
            onPress={onAnother}
            accessibilityRole="button"
            className="flex-1 items-center rounded-full border border-border bg-card py-2"
          >
            <Text className="text-[12.5px] font-semibold text-foreground">
              Make another
            </Text>
          </Pressable>
        </View>
      ) : (
        <View className="mt-2 flex-row items-center gap-1.5">
          <Text className="text-[12px] text-muted-foreground">
            {choice === 'reschedule'
              ? 'Moving your existing table.'
              : 'Booking a second table here.'}
          </Text>
          <Pressable onPress={onReset} accessibilityRole="button" hitSlop={8}>
            <Text className="text-[12px] font-semibold text-foreground underline">
              Change
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Stepper({
  label,
  symbol,
  onPress,
  disabled,
}: {
  label: string;
  symbol: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`h-9 w-9 items-center justify-center rounded-full border border-border ${
        disabled ? 'opacity-40' : 'bg-card active:bg-muted'
      }`}
    >
      <Text className="text-[18px] font-semibold text-foreground">{symbol}</Text>
    </Pressable>
  );
}

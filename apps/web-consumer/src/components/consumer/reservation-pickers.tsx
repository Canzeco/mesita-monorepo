import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  bookingWindowDays,
  buildSlots,
  isDateSpent,
  type ReservationSlot,
  type WeeklyHours,
} from "@/lib/reservation-slots";
import {
  isSlotPast,
  placeDateIso,
  placeDateParts,
} from "@mesita/place-profile/lib/place-time";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MIN_PARTY = 1;
const MAX_PARTY = 10; // Pato, MESITA-3613: "max party size must be 10"

type DateOption = {
  iso: string;
  weekday: string;
  day: number;
  month: string;
  /** Every slot on this day is already behind the place's clock. */
  disabled: boolean;
};

/**
 * Every bookable day on the place's calendar — not the device's. A guest in
 * Tokyo and a guest in CDMX must see the same "Today", or they'd disagree about
 * which slots are still bookable.
 *
 * The row spans today → BOOKING_HORIZON_MONTHS ahead and takes no count: the
 * one-month cap is not a caller's choice.
 *
 * `hours` decides the day (MESITA-3951): with them, a day the place is closed
 * has no slots and is dead. Omit them and the answer is the baseline window's.
 */
export function buildDateOptions(
  hours?: WeeklyHours | null,
  tz?: string | null,
): DateOption[] {
  const out: DateOption[] = [];
  for (let i = 0; i < bookingWindowDays(tz); i += 1) {
    const iso = placeDateIso(i, tz);
    const { weekday, day, month } = placeDateParts(iso);
    out.push({
      iso,
      weekday: i === 0 ? "Today" : i === 1 ? "Tom." : DAY_NAMES[weekday],
      day,
      month: MONTH_NAMES[month],
      // A closed day, or late at night today, has nothing left. The pill stays
      // in the row and goes dead — hiding it would shift every other pill.
      disabled: isDateSpent(iso, hours, tz),
    });
  }
  return out;
}

/** First day still open for booking — the safe default / fallback. */
export function firstOpenDate(options: DateOption[]): string {
  return options.find((d) => !d.disabled)?.iso ?? "";
}

/** Date row — horizontally scrollable pills, one month out. */
export function ReservationDatePicker({
  options,
  value,
  onChange,
}: {
  options: DateOption[];
  value: string;
  onChange: (iso: string) => void;
}) {
  return (
    <div className="mt-5">
      <p className="text-muted-foreground type-label font-medium tracking-[0.14em] uppercase">
        Day
      </p>
      <div className="scrollbar-hide -mx-5 mt-2 flex flex-nowrap gap-2 overflow-x-auto px-5 pb-1">
        {options.map((d) => {
          const active = d.iso === value;
          return (
            <button
              key={d.iso}
              type="button"
              onClick={() => onChange(d.iso)}
              disabled={d.disabled}
              aria-disabled={d.disabled}
              title={d.disabled ? "No times on this day" : undefined}
              className={cn(
                "flex w-14 shrink-0 flex-col items-center rounded-2xl border py-2 transition",
                d.disabled
                  ? "border-border bg-muted/40 text-muted-foreground cursor-not-allowed opacity-45"
                  : active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-foreground",
              )}
            >
              <span className={cn("type-meta font-semibold uppercase", !active && "text-muted-foreground")}>
                {d.weekday}
              </span>
              <span className="text-lg font-semibold tabular-nums">{d.day}</span>
              <span className={cn("type-meta", !active && "text-muted-foreground")}>{d.month}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Time picker — horizontal scroll, exactly two rows (:00 on top, :30 on
 * bottom). Slots behind the place's clock render muted + unclickable; they
 * stay in the strip so the layout never jumps.
 *
 * Only times inside the place's hours are listed (MESITA-3951); a place with
 * no hours lists the baseline window.
 */
export function ReservationTimePicker({
  value,
  onChange,
  date,
  hours,
  tz,
}: {
  value: string | null;
  onChange: (slot: string) => void;
  date?: string;
  hours?: WeeklyHours | null;
  /** The place's IANA zone (MESITA-3626): "past" is judged on its clock. */
  tz?: string | null;
}) {
  const slots = buildSlots(date ?? "", hours);
  return (
    <div className="mt-4">
      <p className="text-muted-foreground type-label font-medium tracking-[0.14em] uppercase">
        Hour
      </p>
      <div className="scrollbar-hide -mx-5 mt-2 flex flex-nowrap gap-2 overflow-x-auto px-5 pb-1">
        {slots.filter((slot) => !(date && isSlotPast(date, slot.time, tz))).map((slot) => (
          <TimeSlotButton
            key={slot.time}
            slot={slot}
            date={date}
            tz={tz}
            value={value}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
}

function TimeSlotButton({
  slot,
  date,
  tz,
  value,
  onChange,
}: {
  slot: ReservationSlot | null;
  date?: string;
  tz?: string | null;
  value: string | null;
  onChange: (slot: string) => void;
}) {
  if (!slot) {
    return <div className="h-[42px] w-full" aria-hidden />;
  }
  const past = date ? isSlotPast(date, slot.time, tz) : false;
  const active = slot.time === value && !past;
  return (
    <button
      type="button"
      onClick={() => onChange(slot.time)}
      disabled={past}
      aria-disabled={past}
      title={
        past
          ? "This time has already passed"
          : slot.afterMidnight
              ? "After midnight"
              : undefined
      }
      className={cn(
        "h-10 shrink-0 rounded-full border px-4 text-sm font-semibold tabular-nums transition",
        past
          ? "border-border bg-muted/40 text-muted-foreground cursor-not-allowed opacity-45"
          : active
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-card text-foreground",
      )}
    >
      {slot.time}
    </button>
  );
}

/** Party-size stepper — min 1, max 12. */
export function ReservationPartyPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (updater: (n: number) => number) => void;
}) {
  return (
    <div className="mt-4">
      <p className="text-muted-foreground type-label font-medium tracking-[0.14em] uppercase">
        Party size
      </p>
      <div className="border-border bg-card mt-2 flex items-center gap-4 rounded-2xl border py-2 pr-2 pl-4">
        <span className="type-body flex-1">People</span>
        <button
          type="button"
          onClick={() => onChange((n) => Math.max(MIN_PARTY, n - 1))}
          disabled={value <= MIN_PARTY}
          aria-label="Decrease party size"
          className="bg-muted text-foreground hover:bg-muted/70 flex h-9 w-9 items-center justify-center rounded-full transition disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-6 text-center text-lg font-semibold tabular-nums">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange((n) => Math.min(MAX_PARTY, n + 1))}
          disabled={value >= MAX_PARTY}
          aria-label="Increase party size"
          className="bg-muted text-foreground hover:bg-muted/70 flex h-9 w-9 items-center justify-center rounded-full transition disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

import { AlertTriangle, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BOOKING_HORIZON_MONTHS,
  bookingWindowDays,
  buildHourColumns,
  buildSlots,
  hoursLabelForDate,
  isDateSpent,
  slotState,
  weekdayName,
  type ReservationSlot,
  type WeeklyHours,
} from "@/lib/reservation-slots";
import {
  isSlotPast,
  PLACE_TZ_LABEL,
  placeDateIso,
  placeDateParts,
} from "@/lib/place-time";

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
const MAX_PARTY = 20;

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
 * `hours` only widens the day: a place open past midnight has slots the
 * baseline window doesn't cover, so a day is "spent" only when none of ITS
 * slots are left. Omit it and the answer is the baseline window's.
 */
export function buildDateOptions(hours?: WeeklyHours | null): DateOption[] {
  const out: DateOption[] = [];
  for (let i = 0; i < bookingWindowDays(); i += 1) {
    const iso = placeDateIso(i);
    const { weekday, day, month } = placeDateParts(iso);
    out.push({
      iso,
      weekday: i === 0 ? "Today" : i === 1 ? "Tom." : DAY_NAMES[weekday],
      day,
      month: MONTH_NAMES[month],
      // Late at night today has nothing left. The pill stays in the row and
      // goes dead — hiding it would shift every other pill sideways.
      disabled: isDateSpent(iso, hours),
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
      <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
        Date
      </p>
      <p className="text-muted-foreground mt-1 text-[11px]">
        Up to {BOOKING_HORIZON_MONTHS} month ahead
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
              title={d.disabled ? "No times left on this day" : undefined}
              className={cn(
                "flex shrink-0 flex-col items-center rounded-2xl border px-3 py-2 transition",
                d.disabled
                  ? "border-border bg-muted/40 cursor-not-allowed opacity-45"
                  : active
                    ? "border-pink-500/40 bg-pink-500/10"
                    : "border-border bg-card",
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase",
                  active && !d.disabled
                    ? "text-pink-300"
                    : "text-muted-foreground",
                )}
              >
                {d.weekday}
              </span>
              <span
                className={cn(
                  "font-display text-lg font-semibold tracking-tight",
                  d.disabled ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {d.day}
              </span>
              <span className="text-muted-foreground text-[9px]">
                {d.month}
              </span>
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
 * Slots the place's hours don't cover stay TAPPABLE and render dashed/amber:
 * hours are scraped and often wrong, and Mesita books by phone, so the guest
 * decides — the sheet warns via ClosedSlotNotice.
 */
export function ReservationTimePicker({
  value,
  onChange,
  date,
  hours,
}: {
  value: string | null;
  onChange: (slot: string) => void;
  date?: string;
  hours?: WeeklyHours | null;
}) {
  const columns = buildHourColumns(buildSlots(date ?? "", hours));
  const dayHours = date ? hoursLabelForDate(date, hours) : null;
  return (
    <div className="mt-4">
      <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
        Time
      </p>
      <p className="text-muted-foreground mt-1 text-[11px]">
        Times shown in {PLACE_TZ_LABEL}
        {dayHours ? ` · open ${dayHours}` : ""}
      </p>
      <div className="scrollbar-hide -mx-5 mt-2 overflow-x-auto px-5 pb-1">
        <div className="inline-flex flex-nowrap gap-2">
          {columns.map((col) => (
            <div key={col.hour} className="flex w-[4.5rem] shrink-0 flex-col gap-2">
              <TimeSlotButton
                slot={col.onHour}
                date={date}
                value={value}
                onChange={onChange}
              />
              <TimeSlotButton
                slot={col.onHalf}
                date={date}
                value={value}
                onChange={onChange}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TimeSlotButton({
  slot,
  date,
  value,
  onChange,
}: {
  slot: ReservationSlot | null;
  date?: string;
  value: string | null;
  onChange: (slot: string) => void;
}) {
  if (!slot) {
    return <div className="h-[42px] w-full" aria-hidden />;
  }
  const past = date ? isSlotPast(date, slot.time) : false;
  const active = slot.time === value && !past;
  const closed = slot.state === "closed";
  return (
    <button
      type="button"
      onClick={() => onChange(slot.time)}
      disabled={past}
      aria-disabled={past}
      title={
        past
          ? "This time has already passed"
          : closed
            ? "The place looks closed at this time — you can still request it"
            : slot.afterMidnight
              ? "After midnight"
              : undefined
      }
      className={cn(
        "h-[42px] w-full rounded-xl border text-sm font-semibold tabular-nums transition",
        past
          ? "border-border bg-muted/40 text-muted-foreground cursor-not-allowed opacity-45"
          : closed
            ? active
              ? "text-foreground border-amber-500/70 bg-amber-500/15"
              : "border-border bg-card text-muted-foreground hover:text-foreground border-dashed"
            : active
              ? "text-foreground border-pink-500/40 bg-pink-500/10"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {slot.time}
    </button>
  );
}

/**
 * "They look closed then — request anyway?" Inline, non-blocking, and only when
 * we actually hold hours for the place: an un-enriched place has no opinion and
 * must stay silent.
 */
export function ClosedSlotNotice({
  date,
  time,
  hours,
  placeName,
}: {
  date: string;
  time: string | null;
  hours?: WeeklyHours | null;
  placeName: string;
}) {
  if (!time || !date || !hours) return null;
  if (slotState(date, time, hours) !== "closed") return null;
  const dayHours = hoursLabelForDate(date, hours);

  return (
    <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3">
      <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-amber-600" />
      <p className="text-[12.5px] leading-snug text-amber-900">
        <span className="font-semibold">
          {placeName} looks closed at {time} on {weekdayName(date)}.
        </span>{" "}
        {dayHours
          ? `Our hours say ${dayHours}.`
          : "Our hours show them closed all day."}{" "}
        You can still request it — Mesita will tell you what the place says when
        we call.
      </p>
    </div>
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
      <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
        Party size
      </p>
      <div className="border-border bg-card mt-2 flex items-center justify-between rounded-2xl border p-2">
        <button
          type="button"
          onClick={() => onChange((n) => Math.max(MIN_PARTY, n - 1))}
          disabled={value <= MIN_PARTY}
          aria-label="Decrease party size"
          className="bg-muted text-foreground hover:bg-muted/70 flex h-9 w-9 items-center justify-center rounded-full transition disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="font-display text-2xl font-semibold tracking-tight tabular-nums">
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

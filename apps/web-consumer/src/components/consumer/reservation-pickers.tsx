import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isSlotPast,
  VENUE_TZ_LABEL,
  venueDateIso,
  venueDateParts,
} from "@/lib/venue-time";

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

// 30-min slots from 6pm to 11pm — the realistic dinner window. Lunch +
// brunch slots arrive when the slot config moves to per-place data.
// Exported because "is this whole day gone?" is decided against this list.
export const TIME_SLOTS = [
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
  "22:00",
  "22:30",
  "23:00",
];

const MIN_PARTY = 1;
const MAX_PARTY = 12;

type DateOption = {
  iso: string;
  weekday: string;
  day: number;
  month: string;
  /** Every slot on this day is already behind the venue's clock. */
  disabled: boolean;
};

/**
 * The next `count` days on the VENUE's calendar — not the device's. A guest in
 * Tokyo and a guest in CDMX must see the same "Today", or they'd disagree
 * about which slots are still bookable.
 */
export function buildDateOptions(count: number): DateOption[] {
  const out: DateOption[] = [];
  for (let i = 0; i < count; i += 1) {
    const iso = venueDateIso(i);
    const { weekday, day, month } = venueDateParts(iso);
    out.push({
      iso,
      weekday: i === 0 ? "Today" : i === 1 ? "Tom." : DAY_NAMES[weekday],
      day,
      month: MONTH_NAMES[month],
      // Late at night today has nothing left. The pill stays in the row and
      // goes dead — hiding it would shift every other pill sideways.
      disabled: TIME_SLOTS.every((slot) => isSlotPast(iso, slot)),
    });
  }
  return out;
}

/** First day still open for booking — the safe default / fallback. */
export function firstOpenDate(options: DateOption[]): string {
  return options.find((d) => !d.disabled)?.iso ?? "";
}

/**
 * The slot to actually use for `dateIso`: the guest's pick when it's still
 * ahead of the venue's clock, otherwise the first slot that is. Null when the
 * day is spent — callers disable submit on that.
 */
export function resolveSlot(
  dateIso: string,
  preferred: string,
): string | null {
  if (!dateIso) return null;
  if (TIME_SLOTS.includes(preferred) && !isSlotPast(dateIso, preferred)) {
    return preferred;
  }
  return TIME_SLOTS.find((slot) => !isSlotPast(dateIso, slot)) ?? null;
}

/** Date row — horizontally scrollable pills, two weeks out. */
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
      <div className="scrollbar-hide -mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1">
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
 * Time grid — 4 columns of 30-min slots. Pass `date` (the selected venue day)
 * and slots already behind the venue's clock render muted + unclickable; they
 * stay in the grid so the layout never jumps.
 */
export function ReservationTimePicker({
  value,
  onChange,
  date,
}: {
  value: string | null;
  onChange: (slot: string) => void;
  date?: string;
}) {
  return (
    <div className="mt-4">
      <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
        Time
      </p>
      <p className="text-muted-foreground mt-1 text-[11px]">
        Times shown in {VENUE_TZ_LABEL}
      </p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {TIME_SLOTS.map((slot) => {
          const past = date ? isSlotPast(date, slot) : false;
          const active = slot === value && !past;
          return (
            <button
              key={slot}
              type="button"
              onClick={() => onChange(slot)}
              disabled={past}
              aria-disabled={past}
              title={past ? "This time has already passed" : undefined}
              className={cn(
                "rounded-xl border py-2 text-sm font-semibold tabular-nums transition",
                past
                  ? "border-border bg-muted/40 text-muted-foreground cursor-not-allowed opacity-45"
                  : active
                    ? "text-foreground border-pink-500/40 bg-pink-500/10"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {slot}
            </button>
          );
        })}
      </div>
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

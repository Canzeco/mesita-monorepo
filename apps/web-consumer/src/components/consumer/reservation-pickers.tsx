import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

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
const TIME_SLOTS = [
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
};

export function buildDateOptions(count: number): DateOption[] {
  const out: DateOption[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push({
      iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      weekday: i === 0 ? "Today" : i === 1 ? "Tom." : DAY_NAMES[d.getDay()],
      day: d.getDate(),
      month: MONTH_NAMES[d.getMonth()],
    });
  }
  return out;
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
              className={cn(
                "flex shrink-0 flex-col items-center rounded-2xl border px-3 py-2 transition",
                active
                  ? "border-pink-500/40 bg-pink-500/10"
                  : "border-border bg-card",
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase",
                  active ? "text-pink-300" : "text-muted-foreground",
                )}
              >
                {d.weekday}
              </span>
              <span
                className={cn(
                  "font-display text-lg font-semibold tracking-tight",
                  active ? "text-foreground" : "text-foreground",
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

/** Time grid — 4 columns of 30-min slots. */
export function ReservationTimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (slot: string) => void;
}) {
  return (
    <div className="mt-4">
      <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
        Time
      </p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {TIME_SLOTS.map((slot) => {
          const active = slot === value;
          return (
            <button
              key={slot}
              type="button"
              onClick={() => onChange(slot)}
              className={cn(
                "rounded-xl border py-2 text-sm font-semibold tabular-nums transition",
                active
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

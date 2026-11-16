import { useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Minus,
  Plus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Panel } from "@/components/shared/Panel";
import { cn } from "@/lib/utils";
import {
  bookingWindowDays,
  buildSlots,
  isDateSpent,
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
      // Today, then weekday names (MESITA-4183: "Tom." read as a name).
      weekday: i === 0 ? "Today" : DAY_NAMES[weekday],
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

// ── The look (MESITA-4166) ─────────────────────────────────────────────────
// White page; an unselected choice is white with a border you can SEE
// (foreground/20, not the hairline); the chosen one is solid ink. Pato:
// "is hard to see" — every choice on this page uses these three classes.

const CHOICE = "rounded-xl border font-semibold tabular-nums transition";
const PILL = "rounded-full";
const CHOICE_OFF = "border-foreground/20 bg-card text-foreground";
const CHOICE_ON = "border-foreground bg-foreground text-background";
const CHOICE_DEAD = "border-foreground/10 bg-card text-muted-foreground cursor-not-allowed opacity-40";

/** One section of the Reserve page: the app's Panel (MESITA-4183, Pato over
 *  the plain page: "THIS LOOKS LIKE SHIT"; Pay's steps wear panels): a white
 *  bordered box on the grey page, its display heading inside, an optional
 *  control on the heading's right, then the body 16px in. */
export function ReservationSection({
  title,
  aside,
  children,
  flush,
  className,
}: {
  title: string;
  aside?: React.ReactNode;
  children?: React.ReactNode;
  /** Rows that run edge to edge (split by hairlines), no inner padding. */
  flush?: boolean;
  className?: string;
}) {
  return (
    <Panel title={title} action={aside} className={className}>
      {children ? (
        <div className={flush ? "mt-3" : "px-4 pt-3 pb-4"}>{children}</div>
      ) : (
        <div className="pb-4" />
      )}
    </Panel>
  );
}

/** Date — one week as a seven-column grid (no sideways scroll); "More dates"
 *  opens the rest of the month in the same grid. */
export function ReservationDatePicker({
  options,
  value,
  onChange,
}: {
  options: DateOption[];
  value: string;
  onChange: (iso: string) => void;
}) {
  const [more, setMore] = useState(false);
  const picked = options.findIndex((d) => d.iso === value);
  // A date picked beyond the first week keeps the grid open.
  const open = more || picked >= 7;
  const shown = open ? options : options.slice(0, 7);
  return (
    <ReservationSection
      title="Date"
      aside={
        options.length > 7 ? (
          <button
            type="button"
            onClick={() => setMore(!open)}
            aria-expanded={open}
            className="text-foreground inline-flex h-11 items-center gap-1 text-sm font-semibold"
          >
            {open ? "Fewer dates" : "More dates"}
            <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} aria-hidden />
          </button>
        ) : null
      }
    >
      <div role="radiogroup" aria-label="Date" className="grid grid-cols-7 gap-1.5">
        {shown.map((d, i) => {
          const active = d.iso === value;
          // The first of a month says the month, so a long grid stays legible.
          const top = i > 0 && d.day === 1 ? d.month : d.weekday;
          return (
            <button
              key={d.iso}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${d.weekday} ${d.day} ${d.month}${d.disabled ? ", no times" : ""}`}
              onClick={() => onChange(d.iso)}
              disabled={d.disabled}
              className={cn(
                CHOICE,
                "flex h-14 min-w-0 flex-col items-center justify-center gap-0.5",
                d.disabled ? CHOICE_DEAD : active ? CHOICE_ON : CHOICE_OFF,
              )}
            >
              <span className={cn("type-body truncate font-medium", !active && "text-muted-foreground")}>{top}</span>
              <span className="text-lg leading-none">{d.day}</span>
            </button>
          );
        })}
      </div>
    </ReservationSection>
  );
}

/**
 * Time — every time still ahead of the place's clock, one grid, five a row,
 * no Lunch/Dinner labels (MESITA-4183, Pato: "don't separate lunch and
 * dinner, keep it clean"). After-midnight times go last: 01:30 belongs to
 * this date but reads as tonight, so it never leads the grid (MESITA-4166).
 * Only times inside the place's hours are listed (MESITA-3951).
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
  const ahead = buildSlots(date ?? "", hours).filter(
    (slot) => !(date && isSlotPast(date, slot.time, tz)),
  );
  const slots = [...ahead.filter((s) => !s.afterMidnight), ...ahead.filter((s) => s.afterMidnight)];
  return (
    <ReservationSection title="Time">
      {slots.length === 0 ? (
        <p className="text-muted-foreground type-body">No times left on this day. Pick another date.</p>
      ) : (
        <div role="radiogroup" aria-label="Time" className="grid grid-cols-5 gap-2">
          {slots.map((slot) => {
            const active = slot.time === value;
            return (
              <button
                key={slot.time}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={slot.afterMidnight ? `${slot.time}, after midnight` : slot.time}
                onClick={() => onChange(slot.time)}
                className={cn(CHOICE, PILL, "h-11 text-base", active ? CHOICE_ON : CHOICE_OFF)}
              >
                {slot.time}
              </button>
            );
          })}
        </div>
      )}
    </ReservationSection>
  );
}

/** People — one row: the title left, a big stepper right. 1–10. */
export function ReservationPartyPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (updater: (n: number) => number) => void;
}) {
  const step = cn(
    CHOICE,
    CHOICE_OFF,
    "flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-30",
  );
  return (
    <ReservationSection
      title="People"
      aside={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onChange((n) => Math.max(MIN_PARTY, n - 1))}
            disabled={value <= MIN_PARTY}
            aria-label="Fewer people"
            className={step}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-7 text-center text-xl font-semibold tabular-nums" aria-live="polite">
            {value}
          </span>
          <button
            type="button"
            onClick={() => onChange((n) => Math.min(MAX_PARTY, n + 1))}
            disabled={value >= MAX_PARTY}
            aria-label="More people"
            className={step}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      }
    />
  );
}

/** A text field with its label ABOVE it, never the placeholder alone. */
export function ReservationField({
  label,
  className,
  ...input
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="text-muted-foreground type-body mb-1.5 block font-medium">{label}</span>
      <input
        {...input}
        className="border-foreground/20 bg-card focus:border-foreground read-only:bg-muted read-only:text-muted-foreground h-11 w-full rounded-xl border px-3.5 text-base outline-none"
      />
    </label>
  );
}

// ── Flexibility (MESITA-3957) ──────────────────────────────────────────────
// What a1 may take alone on the call: a time inside the window.

export type ReservationTimeWindow = 0 | 30 | 60;
/** decision: 30 minutes either side by default (MESITA-3957, Pato's call). */
export const DEFAULT_TIME_WINDOW: ReservationTimeWindow = 30;

/** `HH:mm` moved by `delta` minutes, wrapping round the clock. */
function shiftHhmm(time: string, delta: number): string {
  const [h, m] = time.split(":").map(Number);
  const t = (((h * 60 + m + delta) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** "19:30–20:30", or "20:00" alone for Exact; null without a time. */
export function windowRange(time: string | null, window: ReservationTimeWindow): string | null {
  if (!time) return null;
  return window === 0 ? time : `${shiftHhmm(time, -window)}–${shiftHhmm(time, window)}`;
}

/** One segmented control under the time grid. */
export function ReservationWindowPicker({
  value,
  onChange,
  time,
}: {
  value: ReservationTimeWindow;
  onChange: (next: ReservationTimeWindow) => void;
  time: string | null;
}) {
  const options: { value: ReservationTimeWindow; label: string }[] = [
    { value: 0, label: "Exact" },
    { value: 30, label: "± 30 min" },
    { value: 60, label: "± 1 hour" },
  ];
  const range = windowRange(time, value);
  return (
    <ReservationSection title="How flexible?">
      <div
        role="radiogroup"
        aria-label="How flexible"
        className="border-foreground/20 grid grid-cols-3 gap-1 rounded-xl border p-1"
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={cn(
                "h-10 rounded-lg text-sm font-semibold transition",
                active ? "bg-foreground text-background" : "text-foreground",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {range && (
        <p className="text-muted-foreground type-body mt-1.5">
          {value === 0
            ? `We ask for ${range} only.`
            : `We try for ${time} first. If it's taken, we book ${range} without asking.`}
        </p>
      )}
    </ReservationSection>
  );
}

// ── How the guest hears back (MESITA-4187) ─────────────────────────────────
// Pato: "On Confirmation (app + call me) · On Rejection (app + call me)",
// worded "if for some reason we cannot book you: app notification / app
// notification + call me". The app always tells; "call" adds a2's call. No
// timing promise: the place is only phoned while it is open.

export type ReservationNotify = "app" | "call";

/** One "how do we tell you" row: its question, then App · App + call me as
 *  the same segmented control How flexible? uses. */
function NotifyRow({
  label,
  value,
  onChange,
  callHint,
}: {
  label: string;
  value: ReservationNotify;
  onChange: (next: ReservationNotify) => void;
  callHint?: string;
}) {
  const options: Array<{ value: ReservationNotify; label: string }> = [
    { value: "app", label: "App notification" },
    { value: "call", label: "App + call me" },
  ];
  return (
    <div>
      <p className="type-body mb-1.5 font-semibold">{label}</p>
      <div role="radiogroup" aria-label={label} className="border-foreground/20 grid grid-cols-2 gap-1 rounded-xl border p-1">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={cn(
                "h-10 rounded-lg text-sm font-semibold transition",
                active ? "bg-foreground text-background" : "text-foreground",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {callHint && value === "call" && <p className="text-muted-foreground type-body mt-1.5">{callHint}</p>}
    </div>
  );
}

/** The Updates panel: when you're booked, and if we can't book you. */
export function ReservationUpdatesPicker({
  onConfirm,
  onReject,
  setConfirm,
  setReject,
}: {
  onConfirm: ReservationNotify;
  onReject: ReservationNotify;
  setConfirm: (next: ReservationNotify) => void;
  setReject: (next: ReservationNotify) => void;
}) {
  return (
    <ReservationSection title="Updates">
      <div className="flex flex-col gap-4">
        <NotifyRow label="When you're booked" value={onConfirm} onChange={setConfirm} />
        <NotifyRow
          label="If we can't book you"
          value={onReject}
          onChange={setReject}
          // A plain "no" has no call script yet; a2 calls when the place
          // offers other times (MESITA-4187, said plainly).
          callHint="We call when the place offers other times."
        />
      </div>
    </ReservationSection>
  );
}

// ── The steps (MESITA-4172; two in MESITA-4174; three since MESITA-4179) ───
// Pato: "write at the top the steps of the reservation in a progress bar,
// kinda like the Pay view … make it not scrollable but in steps", then over
// five: "less fucking steps", then over two: "3 STEPS, NOT 2 STEPS", then
// (MESITA-4183) "Time · Details · Preview". The bar is Pay's StepNav
// (pay-flow.tsx) in look: ‹ "Time · 1 of 3" › with the step's icon, thin
// segments, done and current ink.

export type ReserveStep = "time" | "details" | "preview";

const STEP_META: Record<ReserveStep, { name: string; icon: LucideIcon }> = {
  time: { name: "Time", icon: CalendarDays },
  details: { name: "Details", icon: Users },
  preview: { name: "Preview", icon: CircleCheck },
};

export function ReserveStepNav({
  steps,
  at,
  onBack,
  onNext,
}: {
  steps: readonly ReserveStep[];
  at: number;
  onBack?: () => void;
  onNext?: () => void;
}) {
  const step = steps[at];
  const { name, icon: Icon } = STEP_META[step];
  const arrow =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-muted disabled:opacity-40";
  return (
    <div className="px-2 pt-1 pb-2.5" data-reserve-steps>
      <div className="flex h-11 items-center">
        <button
          type="button"
          onClick={onBack}
          className={cn(arrow, !onBack && "invisible")}
          aria-label={at > 0 ? `Back to ${STEP_META[steps[at - 1]].name}` : "Back"}
          tabIndex={onBack ? undefined : -1}
        >
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
        <p className="flex min-w-0 flex-1 items-center justify-center gap-1.5 truncate text-base">
          <Icon className="h-5 w-5 shrink-0" aria-hidden />
          <span className="font-semibold">{name}</span>
          <span className="text-muted-foreground">{` · ${at + 1} of ${steps.length}`}</span>
        </p>
        <button
          type="button"
          onClick={onNext}
          disabled={!onNext}
          className={cn(arrow, at >= steps.length - 1 && "invisible")}
          aria-label={at < steps.length - 1 ? `Next: ${STEP_META[steps[at + 1]].name}` : "Next"}
          tabIndex={at < steps.length - 1 ? undefined : -1}
        >
          <ChevronRight className="h-6 w-6" aria-hidden />
        </button>
      </div>
      <ol
        className="mt-1 grid gap-1.5 px-2"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        aria-label={`Step ${at + 1} of ${steps.length}: ${name}`}
      >
        {steps.map((s, i) => (
          <li
            key={s}
            aria-current={i === at ? "step" : undefined}
            className={cn("h-1 rounded-full", i <= at ? "bg-foreground" : "bg-border")}
          />
        ))}
      </ol>
    </div>
  );
}

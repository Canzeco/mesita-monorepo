import { useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
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
// The chosen one wears the Reserve red since MESITA-4259 (Pato: "Red colors
// like in OpenTable"); --reserve is never an error colour.

const CHOICE = "rounded-xl border font-semibold tabular-nums transition";
const PILL = "rounded-full";
const CHOICE_OFF = "border-foreground/20 bg-card text-foreground";
const CHOICE_ON = "border-reserve bg-reserve text-reserve-foreground";
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
              <span className={cn("type-body truncate font-semibold", !active && "text-muted-foreground")}>{top}</span>
              <span className="text-lg leading-none">{d.day}</span>
            </button>
          );
        })}
      </div>
    </ReservationSection>
  );
}

/** Lunch ends here: a slot at or after 17:00, or after midnight, is Dinner
 *  (MESITA-4671 D2). */
const DINNER_FROM = "17:00";

/**
 * Time — every time still ahead of the place's clock, in two labelled groups,
 * Lunch and Dinner, four 44px pills a row (MESITA-4671 D2/D8, Pato
 * 2026-11-22; this undoes MESITA-4183's one flat grid). A group with no times
 * is not drawn, and a lone group drops its label (D9). After-midnight times
 * go last: 01:30 belongs to this date but reads as tonight, so it never
 * leads the grid (MESITA-4166). Only times inside the place's hours are
 * listed (MESITA-3951).
 */
export function ReservationTimePicker({
  value,
  onChange,
  date,
  hours,
  tz,
  children,
}: {
  value: string | null;
  onChange: (slot: string) => void;
  date?: string;
  hours?: WeeklyHours | null;
  /** The place's IANA zone (MESITA-3626): "past" is judged on its clock. */
  tz?: string | null;
  /** Under the grid, inside the same box: How flexible? (MESITA-4259 D2). */
  children?: React.ReactNode;
}) {
  const ahead = buildSlots(date ?? "", hours).filter(
    (slot) => !(date && isSlotPast(date, slot.time, tz)),
  );
  const lunch = ahead.filter((s) => !s.afterMidnight && s.time < DINNER_FROM);
  const dinner = [
    ...ahead.filter((s) => !s.afterMidnight && s.time >= DINNER_FROM),
    ...ahead.filter((s) => s.afterMidnight),
  ];
  const groups = [
    { label: "Lunch", slots: lunch },
    { label: "Dinner", slots: dinner },
  ].filter((g) => g.slots.length > 0);
  return (
    <ReservationSection title="Time">
      {groups.length === 0 ? (
        <p className="text-muted-foreground type-body">No times left on this day. Pick another date.</p>
      ) : (
        <div role="radiogroup" aria-label="Time" className="flex flex-col gap-3">
          {groups.map((g) => (
            <div key={g.label}>
              {groups.length > 1 && (
                <p className="text-muted-foreground type-body mb-1.5 font-semibold">{g.label}</p>
              )}
              <div className="grid grid-cols-4 gap-2">
                {g.slots.map((slot) => {
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
            </div>
          ))}
        </div>
      )}
      {groups.length > 0 && children}
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
      <span className="text-muted-foreground type-body mb-1.5 block font-semibold">{label}</span>
      <input
        {...input}
        className="border-foreground/20 bg-card focus:border-foreground read-only:bg-muted read-only:text-muted-foreground h-11 w-full rounded-xl border px-3.5 text-base outline-none"
      />
    </label>
  );
}

/** Notes — a 4-line box (MESITA-4259 D6, Pato: "make the notes box
 *  bigger"); the count shows only near the cap. */
export function ReservationNotes({
  value,
  onChange,
  max = 280,
}: {
  value: string;
  onChange: (next: string) => void;
  max?: number;
}) {
  const left = max - value.length;
  return (
    <ReservationSection
      title="Notes"
      aside={<span className="text-muted-foreground type-body pr-1">Optional</span>}
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={max}
        rows={4}
        aria-label="Notes"
        placeholder="Birthday, high chair, window table…"
        className="border-foreground/20 bg-card focus:border-foreground block w-full resize-none rounded-xl border px-3.5 py-3 text-base leading-snug outline-none"
      />
      {left <= 40 && (
        <p className="text-muted-foreground type-body mt-1.5 text-right tabular-nums" aria-live="polite">
          {left} left
        </p>
      )}
    </ReservationSection>
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

/** How flexible? — one compact segmented row at the foot of the Time box
 *  (MESITA-4259 D2), so the When step fits one phone screen. */
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
    <div className="border-border mt-4 border-t pt-3">
      <p className="type-body mb-1.5 font-semibold">How flexible?</p>
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
                "h-11 rounded-lg text-sm font-semibold transition",
                // One selection colour on the Reserve page (MESITA-4671 D6).
                active ? "bg-reserve text-reserve-foreground" : "text-foreground",
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
    </div>
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
}: {
  label: string;
  value: ReservationNotify;
  onChange: (next: ReservationNotify) => void;
}) {
  const options: Array<{ value: ReservationNotify; label: string }> = [
    // One line each (MESITA-4671 D7); MESITA-4266's "App notification +
    // Phone call" wrapped to two. The row's question says it is a
    // notification.
    { value: "app", label: "App" },
    { value: "call", label: "App + call" },
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
                "h-11 rounded-lg px-2 text-sm font-semibold transition",
                active ? "bg-reserve text-reserve-foreground" : "text-foreground",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** How should we tell you? (MESITA-4259 D4, Pato: "clearer language"):
 *  Reservation confirmed, and Reservation not possible. */
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
    <ReservationSection title="How should we tell you?">
      <div className="flex flex-col gap-4">
        <NotifyRow label="Reservation confirmed" value={onConfirm} onChange={setConfirm} />
        <NotifyRow
          label="Reservation not possible"
          value={onReject}
          onChange={setReject}
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

// MESITA-4259: When · Party · You (Pato: "first page … date and hour and
// time flexibility", then "number of people and optional notes", "lastly the
// name … and the phone"). Changing a reservation stops at Party.
// MESITA-4403 (Pato: "if you already have a table, add it as a prev step"):
// a live table here comes first, as Your table.
export type ReserveStep = "table" | "when" | "party" | "you";

export const STEP_META: Record<ReserveStep, { name: string; icon: LucideIcon }> = {
  table: { name: "Your table", icon: CalendarClock },
  when: { name: "When", icon: CalendarDays },
  party: { name: "Party", icon: Users },
  you: { name: "You", icon: CircleCheck },
};

/**
 * THE HEADER (MESITA-4671 D1, Pato 2026-11-22): no box. One row — Back, the
 * place's round photo, its name, and at the right the reservations-left pill
 * (`aside`) — then "When · 1 of 3" over the thin red step segments. Back walks
 * the steps, and leaves the page from the first one.
 */
export function ReserveStepNav({
  steps,
  at,
  onBack,
  place,
  aside,
}: {
  steps: readonly ReserveStep[];
  at: number;
  onBack: () => void;
  place: { name: string; photo: React.ReactNode };
  /** The reservations-left pill (ReserveLeftPill), or nothing. */
  aside?: React.ReactNode;
}) {
  const step = steps[at];
  const { name } = STEP_META[step];
  return (
    <div className="pt-2 pb-1" data-reserve-steps>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="hover:bg-muted -ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition"
          aria-label={at > 0 ? `Back to ${STEP_META[steps[at - 1]].name}` : "Back"}
        >
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
        <span className="shrink-0 [&>span]:h-8 [&>span]:w-8 [&>span]:text-xs">{place.photo}</span>
        <h1 className="min-w-0 flex-1 truncate text-lg leading-tight font-semibold tracking-tight">
          {place.name}
        </h1>
        {aside}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <ol
          className="grid flex-1 gap-1.5"
          style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
          aria-label={`Step ${at + 1} of ${steps.length}: ${name}`}
        >
          {steps.map((s, i) => (
            <li
              key={s}
              aria-current={i === at ? "step" : undefined}
              className={cn("h-1 rounded-full", i <= at ? "bg-reserve" : "bg-border")}
            />
          ))}
        </ol>
        <p className="type-body shrink-0" aria-hidden>
          <span className="font-semibold">{name}</span>
          <span className="text-muted-foreground">{` · ${at + 1} of ${steps.length}`}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * Reservations left this month (MESITA-4671 D1/D3, Pato: "also display how
 * many reservations per month left here"): a 40px pill on the header's right,
 * on every step. Grey while some are left; Reserve-red "None left" at zero,
 * which opens the Pro step when Pro would help (`onNoneLeft`) and otherwise
 * says when the month resets. The caller draws nothing while the count is
 * loading, failed, or the cap does not apply.
 */
export function ReserveLeftPill({
  left,
  cap,
  resetsOn,
  onNoneLeft,
}: {
  left: number;
  cap: number;
  /** "Dec 1" — shown at zero when Pro would not help. */
  resetsOn: string;
  onNoneLeft?: () => void;
}) {
  const base = "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold whitespace-nowrap";
  if (left > 0) {
    return (
      <span className={cn(base, "bg-muted text-foreground")} aria-live="polite" data-reserve-left-pill="">
        <CalendarDays className="text-muted-foreground h-4 w-4" aria-hidden />
        {left} of {cap} left
        <span className="sr-only"> this month</span>
      </span>
    );
  }
  const none = cn(base, "bg-reserve/10 text-reserve");
  return onNoneLeft ? (
    <button type="button" onClick={onNoneLeft} className={none} aria-live="polite" data-reserve-left-pill="">
      None left
      <span className="sr-only"> this month. Get more reservations</span>
    </button>
  ) : (
    <span className={none} aria-live="polite" data-reserve-left-pill="">
      None left · {resetsOn}
      <span className="sr-only"> is when more arrive</span>
    </span>
  );
}

"use client";

// Birthday as three TAP-TO-SET PARTS, not three dropdowns (MESITA-1829).
//
// It used to be Day / Month / Year <select>s. The design review measured that
// as the slowest control on the onboarding screen: three popovers to open, and
// the Year list needs ~30 entries of scroll to reach a plausible birth year on
// a phone. Day and Year are now numeric inputs — the phone raises a keypad and
// the guest types "14" and "1998" — while Month stays a native <select>,
// because twelve NAMED options is the one part a list genuinely beats typing
// (and it sidesteps "is 03 March or the 3rd?" entirely).
//
// The original comment rejected <input type="date"> for its "dd/mm/yyyy"
// placeholder and a calendar popover that opens on the CURRENT month for a
// date thirty years back. That rejection still stands; this is not a return
// to it.
//
// EVERYTHING BELOW THE CONTROL IS UNCHANGED, on purpose. Same local Parts
// state (so a partial selection sticks), same leap-year `daysInMonth`, same
// clamp on update, same canonical "YYYY-MM-DD" out of compose() and "" while
// incomplete. It stays a drop-in wherever a birthday is collected — onboard
// and the Edit-profile sheet both pass value/onChange and neither knows the
// control changed.

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Days in a given 1-based month, leap-year aware. Called with the current
// year/month so February and the 30/31-day months never keep a bad day.
function daysInMonth(year: number, month1: number): number {
  if (!year || !month1) return 31;
  return new Date(year, month1, 0).getDate();
}

type Parts = { year: string; month: string; day: string };

function parse(value: string): Parts {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return { year: "", month: "", day: "" };
  return { year: m[1], month: String(Number(m[2])), day: String(Number(m[3])) };
}

function compose(parts: Parts): string {
  if (!parts.year || !parts.month || !parts.day) return "";
  // THE YEAR IS TYPED NOW, so `parts.year` legitimately holds a half-finished
  // run of digits while someone is mid-keystroke. Guarding here rather than in
  // the onChange handler is the point: every caller composes through this one
  // function, so a partial "19" can never escape as "19-03-14" no matter which
  // part moved last. Out-of-range years compose to "" for the same reason the
  // old dropdown only offered 101 of them — a future year is not a birthday.
  if (!/^\d{4}$/.test(parts.year)) return "";
  const thisYear = new Date().getFullYear();
  const year = Number(parts.year);
  if (year > thisYear || year < thisYear - 100) return "";
  // Clamp the day if a month/year change shortened the month (e.g. 31 →
  // Feb) so we never emit an impossible date.
  const maxDay = daysInMonth(year, Number(parts.month));
  const day = Math.min(Number(parts.day), maxDay);
  const mm = String(Number(parts.month)).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${parts.year}-${mm}-${dd}`;
}

/** One part of the date. The caption is a real <label>, never a placeholder —
 *  it has to stay readable once the box holds a value (Docs › Design §D). */
const PART_CLASS =
  "border-border bg-card focus-within:border-foreground/40 flex h-[52px] flex-col items-center justify-center rounded-xl border transition";
const PART_CAPTION_CLASS =
  "text-muted-foreground type-meta font-semibold tracking-[0.1em] uppercase";
const PART_VALUE_CLASS =
  "w-full bg-transparent text-center text-base font-semibold tabular-nums outline-none";

export function BirthdayPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [parts, setParts] = useState<Parts>(() => parse(value));
  const monthRef = useRef<HTMLSelectElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  // Re-seed from the prop when it changes to a complete date the local
  // state doesn't already represent (e.g. profile loads async in the Edit
  // sheet). Done during render via the "adjust state on prop change"
  // pattern — an effect here would trip react-hooks/set-state-in-effect and
  // add a wasted render. Ignored while the user is mid-selection (value "").
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (value && compose(parts) !== value) setParts(parse(value));
  }

  function update(next: Parts) {
    // Clamp the stored day when a month/year change shortens the month
    // (e.g. day 31 then February) so the Day box visibly reflects the day
    // that actually gets saved, instead of showing an impossible value while
    // compose() silently clamps behind it.
    const maxDay = daysInMonth(Number(next.year), Number(next.month));
    const clamped =
      next.day && Number(next.day) > maxDay
        ? { ...next, day: String(maxDay) }
        : next;
    setParts(clamped);
    onChange(compose(clamped));
  }

  /** Day accepts 1-31 and AUTO-ADVANCES to Month — at two digits, or at one
   *  digit that cannot be the start of a valid day (4-9). Saves a tap without
   *  ever trapping someone typing "1" on the way to "14". */
  function onDay(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    if (digits === "") return update({ ...parts, day: "" });
    const n = Number(digits);
    if (n > 31) return;
    update({ ...parts, day: digits });
    if (digits.length === 2 || n > 3) monthRef.current?.focus();
  }

  /** Year keeps whatever digits are typed so the box shows them; compose()
   *  decides whether they amount to a date yet. */
  function onYear(raw: string) {
    update({ ...parts, year: raw.replace(/\D/g, "").slice(0, 4) });
  }

  return (
    <div className={cn("grid grid-cols-[1fr_1.6fr_1.2fr] gap-2", className)}>
      <label className={PART_CLASS}>
        <input
          inputMode="numeric"
          autoComplete="bday-day"
          aria-label="Birth day"
          placeholder="DD"
          className={PART_VALUE_CLASS}
          value={parts.day}
          onChange={(e) => onDay(e.target.value)}
        />
        <span className={PART_CAPTION_CLASS}>Day</span>
      </label>

      <label className={PART_CLASS}>
        <select
          ref={monthRef}
          aria-label="Birth month"
          className={cn(
            PART_VALUE_CLASS,
            "appearance-none px-1",
            !parts.month && "text-muted-foreground",
          )}
          value={parts.month}
          onChange={(e) => {
            update({ ...parts, month: e.target.value });
            if (e.target.value && !parts.year) yearRef.current?.focus();
          }}
        >
          <option value="">Month</option>
          {MONTHS.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <span className={PART_CAPTION_CLASS}>Month</span>
      </label>

      <label className={PART_CLASS}>
        <input
          ref={yearRef}
          inputMode="numeric"
          autoComplete="bday-year"
          aria-label="Birth year"
          placeholder="YYYY"
          className={PART_VALUE_CLASS}
          value={parts.year}
          onChange={(e) => onYear(e.target.value)}
        />
        <span className={PART_CAPTION_CLASS}>Year</span>
      </label>
    </div>
  );
}

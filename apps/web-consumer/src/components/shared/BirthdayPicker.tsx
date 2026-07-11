"use client";

// Friendly birthday picker — three dropdowns (Day / Month / Year) instead
// of the native <input type="date">, whose "dd/mm/yyyy" placeholder and
// tiny calendar popover feel clumsy on mobile. Reads and writes the same
// canonical "YYYY-MM-DD" string the EF expects, so it's a drop-in swap
// wherever a birthday was collected.
//
// The three parts live in local state (not derived from the composed
// string) so a partial selection sticks — picking Day first must not snap
// back just because Month/Year aren't chosen yet. onChange fires the full
// "YYYY-MM-DD" once all three are set, and "" while incomplete, so the
// required-field gates upstream stay honest.

import { useMemo, useState } from "react";
import { INPUT_CLASS } from "@/lib/ui-classes";
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
// year/month so February and the 30/31-day months never offer a bad day.
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
  // Clamp the day if a month/year change shortened the month (e.g. 31 →
  // Feb) so we never emit an impossible date.
  const maxDay = daysInMonth(Number(parts.year), Number(parts.month));
  const day = Math.min(Number(parts.day), maxDay);
  const mm = String(Number(parts.month)).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${parts.year}-${mm}-${dd}`;
}

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
    // (e.g. day 31 then February) so the Day dropdown visibly reflects the
    // day that actually gets saved, instead of going blank on a now-invalid
    // value while compose() silently clamps behind it.
    const maxDay = daysInMonth(Number(next.year), Number(next.month));
    const clamped =
      next.day && Number(next.day) > maxDay
        ? { ...next, day: String(maxDay) }
        : next;
    setParts(clamped);
    onChange(compose(clamped));
  }

  // Oldest plausible birth year → 100 years back. `new Date().getFullYear()`
  // runs in the browser (client component), so it tracks the real clock.
  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 101 }, (_, i) => now - i);
  }, []);

  const dayCount = daysInMonth(Number(parts.year), Number(parts.month));
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => i + 1),
    [dayCount],
  );

  const selectClass = cn(INPUT_CLASS, "appearance-none px-2.5");

  return (
    <div className={cn("grid grid-cols-[1fr_1.5fr_1.1fr] gap-2", className)}>
      <select
        aria-label="Birth day"
        className={selectClass}
        value={parts.day}
        onChange={(e) => update({ ...parts, day: e.target.value })}
      >
        <option value="">Day</option>
        {days.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        aria-label="Birth month"
        className={selectClass}
        value={parts.month}
        onChange={(e) => update({ ...parts, month: e.target.value })}
      >
        <option value="">Month</option>
        {MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label="Birth year"
        className={selectClass}
        value={parts.year}
        onChange={(e) => update({ ...parts, year: e.target.value })}
      >
        <option value="">Year</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

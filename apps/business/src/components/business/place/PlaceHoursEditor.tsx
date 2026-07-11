"use client";

import { cn } from "@/lib/utils";
import {
  isOvernightHours,
  PLACE_HOUR_DAYS,
  type DayKey,
  type DayShifts,
  type HoursRange,
} from "./place-hours";

const TIME_INPUT_CLASS =
  "border-border/70 bg-background focus:border-foreground/30 focus:ring-foreground/5 h-7 w-[4.25rem] rounded-full border px-1.5 text-center text-[11px] font-medium tabular-nums outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-40";

function DayOpenToggle({
  open,
  onToggle,
  label,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={open}
      aria-label={open ? `Mark ${label} closed` : `Mark ${label} open`}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-5 w-[34px] shrink-0 items-center rounded-full transition-colors duration-200",
        open ? "bg-foreground" : "bg-muted-foreground/20",
      )}
    >
      <span
        className={cn(
          "inline-block h-[14px] w-[14px] rounded-full bg-background shadow-sm transition-transform duration-200",
          open ? "translate-x-[17px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}

function TimeField({
  value,
  onChange,
  placeholder,
  label,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  disabled?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      disabled={disabled}
      inputMode="numeric"
      spellCheck={false}
      className={TIME_INPUT_CLASS}
    />
  );
}

export function PlaceHoursEditor({
  hours,
  onChange,
}: {
  hours: Record<DayKey, DayShifts>;
  onChange: (hours: Record<DayKey, DayShifts>) => void;
}) {
  const setDay = (key: DayKey, next: DayShifts) =>
    onChange({ ...hours, [key]: next });

  const setRange = (key: DayKey, patch: Partial<HoursRange>) => {
    const day = hours[key];
    const current = day.ranges[0] ?? { open: "", close: "" };
    setDay(key, {
      ...day,
      closed: false,
      ranges: [{ ...current, ...patch }],
    });
  };

  const markClosed = (key: DayKey) => setDay(key, { closed: true, ranges: [] });

  const reopen = (key: DayKey) =>
    setDay(key, { closed: false, ranges: [{ open: "", close: "" }] });

  return (
    <div className="divide-border/40 overflow-hidden rounded-lg bg-muted/20">
      {PLACE_HOUR_DAYS.map(({ key, label }) => {
        const day = hours[key];
        const isOpen = !day.closed;
        const range = day.ranges[0] ?? { open: "", close: "" };
        const overnight = isOvernightHours(range.open, range.close);

        return (
          <div
            key={key}
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 transition-colors",
              isOpen ? "bg-background/80" : "bg-muted/20",
            )}
          >
            <span
              className={cn(
                "w-8 shrink-0 text-[10px] font-semibold tracking-wide",
                isOpen ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>

            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {isOpen ? (
                <>
                  <TimeField
                    value={range.open}
                    onChange={(open) => setRange(key, { open })}
                    placeholder="09:00"
                    label={`${label} opens`}
                  />
                  <span
                    className="text-muted-foreground/60 shrink-0 text-[11px] select-none"
                    aria-hidden
                  >
                    →
                  </span>
                  <TimeField
                    value={range.close}
                    onChange={(close) => setRange(key, { close })}
                    placeholder="22:00"
                    label={`${label} closes`}
                  />
                  {overnight ? (
                    <span
                      title="Closes the next day"
                      className="text-muted-foreground bg-muted/60 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase"
                    >
                      +1d
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-muted-foreground text-[11px]">Closed</span>
              )}
            </div>

            <DayOpenToggle
              open={isOpen}
              label={label}
              onToggle={() => (isOpen ? markClosed(key) : reopen(key))}
            />
          </div>
        );
      })}
    </div>
  );
}

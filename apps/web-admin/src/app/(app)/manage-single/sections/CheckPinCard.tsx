"use client";

import {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { KeyRound } from "lucide-react";
import { setCheckPin, type AdminPlace } from "../actions";
import { useSectionDirty } from "../useSectionDirty";
import { SaveBar, SectionCard } from "../ui";

// Rewards Check PIN — optional staff gate on the public check page (MESITA-823).
//
// Pato: "you scan a qr, and you need some 6 digits PIN to mark ticket as
// done. optional. but maybe big companies want that so there you have it."
//
// This is NOT a waiter account (MESITA-833 stands — staff hold no identity).
// It is ONE shared 6-digit secret per place: the manager briefs the floor
// with it, and check-page WRITE actions (bill, story/review verdict, paid)
// require it. Blank = off, which is the default and keeps the two-tap close.
export function CheckPinCard({ place }: { place: AdminPlace }) {
  const saved = useMemo(
    () => (typeof place.check_pin === "string" ? place.check_pin : ""),
    [place.check_pin],
  );
  const [pin, setPin] = useState(saved);
  const [current, setCurrent] = useState(saved);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  const dirty = pin !== current;
  const valid = pin === "" || /^[0-9]{6}$/.test(pin);

  const resetDraft = useCallback(() => {
    setPin(current);
    setError(null);
    setOk(false);
  }, [current]);
  useSectionDirty("check-pin", dirty, resetDraft);

  const focusPin = () => {
    window.requestAnimationFrame(() => pinInputRef.current?.focus());
  };

  const clearPin = () => {
    setPin("");
    focusPin();
  };

  const save = () => {
    if (!valid) {
      setError("The PIN must be exactly 6 digits — or empty to turn the gate off.");
      return;
    }
    setError(null);
    setOk(false);
    start(async () => {
      const r = await setCheckPin(place.id, pin === "" ? null : pin);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const next = r.data ?? "";
      setCurrent(next);
      setPin(next);
      setOk(true);
      window.setTimeout(() => setOk(false), 2500);
    });
  };

  return (
    <SectionCard
      icon={<KeyRound className="h-4 w-4" />}
      tint="amber"
      title="Rewards Check PIN"
      subtitle="Optional 6-digit code staff must enter on the check page before billing or closing a ticket."
      action={
        <span
          className={
            "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold " +
            (current
              ? "bg-amber-500/10 text-amber-700"
              : "bg-muted text-muted-foreground")
          }
        >
          {current ? "Gate on" : "Gate off"}
        </span>
      }
    >
      <p className="text-muted-foreground mt-5 text-xs leading-relaxed">
        The QR itself is the authentication — anyone holding it can work the
        ticket. Turn this on and the place&apos;s staff also need a shared code,
        so a guest (or a passer-by who photographed the QR) can&apos;t self-bill.
        Scanning and viewing never ask for it; only bill, story/review verdicts
        and &ldquo;paid received&rdquo; do. Clear all six digits to keep the
        two-tap close.
      </p>
      <div className="mt-4 flex flex-col gap-1.5">
        <div className="flex min-h-4 items-center justify-between gap-2">
          <span className="text-foreground/90 text-[13px] font-medium">PIN</span>
          {pin !== "" ? (
            <button
              type="button"
              disabled={pending}
              onClick={clearPin}
              className="text-muted-foreground hover:text-foreground text-[11px] font-medium underline-offset-2 hover:underline disabled:opacity-50"
            >
              Clear to edit
            </button>
          ) : null}
        </div>
        <PinDigits
          ref={pinInputRef}
          value={pin}
          onChange={setPin}
          disabled={pending}
          hasError={pin !== "" && !valid}
        />
        {pin !== "" && !valid ? (
          <span className="text-xs font-medium text-amber-700">
            Needs all 6 digits.
          </span>
        ) : (
          <span className="text-muted-foreground text-[11px]">
            Click a digit to edit from there · type over a full PIN to replace
            it · clear all to turn the gate off.
          </span>
        )}
      </div>
      <SaveBar
        pending={pending}
        dirtyLabel="Rewards Check PIN · unsaved"
        dirty={dirty}
        ok={ok}
        error={error}
        onSave={save}
        onCancel={() => setPin(current)}
      />
    </SectionCard>
  );
}

// 6-cell digit input. Invisible native <input> keeps paste + numeric keypad;
// cells stay clickable so a set PIN can be edited (MESITA-884).
const PinDigits = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (next: string) => void;
    disabled: boolean;
    hasError: boolean;
  }
>(function PinDigits({ value, onChange, disabled, hasError }, ref) {
  const [focused, setFocused] = useState(false);
  const cells = Array.from({ length: 6 }, (_, i) => value[i] ?? "");
  // Highlight the next empty cell while typing; when full and focused,
  // highlight the last cell so the row still reads as live/editable.
  const focusIndex = !focused
    ? -1
    : value.length < 6
      ? value.length
      : 5;

  const focusEl = () => {
    const el = typeof ref === "object" && ref ? ref.current : null;
    el?.focus();
  };

  const editFrom = (index: number) => {
    if (disabled) return;
    // Full PIN: just focus so the next digit replaces (onKeyDown) or
    // Backspace trims — don't wipe on click. Partial: jump the caret.
    if (value.length < 6) onChange(value.slice(0, index));
    window.requestAnimationFrame(focusEl);
  };

  return (
    <div className="relative max-w-xs">
      <input
        ref={ref}
        id="check-pin"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={value}
        onChange={(e) =>
          onChange(e.target.value.replace(/\D/g, "").slice(0, 6))
        }
        onKeyDown={(e) => {
          // Full PIN + a new digit → replace from scratch (settings edit).
          if (
            value.length === 6 &&
            /^\d$/.test(e.key) &&
            !e.metaKey &&
            !e.ctrlKey &&
            !e.altKey
          ) {
            e.preventDefault();
            onChange(e.key);
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        aria-label="6-digit rewards check PIN"
        aria-invalid={hasError}
        // pointer-events-none so clicks hit the cells (edit-from-index);
        // keyboard still works once focused via cell click / Clear / tab.
        className="pointer-events-none absolute inset-0 z-10 w-full bg-transparent text-transparent caret-transparent outline-none"
        tabIndex={0}
      />
      <div
        className="grid grid-cols-6 gap-1.5"
        onMouseDown={(e) => {
          // Keep the input focused — prevent the cell button from
          // taking focus away before we re-focus the input.
          e.preventDefault();
        }}
      >
        {cells.map((char, i) => {
          const filled = char !== "";
          const active = !disabled && i === focusIndex;
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              tabIndex={-1}
              aria-label={`Digit ${i + 1}${char ? `: ${char}` : ", empty"}`}
              onClick={() => editFrom(i)}
              className={
                "bg-background flex h-12 items-center justify-center rounded-xl border font-mono text-xl font-semibold tabular-nums transition " +
                (hasError
                  ? "border-destructive/50"
                  : active
                    ? "border-amber-500 ring-2 ring-amber-500/20"
                    : filled
                      ? "border-foreground/20"
                      : "border-border") +
                (disabled
                  ? " cursor-not-allowed opacity-60"
                  : " cursor-text")
              }
            >
              {char || (
                <span className="text-muted-foreground/35 text-base font-normal">
                  ·
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});

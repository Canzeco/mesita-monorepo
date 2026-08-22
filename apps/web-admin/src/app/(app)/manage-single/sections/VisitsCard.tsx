"use client";

import {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Receipt } from "lucide-react";
import { setCheckGates, type AdminPlace } from "../actions";
import { useSectionDirty } from "../useSectionDirty";
import { SaveBar, SectionCard } from "../ui";

// Visits — ONE box for the visit ticket, the local context (MESITA-1148).
//
// Pato: "don't create lots of boxes. just create a box for visits / orders /
// reservations — but not fucking lots of visits." The Check PIN (MESITA-823)
// and Require bill (MESITA-898) were two cards saying the same thing twice:
// both are gates on the same check page, on the same ticket. One box, one
// save — business-web-set-check-pin takes both keys in a single call.
//
// The v4 machine underneath (MESITA-1086/1090/1092):
//   open → scanned → approved → paying → revealed
// with fix_requested (bill · proof · reward) a COLUMN at `scanned`, never a
// status: a send-back keeps the same QR. What a visit PAYS is the Promos
// grid; the tip chips, poll cadence and pay rails are Visits Config. Only
// these two gates are the place's own call.
const LIFECYCLE = ["Open", "Scanned", "Approved", "Paying", "Closed"];

export function VisitsCard({ place }: { place: AdminPlace }) {
  const savedPin = useMemo(
    () => (typeof place.check_pin === "string" ? place.check_pin : ""),
    [place.check_pin],
  );
  const savedRequireBill = place.check_require_bill === true;

  const [pin, setPin] = useState(savedPin);
  const [requireBill, setRequireBill] = useState(savedRequireBill);
  const [current, setCurrent] = useState({
    pin: savedPin,
    requireBill: savedRequireBill,
  });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  const dirty = pin !== current.pin || requireBill !== current.requireBill;
  const valid = pin === "" || /^[0-9]{6}$/.test(pin);

  const resetDraft = useCallback(() => {
    setPin(current.pin);
    setRequireBill(current.requireBill);
    setError(null);
    setOk(false);
  }, [current]);
  useSectionDirty("visits", dirty, resetDraft);

  const focusPin = () => {
    window.requestAnimationFrame(() => pinInputRef.current?.focus());
  };

  const save = () => {
    if (!valid) {
      setError("The PIN must be exactly 6 digits — or empty to turn the gate off.");
      return;
    }
    setError(null);
    setOk(false);
    start(async () => {
      const r = await setCheckGates(place.id, {
        pin: pin === "" ? null : pin,
        requireBill,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const next = { pin: r.data.pin ?? "", requireBill: r.data.requireBill };
      setCurrent(next);
      setPin(next.pin);
      setRequireBill(next.requireBill);
      setOk(true);
      window.setTimeout(() => setOk(false), 2500);
    });
  };

  const gatesOn = (current.pin !== "" ? 1 : 0) + (current.requireBill ? 1 : 0);

  return (
    <SectionCard
      icon={<Receipt className="h-4 w-4" />}
      tint="amber"
      title="Visits"
      action={
        <span
          className={
            "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold " +
            (gatesOn > 0
              ? "bg-amber-500/10 text-amber-700"
              : "bg-muted text-muted-foreground")
          }
        >
          {gatesOn === 0
            ? "No gates"
            : gatesOn === 1
              ? "1 gate on"
              : "2 gates on"}
        </span>
      }
    >
      <ol className="mt-5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {LIFECYCLE.map((step, i) => (
          <li key={step} className="flex items-center gap-1.5">
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
              {step}
            </span>
            {i < LIFECYCLE.length - 1 ? (
              <span className="text-muted-foreground/50 text-[10px]" aria-hidden>
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="border-border/60 mt-5 border-t pt-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-foreground/90 text-[13px] font-medium">
            Bill amount required
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={requireBill}
            aria-label={`Bill amount required ${requireBill ? "on" : "off"}`}
            disabled={pending}
            onClick={() => setRequireBill((v) => !v)}
            className={
              "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-50 " +
              (requireBill ? "bg-pink-gradient" : "bg-border")
            }
          >
            <span
              className={
                "absolute h-4 w-4 rounded-full bg-white shadow transition " +
                (requireBill ? "translate-x-4" : "translate-x-0.5")
              }
            />
          </button>
        </div>
      </div>

      <div className="border-border/60 mt-4 border-t pt-4">
        <div className="flex min-h-4 items-center justify-between gap-2">
          <span className="text-foreground/90 text-[13px] font-medium">
            Staff PIN
          </span>
          {pin !== "" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setPin("");
                focusPin();
              }}
              className="text-muted-foreground hover:text-foreground text-[11px] font-medium underline-offset-2 hover:underline disabled:opacity-50"
            >
              Clear to edit
            </button>
          ) : null}
        </div>
        <p className="text-muted-foreground mt-1.5 mb-2.5 text-[11px] leading-relaxed">The QR is the authentication — anyone holding it can work the ticket.</p>
        <PinDigits
          ref={pinInputRef}
          value={pin}
          onChange={setPin}
          disabled={pending}
          hasError={pin !== "" && !valid}
        />
        {pin !== "" && !valid ? (
          <span className="mt-1.5 block text-xs font-medium text-amber-700">
            Needs all 6 digits.
          </span>
        ) : (
          <span className="text-muted-foreground mt-1.5 block text-[11px]">
            Click a digit to edit from there · type over a full PIN to replace
            it · clear all six to turn the gate off.
          </span>
        )}
      </div>

      <SaveBar
        pending={pending}
        dirtyLabel="Visits · unsaved"
        dirty={dirty}
        ok={ok}
        error={error}
        onSave={save}
        onCancel={resetDraft}
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
  const focusIndex = !focused ? -1 : value.length < 6 ? value.length : 5;

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
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
        aria-label="6-digit staff PIN"
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
                (disabled ? " cursor-not-allowed opacity-60" : " cursor-text")
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

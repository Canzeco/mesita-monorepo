"use client";

import { useMemo, useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { setCheckPin, type AdminPlace } from "../actions";
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

  const dirty = pin !== current;
  const valid = pin === "" || /^[0-9]{6}$/.test(pin);

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
        <span className="text-foreground/90 flex min-h-4 items-center text-[13px] font-medium">
          PIN
        </span>
        <PinDigits
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
            Six digits turns the gate on · clear all to turn it off.
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

// 6-cell digit input (same pattern as web-business OtpInput). Native <input>
// sits invisibly over the cells so paste + numeric keypad keep working.
function PinDigits({
  value,
  onChange,
  disabled,
  hasError,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
  hasError: boolean;
}) {
  const cells = Array.from({ length: 6 }, (_, i) => value[i] ?? "");
  const focusIndex = value.length < 6 ? value.length : -1;

  return (
    <div className="relative max-w-xs">
      <input
        id="check-pin"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={value}
        onChange={(e) =>
          onChange(e.target.value.replace(/\D/g, "").slice(0, 6))
        }
        disabled={disabled}
        aria-label="6-digit rewards check PIN"
        aria-invalid={hasError}
        className="absolute inset-0 z-10 w-full cursor-text bg-transparent text-transparent caret-transparent outline-none disabled:cursor-not-allowed"
      />
      <div className="grid grid-cols-6 gap-1.5">
        {cells.map((char, i) => {
          const filled = char !== "";
          const focused = !disabled && i === focusIndex;
          return (
            <div
              key={i}
              aria-hidden
              className={
                "bg-background flex h-12 items-center justify-center rounded-xl border font-mono text-xl font-semibold tabular-nums transition " +
                (hasError
                  ? "border-destructive/50"
                  : focused
                    ? "border-amber-500 ring-2 ring-amber-500/20"
                    : filled
                      ? "border-foreground/20"
                      : "border-border") +
                (disabled ? " opacity-60" : "")
              }
            >
              {char || (
                <span className="text-muted-foreground/35 text-base font-normal">
                  ·
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

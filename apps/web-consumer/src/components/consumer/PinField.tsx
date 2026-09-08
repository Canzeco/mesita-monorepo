"use client";

// The ten-digit code field (MESITA-1672), extracted from `InvitePinModal`.
//
// WHY THE FIELD AND NOT THE SHEET. Credits gifting redeems a 10-digit code
// too, and its screen cannot be a `LocalSheet`: a gift link lands a stranger
// on a public route, outside the (shell) auth wall. So the reusable part was
// never the sheet — it is this input and the rules baked into it.
//
// NUMERIC ON PURPOSE. A code gets read off a card, a screenshot or a WhatsApp
// message, so `inputMode="numeric"` raises the phone keypad and there is no
// case or letter/number ambiguity to get wrong. Anything that is not a digit
// is stripped as the guest types, because people paste codes with spaces and
// dashes in them.
//
// THE ERROR IS IN THE DOM, NOT A TOAST. The Toaster sits at z-140, is not
// reliably announced, and cannot be re-read a second later. A code that
// failed is exactly the thing a guest re-reads while checking their typing,
// and on the Credits path it is money. `aria-describedby` binds both the
// counter and the error to the input, so a screen reader gets "3 of 10" and
// the failure without hunting for them.

import { cn } from "@/lib/utils";

export const PIN_LENGTH = 10;

/** Digits only, capped at `length`. Pure so the paste cases can be tested —
 *  nothing else in this component can be, with no DOM in the test runner. */
export function pinDigits(raw: string, length: number = PIN_LENGTH): string {
  return raw.replace(/\D/g, "").slice(0, length);
}

export function PinField({
  id,
  label,
  value,
  onChange,
  error,
  disabled,
  length = PIN_LENGTH,
}: {
  id: string;
  label: string;
  /** Digits only — the caller holds what `pinDigits` returned. */
  value: string;
  onChange: (digits: string) => void;
  error?: string | null;
  disabled?: boolean;
  length?: number;
}) {
  const countId = `${id}-count`;
  const errorId = `${id}-error`;

  return (
    <>
      <label
        htmlFor={id}
        className="text-muted-foreground type-label block font-medium"
      >
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(pinDigits(e.target.value, length))}
        placeholder={"0".repeat(length)}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={length}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${countId} ${errorId}` : countId}
        data-field-size="lg"
        className={cn(
          "bg-muted/30 placeholder:text-muted-foreground/70 mt-1 h-12 w-full rounded-lg border px-5 text-center font-mono text-lg tracking-[0.3em] tabular-nums outline-none",
          error ? "border-destructive" : "border-border",
        )}
      />
      <p
        id={countId}
        className="text-muted-foreground type-label mt-2 text-center"
      >
        {value.length}/{length}
      </p>
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-destructive type-label mt-1 text-center"
        >
          {error}
        </p>
      ) : null}
    </>
  );
}

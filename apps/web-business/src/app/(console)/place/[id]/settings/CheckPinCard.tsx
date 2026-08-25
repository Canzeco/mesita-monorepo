"use client";

import {
  forwardRef,
  useRef,
  useState,
  useTransition,
  type Ref,
} from "react";
import { KeyRound } from "lucide-react";

import { apiSetCheckPin } from "@/lib/api/check-pin";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  ERROR_BOX_CLASS,
  INFO_BOX_CLASS,
  PILL_BUTTON_CLASS,
} from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";

// Optional shared staff gate on Mesita Check (MESITA-823). One 6-digit
// secret per place — not a waiter identity. Owners set/clear it here;
// editors/viewers never see this card (the EF is owner-gated and overview
// only returns the value to owners).

export function CheckPinCard({
  projectId,
  initialPin,
}: {
  projectId: string;
  initialPin: string | null;
}) {
  const supabase = useBrowserSupabase();
  const saved = typeof initialPin === "string" ? initialPin : "";
  const [pin, setPin] = useState(saved);
  const [current, setCurrent] = useState(saved);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  const dirty = pin !== current;
  const valid = pin === "" || /^[0-9]{6}$/.test(pin);

  const focusPin = () => {
    window.requestAnimationFrame(() => pinInputRef.current?.focus());
  };

  const clearPin = () => {
    setPin("");
    focusPin();
  };

  const save = () => {
    if (!valid) {
      setError(
        "The PIN must be exactly 6 digits — or empty to turn the gate off.",
      );
      return;
    }
    setError(null);
    setOk(false);
    start(async () => {
      try {
        const r = await apiSetCheckPin(supabase, {
          projectId,
          pin: pin === "" ? null : pin,
        });
        const next = r.pin ?? "";
        setCurrent(next);
        setPin(next);
        setOk(true);
        window.setTimeout(() => setOk(false), 2500);
      } catch (err) {
        setError(errMsg(err, "Couldn't update the Check PIN."));
      }
    });
  };

  return (
    <section className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex items-start gap-3">
        <span className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
          <KeyRound className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-foreground text-sm font-semibold">
                Check PIN
              </h2>
              <p className="text-muted-foreground mt-0.5 text-[13px] leading-snug">
                Optional 6-digit code staff must enter on Mesita Validate before
                billing or closing a ticket.
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                current
                  ? "bg-foreground/8 text-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {current ? "On" : "Off"}
            </span>
          </div>
        </div>
      </div>

      <p className="text-muted-foreground text-[12px] leading-relaxed">
        The QR authenticates the ticket — anyone holding it can work it. Turn
        this on so floor staff also need a shared code, and a guest (or anyone
        who photographed the QR) can&apos;t self-bill. Viewing never asks for
        it; only bill, story/review verdicts, and &ldquo;paid received&rdquo;
        do. Clear all six digits to keep the two-tap close.
      </p>

      <div className="flex flex-col gap-1.5">
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

      {(dirty || error || ok) && (
        <div className="flex flex-col gap-2">
          {error ? <div className={ERROR_BOX_CLASS}>{error}</div> : null}
          {ok && !dirty ? (
            <div className={INFO_BOX_CLASS}>Check PIN saved.</div>
          ) : null}
          {dirty ? (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setPin(current);
                  setError(null);
                  setOk(false);
                }}
                className="text-muted-foreground hover:text-foreground rounded-full px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || !valid}
                onClick={save}
                className={cn(PILL_BUTTON_CLASS, "disabled:opacity-60")}
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

// 6-cell digit input — same interaction model as admin CheckPinCard
// (MESITA-884): cells stay clickable so a set PIN can be edited; a new
// digit on a full PIN replaces from scratch. Calm business chrome only.
const PinDigits = forwardRef(function PinDigits(
  {
    value,
    onChange,
    disabled,
    hasError,
  }: {
    value: string;
    onChange: (next: string) => void;
    disabled: boolean;
    hasError: boolean;
  },
  ref: Ref<HTMLInputElement>,
) {
  const [focused, setFocused] = useState(false);
  const cells = Array.from({ length: 6 }, (_, i) => value[i] ?? "");
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
        aria-label="6-digit Check PIN"
        aria-invalid={hasError}
        className="pointer-events-none absolute inset-0 z-10 w-full bg-transparent text-transparent caret-transparent outline-none"
        tabIndex={0}
      />
      <div
        className="grid grid-cols-6 gap-1.5"
        onMouseDown={(e) => {
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
              className={cn(
                "bg-background flex h-12 items-center justify-center rounded-xl border font-mono text-xl font-semibold tabular-nums transition",
                hasError
                  ? "border-destructive/50"
                  : active
                    ? "border-foreground/50 ring-foreground/10 ring-2"
                    : filled
                      ? "border-foreground/20"
                      : "border-border",
                disabled ? "cursor-not-allowed opacity-60" : "cursor-text",
              )}
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

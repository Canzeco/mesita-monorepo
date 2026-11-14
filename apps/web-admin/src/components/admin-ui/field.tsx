"use client";

import { useState } from "react";
import { ChevronDown, Lock, Search } from "lucide-react";
import { cn } from "./cn";

import { Input, INPUT_CLASS } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  COUNTRIES,
  COUNTRY_BY_CODE,
  combinePhoneE164,
  splitStoredPhone,
} from "@/lib/phone-countries";

// Fields (MESITA-3948): one look — rounded-xl, bordered, 44px below sm and
// 40px above, 16px text below sm (iOS zoom). Every labelled field sits in
// FieldWell: label row, control, hint. `well` draws the bordered box config
// pages stack their knobs in.

export function FieldWell({
  label,
  icon,
  hint,
  labelRight,
  well = false,
  as = "label",
  className,
  children,
}: {
  label: React.ReactNode;
  /** A leading mark next to the label (brand SVG or lucide). */
  icon?: React.ReactNode;
  hint?: React.ReactNode;
  /** A trailing accessory in the label row (an "Open ↗" link, a range). */
  labelRight?: React.ReactNode;
  /** The bordered box config pages use. */
  well?: boolean;
  /** `div` when the control is a group of buttons, not one input. */
  as?: "label" | "div";
  className?: string;
  children: React.ReactNode;
}) {
  const Root = as;
  return (
    <Root
      className={cn(
        "flex min-w-0 flex-col gap-1.5",
        well && "border-border bg-background gap-2 rounded-xl border p-4",
        className,
      )}
    >
      <span className="flex min-h-4 items-start justify-between gap-3">
        <span className="flex min-w-0 items-start gap-2 text-sm leading-snug font-medium">
          {icon}
          {label}
        </span>
        {labelRight}
      </span>
      {children}
      {hint ? <span className="text-muted-foreground type-meta">{hint}</span> : null}
    </Root>
  );
}

type InputProps = Omit<React.ComponentProps<"input">, "value" | "onChange" | "className">;

/** A text input. With a label it sits in FieldWell; without one it is a bare toolbar field. */
export function TextField({
  label,
  icon,
  hint,
  labelRight,
  leading,
  well,
  value,
  onChange,
  className,
  ...rest
}: InputProps & {
  label?: string;
  icon?: React.ReactNode;
  hint?: React.ReactNode;
  labelRight?: React.ReactNode;
  /** An adornment inside the input's left edge. */
  leading?: React.ReactNode;
  well?: boolean;
  value: string;
  /** Omitted = read-only. */
  onChange?: (v: string) => void;
  className?: string;
}) {
  const field = (
    <span className={cn("relative block", !label && className)}>
      {leading ? (
        <span className="pointer-events-none absolute top-1/2 left-3 flex -translate-y-1/2 items-center">
          {leading}
        </span>
      ) : null}
      <Input
        {...rest}
        value={value}
        readOnly={!onChange || rest.readOnly}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={leading ? "pl-9" : undefined}
      />
    </span>
  );
  if (!label) return field;
  return (
    <FieldWell label={label} icon={icon} hint={hint} labelRight={labelRight} well={well} className={className}>
      {field}
    </FieldWell>
  );
}

/** An input with a leading search glyph. */
export function SearchField(props: Omit<Parameters<typeof TextField>[0], "leading" | "type">) {
  return (
    <TextField
      type="search"
      leading={<Search aria-hidden className="text-muted-foreground h-4 w-4" />}
      {...props}
    />
  );
}

export function TextAreaField({
  label,
  labelRight,
  hint,
  well,
  value,
  onChange,
  rows = 4,
  className,
  ...rest
}: Omit<React.ComponentProps<"textarea">, "value" | "onChange" | "className"> & {
  label: string;
  labelRight?: React.ReactNode;
  hint?: React.ReactNode;
  well?: boolean;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <FieldWell label={label} labelRight={labelRight} hint={hint} well={well} className={className}>
      <Textarea {...rest} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </FieldWell>
  );
}

/** A native <select> (the iOS picker), in the field look. */
export function SelectField({
  label,
  hint,
  well,
  value,
  onChange,
  className,
  children,
  ...rest
}: Omit<React.ComponentProps<"select">, "value" | "onChange" | "className"> & {
  label?: string;
  hint?: React.ReactNode;
  well?: boolean;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const field = (
    <span className={cn("relative block", !label && className)}>
      <select
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(INPUT_CLASS, "appearance-none pr-9")}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
    </span>
  );
  if (!label) return field;
  return (
    <FieldWell label={label} hint={hint} well={well} className={className}>
      {field}
    </FieldWell>
  );
}

/** A keystroke the operator may keep. Empty, "0." and "0" are drafts, not rejections. */
export function numberDraftAllowed(raw: string, decimals: boolean, min: number): boolean {
  if (raw === "") return true;
  const negative = min < 0;
  const re = decimals
    ? negative
      ? /^-?\d*\.?\d*$/
      : /^\d*\.?\d*$/
    : negative
      ? /^-?\d*$/
      : /^\d*$/;
  return re.test(raw);
}

/**
 * A finished draft becomes a number. `null` means leave the stored value:
 * the draft is unfinished, or it is outside the range and `clamp` is off
 * (live typing). Blur passes `clamp` so a finished number lands inside
 * min–max. Decimal knobs keep two places.
 */
export function commitNumberDraft(
  raw: string,
  opts: { decimals: boolean; min: number; max: number; clamp: boolean },
): number | null {
  const body = opts.decimals ? raw.trim().replace(",", ".") : raw.trim();
  if (!numberDraftAllowed(body, opts.decimals, opts.min)) return null;
  if (body === "" || body === "-" || body === "." || body === "-." || body.endsWith(".")) return null;
  const n = Number(body);
  if (!Number.isFinite(n)) return null;
  const rounded = opts.decimals ? Math.round(n * 100) / 100 : Math.round(n);
  if (!opts.clamp && (rounded < opts.min || rounded > opts.max)) return null;
  return Math.max(opts.min, Math.min(opts.max, rounded));
}

/** A bounded number, typed as text (MESITA-2733), in a config well with its range. */
export function NumberField({
  icon,
  label,
  value,
  min,
  max,
  decimals,
  onChange,
  disabled,
  hint,
  well = true,
}: {
  icon?: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  decimals?: boolean;
  onChange: (v: number) => void;
  disabled: boolean;
  /** One line under the input: what moving the number does. */
  hint?: React.ReactNode;
  well?: boolean;
}) {
  // Text, not type=number: the spinner steps by 0.25, and a controlled
  // number snaps "0." and a cleared field back to the minimum, so a value
  // like 0.5 cannot be typed (MESITA-2733).
  const [draft, setDraft] = useState<string | null>(null);
  const fractional = !!decimals;
  const shown = draft ?? String(value);

  function apply(raw: string, clamp: boolean) {
    const next = commitNumberDraft(raw, { decimals: fractional, min, max, clamp });
    if (next != null && next !== value) onChange(next);
  }

  return (
    <FieldWell
      label={label}
      icon={icon}
      hint={hint}
      well={well}
      labelRight={
        <span className="text-muted-foreground type-meta shrink-0 tabular-nums">
          {min}–{max}
        </span>
      }
    >
      <Input
        type="text"
        inputMode={fractional ? "decimal" : "numeric"}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
        value={shown}
        disabled={disabled}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const next = fractional ? e.target.value.replace(",", ".") : e.target.value;
          if (!numberDraftAllowed(next, fractional, min)) return;
          setDraft(next);
          apply(next, false);
        }}
        onBlur={() => {
          if (draft != null) apply(draft, true);
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="text-right tabular-nums"
      />
    </FieldWell>
  );
}

// Phone input with a dial-code + flag picker. The left chip is styled text
// with a transparent native <select> over it, so desktop gets click-to-open
// and any touch device its proper picker. `value` is the FULL stored phone;
// onChange always emits strict E.164 (+<dial><digits>).
export function PhoneField({
  label,
  icon,
  labelRight,
  value,
  onChange,
  placeholder = "55 1234 5678",
  disabled,
}: {
  label: string;
  icon?: React.ReactNode;
  labelRight?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  // Draft = the country + local text as last typed/picked, kept only while it
  // still matches the stored value's digits; an EXTERNAL value change
  // mismatches and the derived split takes over. Pure derivation.
  const [draft, setDraft] = useState<{ code: string; local: string; digits: string } | null>(null);
  const storedDigits = value.replace(/\D/g, "");
  const derived = splitStoredPhone(value);
  const active = draft && draft.digits === storedDigits ? draft : null;
  const code = active ? active.code : derived.countryCode;
  const local = active ? active.local : derived.local;
  const country = COUNTRY_BY_CODE[code] ?? COUNTRY_BY_CODE.MX;

  const update = (nextCode: string, nextLocal: string) => {
    const full = combinePhoneE164(nextCode, nextLocal);
    setDraft({ code: nextCode, local: nextLocal, digits: full.replace(/\D/g, "") });
    onChange(full);
  };

  return (
    <FieldWell label={label} icon={icon} labelRight={labelRight}>
      <span
        className={cn(
          "border-border bg-background focus-within:ring-ring focus-within:ring-offset-background relative flex h-11 w-full items-stretch overflow-hidden rounded-xl border transition focus-within:ring-2 focus-within:ring-offset-2 sm:h-10",
          disabled && "opacity-50",
        )}
      >
        <span className="border-border flex shrink-0 items-center gap-1.5 border-r pr-2.5 pl-3">
          <span className="text-base leading-none" aria-hidden>
            {country.flag}
          </span>
          <span className="text-sm font-medium tabular-nums">+{country.dial}</span>
          <ChevronDown className="text-muted-foreground h-3 w-3" aria-hidden />
        </span>
        <select
          value={code}
          disabled={disabled}
          onChange={(e) => update(e.target.value, local)}
          aria-label="Country dial code"
          className="absolute inset-y-0 left-0 w-[5.5rem] cursor-pointer appearance-none bg-transparent text-transparent opacity-0 disabled:cursor-default"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} +{c.dial} {c.name}
            </option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="tel"
          value={local}
          disabled={disabled}
          onChange={(e) => update(code, e.target.value)}
          placeholder={placeholder}
          autoComplete="tel-national"
          className="placeholder:text-muted-foreground/60 h-full flex-1 bg-transparent px-3 text-base outline-none sm:text-sm"
        />
      </span>
    </FieldWell>
  );
}

/** A labelled read-only value. `auto` marks an Enricher-owned value. */
export function ReadField({
  label,
  icon,
  auto,
  boxed,
  labelRight,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  auto?: boolean;
  /** Draw the value like a disabled field, flush with editable fields beside it. */
  boxed?: boolean;
  labelRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="flex min-h-4 items-center justify-between gap-2">
        <span
          className={
            boxed
              ? "flex items-center gap-1.5 text-sm font-medium"
              : "type-eyebrow text-muted-foreground flex items-center gap-1.5"
          }
        >
          {icon}
          {label}
          {auto ? (
            <span className="text-muted-foreground/70 inline-flex items-center gap-0.5 type-meta font-normal tracking-normal normal-case">
              <Lock aria-hidden className="h-3 w-3" />
              auto
            </span>
          ) : null}
        </span>
        {labelRight}
      </span>
      <div
        className={
          boxed
            ? "border-border bg-muted/40 flex min-h-11 min-w-0 items-center rounded-xl border px-3 text-sm sm:min-h-10"
            : "flex min-h-9 items-center text-sm"
        }
      >
        {children}
      </div>
    </div>
  );
}


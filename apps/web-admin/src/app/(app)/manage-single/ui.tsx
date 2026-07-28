"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, Loader2 } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import {
  COUNTRIES,
  COUNTRY_BY_CODE,
  combinePhoneE164,
  splitStoredPhone,
} from "@/lib/phone-countries";

// Shared primitives for the single-unit console sections. Light-themed admin
// surface — semantic tokens, calm and high-density, with a premium finish:
// tinted icon chips (one hue per card so siblings scan apart), Fraunces
// display titles, filled inputs, and a brand-gradient save pill.

/** Fixed tint palette for card icon chips — differentiated, never loud. */
export type Tint =
  | "rose"
  | "pink"
  | "amber"
  | "sky"
  | "violet"
  | "emerald"
  | "teal"
  | "orange"
  | "indigo"
  | "slate";

const TINT_CHIP: Record<Tint, string> = {
  rose: "bg-rose-500/10 text-rose-600",
  pink: "bg-pink-500/10 text-pink-600",
  amber: "bg-amber-500/10 text-amber-600",
  sky: "bg-sky-500/10 text-sky-600",
  violet: "bg-violet-500/10 text-violet-600",
  emerald: "bg-emerald-500/10 text-emerald-600",
  teal: "bg-teal-500/10 text-teal-600",
  orange: "bg-orange-500/10 text-orange-600",
  indigo: "bg-indigo-500/10 text-indigo-600",
  slate: "bg-muted text-muted-foreground",
};

export function SectionCard({
  icon,
  tint = "slate",
  title,
  subtitle,
  action,
  children,
}: {
  icon?: React.ReactNode;
  /** Icon-chip hue — keep sibling cards on different tints. */
  tint?: Tint;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-card shadow-card rounded-2xl border p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {icon != null && (
            <span
              className={
                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl " +
                TINT_CHIP[tint]
              }
            >
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
            {subtitle && (
              <p className="text-muted-foreground mt-0.5 max-w-2xl text-xs leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Uppercase micro-heading used to split a card into labelled groups. */
export function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
      {children}
    </p>
  );
}

// Filled fields with a visible resting edge — a hairline border on the gray
// well makes fields read as fields on the white card (the old transparent
// border left them as faint smudges at a glance).
const INPUT_BASE =
  "w-full rounded-xl border border-border/60 bg-muted/60 text-sm outline-none transition " +
  "placeholder:text-muted-foreground/50 focus:border-ring/60 focus:bg-card focus:ring-4 " +
  "focus:ring-ring/10 disabled:opacity-50";

export function TextField({
  label,
  icon,
  leading,
  labelRight,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
  maxLength,
}: {
  label: string;
  /** Optional leading mark next to the label (brand SVG or lucide). */
  icon?: React.ReactNode;
  /** Optional adornment rendered inside the input's left edge. */
  leading?: React.ReactNode;
  /** Optional trailing accessory in the label row (e.g. an "Open ↗" link). */
  labelRight?: React.ReactNode;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="flex min-h-4 items-center justify-between gap-2">
        <span className="text-foreground/90 flex items-center gap-1.5 text-[13px] font-medium">
          {icon}
          {label}
        </span>
        {labelRight}
      </span>
      <span className="relative block">
        {leading ? (
          <span className="pointer-events-none absolute top-1/2 left-3 flex -translate-y-1/2 items-center">
            {leading}
          </span>
        ) : null}
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          readOnly={!onChange}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className={INPUT_BASE + " h-10 " + (leading ? "pr-3.5 pl-9" : "px-3.5")}
        />
      </span>
    </label>
  );
}

// Phone input with a dial-code + flag picker, ported from the consumer app's
// PhoneInputWithCountry and restyled to the admin filled-input language. The
// left chip is a styled "button" with a transparent native <select> overlaid,
// so desktop gets click-to-open and any touch device its proper picker.
//
// `value` is the FULL stored phone ("+527221234567" or legacy "+1 703-858-1102");
// onChange always emits strict E.164 (+<dial><digits>) — the update EF rejects
// phones without a country code, and the picker makes the +CC unforgettable.
export function PhoneField({
  label,
  value,
  onChange,
  placeholder = "55 1234 5678",
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  // Draft = the country + local text as last typed/picked, kept only while it
  // still matches the stored value's digits. Typing keeps the user's spacing
  // and an empty local keeps the picked flag; an EXTERNAL value change (form
  // reset, place switch) mismatches and the derived split takes over. Pure
  // derivation — no sync effects.
  const [draft, setDraft] = useState<{
    code: string;
    local: string;
    digits: string;
  } | null>(null);
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
    <label className="flex flex-col gap-1.5">
      <span className="text-foreground/90 flex min-h-4 items-center text-[13px] font-medium">
        {label}
      </span>
      <span
        className={
          "bg-muted/60 border-border/60 focus-within:border-ring/60 focus-within:bg-card " +
          "focus-within:ring-ring/10 relative flex h-10 w-full items-stretch overflow-hidden " +
          "rounded-xl border transition focus-within:ring-4" +
          (disabled ? " opacity-50" : "")
        }
      >
        <span className="border-border/60 flex shrink-0 items-center gap-1.5 border-r pr-2.5 pl-3">
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
          className="placeholder:text-muted-foreground/50 h-full flex-1 bg-transparent px-3 text-sm outline-none"
        />
      </span>
    </label>
  );
}

export function TextArea({
  label,
  labelRight,
  value,
  onChange,
  rows = 4,
  maxLength,
  placeholder,
  disabled,
}: {
  label: string;
  labelRight?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between gap-2">
        <span className="text-foreground/80 text-[13px] font-medium">{label}</span>
        {labelRight}
      </span>
      <textarea
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_BASE + " px-3.5 py-2.5 leading-relaxed"}
      />
    </label>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-foreground/80 text-[13px] font-medium">{label}</span>
      <span className="relative block">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT_BASE + " h-10 appearance-none pr-9 pl-3.5"}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2"
          aria-hidden
        />
      </span>
    </label>
  );
}

export function SaveBar({
  pending,
  dirty,
  ok,
  onSave,
  onCancel,
  label = "Save changes",
  cancelLabel = "Cancel",
  dirtyLabel,
  error,
}: {
  pending: boolean;
  dirty: boolean;
  ok: boolean;
  onSave: () => void;
  /** Revert this box to its last-saved values. Cancel only renders when given. */
  onCancel?: () => void;
  label?: string;
  cancelLabel?: string;
  /** e.g. "Basics · unsaved" — replaces generic copy when dirty. */
  dirtyLabel?: string;
  error?: string | null;
}) {
  const live = pending || dirty;

  return (
    <div className="border-border/60 mt-5 border-t pt-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs" aria-live="polite">
          {dirty && !pending ? (
            <span className="text-muted-foreground inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" aria-hidden />
              {dirtyLabel ?? "Unsaved changes"}
            </span>
          ) : ok && !pending ? (
            <span className="text-muted-foreground inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Saved
            </span>
          ) : null}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={pending || !dirty}
              className="border-border/70 text-foreground/70 hover:bg-muted hover:text-foreground inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            >
              {cancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onSave}
            disabled={pending || !dirty}
            className={
              "inline-flex h-9 items-center gap-2 rounded-full px-5 text-sm font-semibold transition " +
              (live
                ? "bg-pink-gradient shadow-save text-white hover:brightness-105 active:scale-[0.98] disabled:opacity-80"
                : "bg-muted text-muted-foreground")
            }
          >
            {pending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
              </>
            ) : (
              label
            )}
          </button>
        </div>
      </div>
      {error ? <ErrorNote message={error} /> : null}
    </div>
  );
}


/** Shared confirm modal — focus Escape + backdrop cancel. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Dismiss"
        disabled={busy}
        className="absolute inset-0 bg-black/40"
        onClick={() => {
          if (!busy) onCancel();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="border-border bg-card relative z-10 w-full max-w-md rounded-2xl border p-5 shadow-lg"
      >
        <h2 id="confirm-dialog-title" className="font-display text-base font-semibold tracking-tight">
          {title}
        </h2>
        <div className="text-muted-foreground mt-2 text-sm leading-relaxed">{body}</div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="border-border hover:bg-muted inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={
              "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-50 " +
              (danger
                ? "bg-destructive text-destructive-foreground hover:opacity-90"
                : "bg-foreground text-background hover:opacity-90")
            }
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label ?? "Loading…"}
    </div>
  );
}

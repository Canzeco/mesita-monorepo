"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, Loader2 } from "lucide-react";

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

export const TINT_CHIP: Record<Tint, string> = {
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
    <section className="border-border/70 bg-card shadow-card rounded-2xl border p-5 sm:p-6">
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

const INPUT_BASE =
  "w-full rounded-xl border border-transparent bg-muted/50 text-sm outline-none transition " +
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
    <label className="flex flex-col gap-1.5">
      <span className="flex min-h-4 items-center justify-between gap-2">
        <span className="text-foreground/80 flex items-center gap-1.5 text-[13px] font-medium">
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
  label = "Save changes",
  error,
}: {
  pending: boolean;
  dirty: boolean;
  ok: boolean;
  onSave: () => void;
  label?: string;
  error?: string | null;
}) {
  const live = pending || dirty;
  return (
    <div className="border-border/60 mt-5 border-t pt-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs">
          {dirty && !pending ? (
            <span className="text-muted-foreground inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" aria-hidden />
              Unsaved changes
            </span>
          ) : ok ? (
            <span className="text-muted-foreground inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Saved
            </span>
          ) : null}
        </span>
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
      {error ? <ErrorNote message={error} /> : null}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="border-destructive/40 bg-destructive/5 text-destructive mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p className="font-medium">{message}</p>
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

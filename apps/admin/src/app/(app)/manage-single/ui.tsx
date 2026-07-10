"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

// Shared primitives for the single-unit console sections. Light-themed admin
// surface — semantic tokens only, calm and high-density.

export function SectionCard({
  icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-card rounded-2xl border p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon != null && (
            <span className="bg-muted inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="font-display text-[15px] font-semibold tracking-tight">{title}</h2>
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

export function TextField({
  label,
  icon,
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
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {icon}
          {label}
        </span>
        {labelRight}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        readOnly={!onChange}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="border-border bg-background h-9 w-full rounded-lg border px-3 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
      />
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
        <span className="text-sm font-medium">{label}</span>
        {labelRight}
      </span>
      <textarea
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="border-border bg-background w-full rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
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
      <span className="text-sm font-medium">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="border-border bg-background h-9 w-full rounded-lg border px-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
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
  return (
    <div className="border-border mt-5 border-t pt-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs">
          {dirty && !pending ? (
            <span className="text-muted-foreground inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
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
          className="bg-foreground text-background inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
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

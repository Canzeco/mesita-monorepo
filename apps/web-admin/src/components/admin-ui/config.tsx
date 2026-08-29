"use client";

import { CheckCircle2, ChevronRight, Loader2 } from "lucide-react";

// Shared admin config kit — `@/components/admin-ui/config`.
// Light-themed; semantic tokens only. Canonical for new config pages
// (see the web-admin design map (Notion Docs › Design)). Config pages
// import from here.

/** Matches enricher `SynthesisQuality` — kept local so the kit does not import app routes. */
export type SynthesisQuality = "economy" | "standard" | "high";

// Per-knob enforcement status (MESITA-738). The console is the operator's model
// of the product, so a control that persists but changes nothing has to SAY so
// next to itself — prose at the top of a card gets skipped, and worse, goes
// stale silently when the backend catches up. Three honest states:
//
//   enforced  — a live consumer reads this value; changing it changes behavior
//   fallback  — read only when a higher-precedence source is unset
//   not-wired — persisted, but no consumer reads it yet
//
// Keep the reason one clause and name the reader (or the thing that wins), so
// the claim is checkable against the code rather than taken on faith.
type KnobEnforcement = "enforced" | "fallback" | "not-wired";

const KNOB_STATUS: Record<KnobEnforcement, { label: string; className: string }> = {
  enforced: { label: "Enforced", className: "border-border text-foreground" },
  fallback: { label: "Fallback", className: "border-border text-muted-foreground" },
  "not-wired": { label: "Not wired", className: "border-border text-muted-foreground" },
};

export function KnobStatus({
  kind,
  reason,
}: {
  kind: KnobEnforcement;
  reason: string;
}) {
  const s = KNOB_STATUS[kind];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 type-meta font-semibold tracking-wide uppercase ${s.className}`}
      >
        {s.label}
      </span>
      <span className="text-muted-foreground type-label font-normal">{reason}</span>
    </span>
  );
}

// Uniform config card: icon + title + one-line subtitle + optional status,
// then the controls. The single wrapper keeps every section consistent.
export function SectionCard({
  icon,
  title,
  subtitle,
  status,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-card rounded-2xl border p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="font-display text-base font-semibold tracking-tight">
              {title}
            </h2>
          </div>
          {subtitle && (
            <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {status ? <div className="shrink-0">{status}</div> : null}
      </div>
      {children}
    </section>
  );
}

// Native disclosure used to tuck the page's densest blocks (the per-step
// source list, the vision prompts, the cost breakdown) out of the default
// view — open on demand, no JS state.
export function Collapsible({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="group mt-5" open={defaultOpen || undefined}>
      <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
        {summary}
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

export function Switch({
  on,
  pending,
  onClick,
  label,
}: {
  on: boolean;
  pending: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={on}
      aria-label={label}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
        on ? "bg-foreground" : "bg-muted"
      }`}
    >
      <span
        className={`bg-background inline-block h-5 w-5 rounded-full shadow transition-transform ${
          on ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  disabled,
  rows = 4,
  maxLength = 4000,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
      <span className="text-sm font-medium">{label}</span>
      <textarea
        value={value}
        disabled={disabled}
        rows={rows}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="border-border bg-card focus:border-foreground min-h-24 rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none disabled:opacity-50"
      />
    </label>
  );
}

export function NumberField({
  icon,
  label,
  value,
  min,
  max,
  decimals,
  onChange,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  decimals?: boolean;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
      <span className="flex items-start gap-2 text-sm font-medium leading-snug">
        {icon}
        {label}
      </span>
      <input
        type="number"
        inputMode={decimals ? "decimal" : "numeric"}
        min={min}
        max={max}
        step={decimals ? 0.25 : 1}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const raw = Number(e.target.value);
          if (Number.isNaN(raw)) return;
          const n = decimals ? Math.round(raw * 100) / 100 : Math.round(raw);
          onChange(Math.max(min, Math.min(max, n)));
        }}
        className="border-border bg-card focus:border-foreground h-9 w-full rounded-lg border px-3 text-right text-sm tabular-nums outline-none disabled:opacity-50"
      />
    </label>
  );
}

export type QueryCapRung = {
  key: string;
  label: string;
  icon: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
};

function QueryCapRow({
  rung,
  min,
  max,
  disabled,
}: {
  rung: QueryCapRung;
  min: number;
  max: number;
  disabled: boolean;
}) {
  return (
    <label className="border-border bg-background flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-sm font-medium leading-snug">
        {rung.icon}
        {rung.label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={rung.value}
        disabled={disabled}
        aria-label={rung.label}
        onChange={(e) => {
          const raw = Number(e.target.value);
          if (Number.isNaN(raw)) return;
          rung.onChange(Math.max(min, Math.min(max, Math.round(raw))));
        }}
        className="border-border bg-card focus:border-foreground h-11 w-16 shrink-0 rounded-lg border px-2 text-right text-sm tabular-nums outline-none disabled:opacity-50 sm:w-20"
      />
    </label>
  );
}

/**
 * Independent query caps, listed in concat order. Overlaps drop; the earlier
 * query keeps the slot. Not a nested filter — each number is its own fetch.
 */
export function QueryConcatCaps({
  rule,
  queries,
  min,
  max,
  disabled,
}: {
  rule: string;
  queries: QueryCapRung[];
  min: number;
  max: number;
  disabled: boolean;
}) {
  return (
    <div className="mt-5">
      <p className="type-label text-muted-foreground mb-1 font-semibold tracking-wide">
        Queries
      </p>
      <p className="text-muted-foreground mb-3 type-meta">{rule}</p>
      <div className="flex flex-col gap-1.5">
        {queries.map((rung) => (
          <QueryCapRow
            key={rung.key}
            rung={rung}
            min={min}
            max={max}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

/** Same box chrome as NumberField. The control is a categorical picker. */
export function ChoiceField({
  icon,
  label,
  hint,
  children,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "border-border bg-background flex flex-col gap-2 rounded-xl border p-4" +
        (className ? ` ${className}` : "")
      }
    >
      <span className="flex items-start gap-2 text-sm font-medium leading-snug">
        {icon}
        {label}
      </span>
      {hint ? (
        <p className="text-muted-foreground type-meta">{hint}</p>
      ) : null}
      {children}
    </div>
  );
}

const COMPACT_FIELD =
  "border-border bg-background focus:border-foreground h-10 w-full rounded-xl border px-3 text-sm outline-none disabled:opacity-50";

/** Config-skin text input. Labelled = stacked well (like NumberField). No label = compact toolbar field. */
export function TextField({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  placeholder,
  autoComplete,
  spellCheck,
  maxLength,
  onKeyDown,
  className,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  type?: "text" | "email";
  placeholder?: string;
  autoComplete?: string;
  spellCheck?: boolean;
  maxLength?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  const field = (
    <input
      type={type}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      autoComplete={autoComplete}
      spellCheck={spellCheck}
      maxLength={maxLength}
      onKeyDown={onKeyDown}
      onChange={(e) => onChange(e.target.value)}
      className={className ? `${COMPACT_FIELD} ${className}` : COMPACT_FIELD}
    />
  );
  if (!label) return field;
  return (
    <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
      <span className="text-sm font-medium">{label}</span>
      {field}
    </label>
  );
}

const BUTTON_TONE = {
  primary: "bg-foreground text-background hover:opacity-90",
  secondary:
    "border-border text-muted-foreground hover:bg-muted hover:text-foreground border",
  /** Filled raw-red (Database reset). `size="icon"` is quiet: glyph, red on hover. */
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
} as const;

const BUTTON_SIZE = {
  md: "h-10 px-5 text-sm",
  sm: "h-8 px-3 text-xs",
  icon: "h-8 w-8 p-0",
} as const;

const BUTTON_ICON_DANGER =
  "text-muted-foreground hover:bg-destructive/10 hover:text-destructive";

/** Config-skin button. `danger` is the raw-red exception (Database reset). */
export function Button({
  tone = "primary",
  size = "md",
  pending = false,
  disabled,
  type = "button",
  onClick,
  icon,
  title,
  "aria-label": ariaLabel,
  children,
}: {
  tone?: keyof typeof BUTTON_TONE;
  size?: keyof typeof BUTTON_SIZE;
  pending?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  /** Leading glyph on labelled buttons; omitted while `pending`. */
  icon?: React.ReactNode;
  title?: string;
  "aria-label"?: string;
  children: React.ReactNode;
}) {
  const toneClass =
    size === "icon" && tone === "danger" ? BUTTON_ICON_DANGER : BUTTON_TONE[tone];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || pending}
      title={title}
      aria-label={ariaLabel}
      className={
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 " +
        toneClass +
        " " +
        BUTTON_SIZE[size]
      }
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : size === "icon" ? (
        children
      ) : (
        icon
      )}
      {size === "icon" ? null : children}
    </button>
  );
}

export function SaveRow({
  pending,
  dirty,
  ok,
  onClick,
  loadError,
}: {
  pending: boolean;
  dirty: boolean;
  ok: boolean;
  onClick: () => void;
  /** When set, Save stays disabled — never overwrite a live singleton from a failed load (MESITA-737). */
  loadError?: string | null;
}) {
  return (
    <div className="mt-5 flex items-center gap-3">
      <Button
        pending={pending}
        disabled={!dirty || !!loadError}
        onClick={onClick}
      >
        {pending ? "Saving…" : "Save"}
      </Button>
      {ok && !dirty && (
        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Saved
        </span>
      )}
    </div>
  );
}


// Shared economy/standard/high segmented picker used by the calculator and the
// inline cost card. High is identical to Standard in enrich-config.ts
// (both gpt-4o) — label it so the calculator doesn't imply a third tier.
const QUALITY_PICKER_LABEL: Record<SynthesisQuality, string> = {
  economy: "economy",
  standard: "standard",
  high: "high (=std)",
};

export function QualityPicker({
  value,
  onChange,
}: {
  value: SynthesisQuality;
  onChange: (v: SynthesisQuality) => void;
}) {
  return (
    <div className="flex w-full gap-1">
      {(["economy", "standard", "high"] as SynthesisQuality[]).map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onChange(q)}
          title={q === "high" ? "Identical to Standard (gpt-4o) — no-op tier" : undefined}
          className={`h-8 flex-1 rounded-lg border px-2 text-xs font-semibold transition ${
            value === q
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-card hover:border-foreground/40"
          }`}
        >
          {QUALITY_PICKER_LABEL[q]}
        </button>
      ))}
    </div>
  );
}

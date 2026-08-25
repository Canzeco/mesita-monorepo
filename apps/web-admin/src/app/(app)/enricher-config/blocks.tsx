"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

// Intake's page-local layout kit. Structural only — controls come from
// `@/components/admin-ui/config`. Five SectionCards own the page; these
// primitives live *inside* a card. A function is a disclosure row, never a
// card of its own (twelve stacked cards is design hard-rejection #7).

/** Muted pill. Used for flow membership, cost tier and enforcement state. */
export function Tag({
  children,
  tone = "outline",
}: {
  children: React.ReactNode;
  tone?: "outline" | "solid";
}) {
  return (
    <span
      className={
        "inline-block rounded-full px-2 py-0.5 type-meta font-semibold tracking-wide whitespace-nowrap " +
        (tone === "solid"
          ? "bg-muted text-muted-foreground"
          : "border-border text-muted-foreground border")
      }
    >
      {children}
    </span>
  );
}

/**
 * Jump chips into a function module. Anchors, not buttons — Tab reaches them
 * and Enter jumps. The hash handler on the page opens the target disclosure.
 */
export function StepChips({
  steps,
}: {
  steps: { href: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {steps.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className="bg-muted hover:bg-foreground hover:text-card focus-visible:ring-ring rounded-lg px-2.5 py-1 text-xs font-medium transition focus-visible:ring-2 focus-visible:outline-none"
        >
          {s.label}
        </Link>
      ))}
    </div>
  );
}

/**
 * Facts + step chips inside a SectionCard. No second chrome — the card is
 * already the module.
 */
export function FlowPanel({
  facts,
  steps,
  footer,
}: {
  facts: { term: string; detail: React.ReactNode }[];
  steps: { href: string; label: string }[];
  footer?: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <div className="grid gap-7 lg:grid-cols-[1fr_240px]">
        <dl className="m-0">
          {facts.map((f) => (
            <div key={f.term} className="mb-3.5 last:mb-0">
              <dt className="text-muted-foreground type-meta font-bold tracking-wider uppercase">
                {f.term}
              </dt>
              <dd className="m-0 mt-1 type-body leading-relaxed">{f.detail}</dd>
            </div>
          ))}
        </dl>
        <div>
          <p className="text-muted-foreground type-meta mb-2 font-bold tracking-wider uppercase">
            Subfunctions
          </p>
          <StepChips steps={steps} />
        </div>
      </div>
      {footer ? (
        <p className="text-muted-foreground mt-5 border-border border-t pt-4 text-xs leading-relaxed">
          {footer}
        </p>
      ) : null}
    </div>
  );
}

/**
 * CREATE · ENRICH — a box that names a flow, not a second ladder.
 * Subfunctions print once below. Chips are the run order.
 */
export function FunctionFamily({
  label,
  kicker,
  tone,
  note,
  chips,
  children,
}: {
  label: string;
  kicker: string;
  tone: "create" | "enrich" | "semantic";
  note?: React.ReactNode;
  chips?: { href: string; label: string }[];
  children?: React.ReactNode;
}) {
  const box =
    tone === "create"
      ? "border-primary/30 bg-primary/[0.035]"
      : tone === "semantic"
        ? "border-border bg-muted/60"
        : "border-border bg-card";
  const dot =
    tone === "create"
      ? "bg-primary"
      : tone === "semantic"
        ? "bg-muted-foreground"
        : "bg-foreground";
  return (
    <section className={"mt-4 first:mt-2 overflow-hidden rounded-xl border " + box}>
      <header className="border-border flex items-start gap-3 border-b px-4 py-3">
        <span className={"mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full " + dot} aria-hidden />
        <div className="min-w-0">
          <p className="type-label font-semibold tracking-[0.14em] uppercase">
            {label}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
            {kicker}
          </p>
        </div>
      </header>
      {chips || children ? (
        <div className="px-3 sm:px-4">
          {chips ? (
            <div className="py-3">
              <StepChips steps={chips} />
            </div>
          ) : null}
          {children}
        </div>
      ) : null}
      {note ? (
        <p className="text-muted-foreground border-border border-t px-4 py-2.5 text-xs leading-relaxed">
          {note}
        </p>
      ) : null}
    </section>
  );
}

/**
 * One function of the ladder, as a disclosure inside a FunctionFamily.
 * Shared functions print once. A family box is what names the type.
 */
export function FunctionModule({
  id,
  index,
  name,
  flows,
  blurb,
  knobs,
  defaultOpen = false,
  children,
}: {
  id: string;
  index: string;
  name: string;
  flows?: string;
  blurb: string;
  knobs: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    const sync = () => {
      if (decodeURIComponent(location.hash) === `#${id}`) setOpen(true);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [id]);

  return (
    <details
      id={id}
      className="border-border group/fn scroll-mt-16 border-t first:border-t-0"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="hover:bg-muted/40 flex cursor-pointer list-none items-start gap-3 py-3.5 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0 transition-transform group-open/fn:rotate-90"
        />
        <span className="text-muted-foreground type-meta mt-1 w-16 shrink-0 font-bold tracking-wider sm:w-20">
          {index}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{name}</span>
            {flows ? <Tag>{flows}</Tag> : null}
          </span>
          <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
            {blurb}
          </span>
        </span>
        <span className="text-muted-foreground type-label mt-1 hidden shrink-0 sm:inline">
          {knobs}
        </span>
      </summary>
      <div className="pb-5 pl-7 sm:pl-[7.25rem]">{children}</div>
    </details>
  );
}

/** The one-line answer a knobless function owes the operator who came looking. */
export function NoKnobs({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground m-0 max-w-2xl type-body leading-relaxed">
      {children}
    </p>
  );
}

/**
 * A function whose only knob lives in Models. Says where, rather than
 * rendering the same control twice — one value must have exactly one home.
 */
export function KnobElsewhere({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground m-0 max-w-2xl type-body leading-relaxed">
      {children}
    </p>
  );
}

/** Grid the control fields share, so every module lines up at the same rhythm. */
export function Fields({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  );
}

/**
 * Labelled native select. Native because a custom listbox would have to
 * re-earn keyboard support, and this page has no reason to spend that.
 * The label is a real <label>, never a placeholder.
 */
export function SelectField<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled: boolean;
}) {
  return (
    <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
      <span className="text-sm leading-snug font-medium">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        className="border-border bg-card focus:border-foreground h-9 w-full rounded-lg border px-2 text-sm outline-none disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? (
        <span className="text-muted-foreground type-label">{hint}</span>
      ) : null}
    </label>
  );
}

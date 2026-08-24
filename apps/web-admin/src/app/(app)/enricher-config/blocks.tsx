"use client";

import Link from "next/link";

// Intake's page-local layout kit. Three primitives, all structural — the
// controls themselves come from `@/components/admin-ui/config` as the package
// rules require. These are page structure, not chrome: promote any of them to
// admin-ui the day a second page needs one.
//
// A FUNCTION BLOCK IS A LABEL RAIL PLUS FIELDS, NEVER A CARD. Twelve stacked
// cards is design hard-rejection #7 ("app UI made of stacked cards instead of
// layout") and is exactly what the deleted version of this page did.

/** Numbered section heading. The page reads 1 Sourcing · 2 Create · 3 Enrich · 4 Functions · 5 Models. */
export function Band({
  n,
  title,
  id,
  aside,
}: {
  n: string;
  title: string;
  id?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div id={id} className="mt-11 mb-3.5 flex scroll-mt-4 items-baseline gap-3">
      <span className="font-display text-muted-foreground type-body font-bold">
        {n}
      </span>
      <h2 className="font-display text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <span className="flex-1" />
      {aside}
    </div>
  );
}

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
 * Jump chips into §4. Anchors, not buttons — Tab reaches them and Enter jumps,
 * which is the whole reason the flow blocks can act as the page's index.
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
 * A flow explained: what it is, a fact list, and its steps as jump chips.
 *
 * This is what replaced the ladder table. A table row can say what a step IS;
 * only a flow block can also say WHAT STARTS IT, which is the question an
 * operator actually arrives with.
 */
export function FlowCard({
  title,
  blurb,
  facts,
  steps,
  footer,
}: {
  title: string;
  blurb: string;
  facts: { term: string; detail: React.ReactNode }[];
  steps: { href: string; label: string }[];
  footer?: React.ReactNode;
}) {
  return (
    <section className="border-border bg-card overflow-hidden rounded-2xl border">
      <div className="border-border border-b px-5 py-4 sm:px-6">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-relaxed">
          {blurb}
        </p>
      </div>
      <div className="grid gap-7 px-5 py-5 sm:px-6 lg:grid-cols-[1fr_300px]">
        <dl className="m-0">
          {facts.map((f) => (
            <div key={f.term} className="mb-3.5 last:mb-0">
              <dt className="text-muted-foreground type-meta font-bold tracking-wider uppercase">
                {f.term}
              </dt>
              <dd className="m-0 mt-1 type-body leading-relaxed">
                {f.detail}
              </dd>
            </div>
          ))}
        </dl>
        <div>
          <p className="text-muted-foreground type-meta mb-2 font-bold tracking-wider uppercase">
            Its steps
          </p>
          <StepChips steps={steps} />
        </div>
      </div>
      {footer ? (
        <div className="border-border text-muted-foreground border-t px-5 py-4 text-xs leading-relaxed sm:px-6">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

/**
 * One function of the ladder. Shared functions (pulse, details, the semantic
 * pair) are printed ONCE with both flows on the chip — printing them under each
 * flow would invent a second ladder, and there is only ever one set of knobs.
 *
 * A function with no knobs still gets a block, and says WHY in one sentence: a
 * sentence reads as finished, an empty panel reads as broken, and hiding the
 * knobless ones is what made the old page look like the Intaker has five steps.
 */
export function FunctionBlock({
  id,
  index,
  name,
  flows,
  blurb,
  children,
}: {
  id: string;
  index: string;
  name: string;
  flows: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className="border-border grid scroll-mt-16 gap-4 border-t py-6 first:border-t-0 sm:gap-8 lg:grid-cols-[220px_1fr]"
    >
      <div>
        <div className="mb-1 flex items-center gap-2">
          <span className="text-muted-foreground type-meta font-bold tracking-wider">
            {index}
          </span>
          <Tag>{flows}</Tag>
        </div>
        <h3 className="mb-1.5 text-base font-semibold">{name}</h3>
        <p className="text-muted-foreground m-0 text-xs leading-snug">
          {blurb}
        </p>
      </div>
      <div>{children}</div>
    </div>
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
 * A function whose only knob lives in §5 Models. Says where, rather than
 * rendering the same control twice — one value must have exactly one home, or
 * setting it from either place makes it look like two knobs.
 */
export function KnobElsewhere({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground m-0 max-w-2xl type-body leading-relaxed">
      {children}
    </p>
  );
}

/** Grid the control fields share, so every block lines up at the same rhythm. */
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

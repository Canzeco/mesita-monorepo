"use client";

import Link from "next/link";
import { Collapsible } from "@/components/admin-ui/config";
import {
  fmtTime,
  money,
  type CostEstimate,
} from "./cost-model";
import type { CrenupPrompt } from "./actions";

// Crenup's page-local layout kit. Structural only — controls come from
// `@/components/admin-ui/config`. Two SectionCards own each page; these
// primitives live *inside* a card. A function is a disclosure row, never a
// card of its own.

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
function StepChips({
  steps,
}: {
  steps: { href: string; number: number; name: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {steps.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className="bg-muted hover:bg-foreground hover:text-card focus-visible:ring-ring inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition focus-visible:ring-2 focus-visible:outline-none"
        >
          <span className="text-muted-foreground tabular-nums">{s.number}</span>
          <span>{s.name}</span>
        </Link>
      ))}
    </div>
  );
}

/**
 * Chips + estimate inside a SectionCard, then a couple of one-line facts.
 * The card is already the module — no second chrome, no essay column.
 */
export function FlowPanel({
  facts,
  steps,
  estimate,
}: {
  facts: { term: string; detail: React.ReactNode }[];
  steps: { href: string; number: number; name: string }[];
  estimate?: React.ReactNode;
}) {
  return (
    <div className="mt-4 space-y-4">
      <StepChips steps={steps} />
      {estimate}
      <dl className="m-0 grid gap-3 sm:grid-cols-2">
        {facts.map((f) => (
          <div key={f.term}>
            <dt className="text-muted-foreground type-meta font-bold tracking-wider uppercase">
              {f.term}
            </dt>
            <dd className="m-0 mt-1 text-sm leading-snug">{f.detail}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Live spend for one Create run or one Enrich of one place. Not an input. */
export function FlowEstimate({
  caption,
  estimate,
}: {
  caption: string;
  estimate: CostEstimate;
}) {
  return (
    <div className="border-border rounded-lg border px-3 py-2.5">
      <p className="text-muted-foreground type-meta font-bold tracking-wider uppercase">
        Estimate
      </p>
      <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
        {money(estimate.perPlace)} / place · {fmtTime(estimate.perPlaceSecs)}
      </p>
      {estimate.active.length > 0 ? (
        <details className="mt-2">
          <summary className="text-muted-foreground type-label cursor-pointer font-semibold tracking-wide">
            Breakdown
          </summary>
          <ul className="mt-2 space-y-0.5">
            {estimate.active.map((l) => (
              <li
                key={l.label}
                className="text-muted-foreground flex justify-between gap-3 type-label leading-snug"
              >
                <span>{l.label}</span>
                <span className="shrink-0 font-mono tabular-nums">
                  {money(l.cost)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <p className="text-muted-foreground mt-2 type-label leading-snug">
        {caption} Published rates, not a bill.
      </p>
    </div>
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

/**
 * What one model is actually TOLD, rendered read-only.
 *
 * The text arrives on `crenupPromptsMeta` from supabase `_shared/crenup-prompts.ts`,
 * which imports the same constants and builders the pipeline calls — so what an
 * operator reads here is what the vendor receives, and there is no copy to drift.
 *
 * Deliberately NOT a textarea. The Images prompts on this same page ARE editable,
 * so a read-only prompt has to look different at a glance — a control that
 * accepts keystrokes and silently discards them is the bug this shape avoids.
 * `<pre>` is the honest element: selectable and copyable, never focusable as a
 * field.
 */
export function PromptView({
  prompt,
  preset,
}: {
  prompt: CrenupPrompt;
  /** The live Perplexity preset, shown only for the steps that spend it. */
  preset?: string;
}) {
  const vendorLine = preset
    ? `${prompt.vendor} · ${preset}`
    : prompt.vendor;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {prompt.agent ? <Tag tone="solid">{prompt.agent}</Tag> : null}
        <Tag>{vendorLine}</Tag>
        <span className="text-muted-foreground type-meta">read-only</span>
      </div>
      <p className="text-muted-foreground m-0 max-w-2xl type-body leading-relaxed">
        {prompt.vendorNote}
      </p>
      <p className="text-muted-foreground m-0 max-w-2xl type-body leading-relaxed">
        <span className="text-foreground font-medium">Writes.</span>{" "}
        {prompt.writes}
      </p>
      <PromptBlock label="Instructions — sent as the system message">
        {prompt.instructions}
      </PromptBlock>
      <PromptBlock label="Message — built per place; {braces} are filled at run time">
        {prompt.input}
      </PromptBlock>
    </div>
  );
}

/**
 * One verbatim prompt body. Scrolls rather than truncates — a prompt an operator
 * can only read half of answers the question worse than not showing it.
 */
function PromptBlock({
  label,
  children,
}: {
  label: string;
  children: string;
}) {
  return (
    <div>
      <p className="text-muted-foreground m-0 mb-1.5 type-label">{label}</p>
      {/* text-xs, not an arbitrary px: this is a block to READ, and a frozen
          px size ignores the operator's own browser font-size setting. */}
      <pre className="bg-muted/40 text-foreground/90 m-0 max-h-80 overflow-auto rounded-lg border p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
        {children}
      </pre>
    </div>
  );
}

/** Grid the control fields share, so every module lines up at the same rhythm. */
export function Fields({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  );
}

/**
 * One prompt, tucked behind a disclosure on the function that sends it.
 *
 * Renders NOTHING when the prompt is absent — the GET failed, or the backend
 * stopped shipping that key. An empty disclosure would promise a prompt and
 * then fail to show one, which reads as "there is no prompt here"; silence at
 * least stays honest, and the page already surfaces a load error above.
 */
export function PromptDisclosure({
  prompt,
  preset,
}: {
  prompt: CrenupPrompt | undefined;
  preset?: string;
}) {
  if (!prompt) return null;
  // The summary names the agent when there is one, because that is how the rest
  // of the page and the Place screen refer to this step.
  const who = prompt.agent ? `the ${prompt.agent}` : prompt.label;
  return (
    <Collapsible summary={`What ${who} is told`}>
      <PromptView prompt={prompt} preset={preset} />
    </Collapsible>
  );
}


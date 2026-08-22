"use client";

import { Info, TriangleAlert } from "lucide-react";

// Filters Config — the small controls the General and Surface tabs share.
// Kept here rather than in @/components/admin-ui because they encode this
// page's own vocabulary (tri-state inherit, the staged contract, the
// report-don't-correct warning list) rather than console-wide chrome.

/** A knob that persists but changes nothing yet. */
export function StagedBadge() {
  return (
    <span className="border-border bg-muted text-muted-foreground rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
      Staged
    </span>
  );
}


/**
 * A surface that renders places but carries no Filters trigger at all — a
 * stronger claim than "staged", and a different one from "parked". Favorites is
 * the only one today.
 */
export function SheetlessBadge() {
  return (
    <span className="border-border bg-muted text-muted-foreground rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
      No sheet
    </span>
  );
}

/**
 * The page-level honesty notice. An unenforced config is a bug unless it says
 * so out loud, and prose buried in a card gets skipped — this sits above
 * everything, on every tab.
 */
export function StagedBanner({ seeded }: { seeded: boolean }) {
  return (
    <div className="border-border bg-muted/40 flex items-start gap-2.5 rounded-xl border p-3.5">
      <Info className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 text-xs leading-relaxed">
        <p className="text-foreground font-semibold">
          Staged — nothing reads this yet.
        </p>
        <p className="text-muted-foreground mt-1">
          The consumer Filters sheet still runs its own code defaults
          (<code className="text-[11px]">discovery-filters-engine.ts</code>, web
          and mobile). Every knob here saves, and none of them changes what a
          guest sees until the consumer wiring lands. The values below mirror
          the shipped engine, so this page describes the product as it is.
          {seeded ? (
            <>
              {" "}
              <span className="text-foreground font-medium">
                No config has been saved yet
              </span>{" "}
              — these are the launch values, not an operator&rsquo;s choices.
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}

/**
 * Contradictions, REPORTED not corrected — the Promos precedent. Silence when
 * there is nothing to say; never a green "all good" badge.
 */
export function WarningsNote({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="border-border bg-background mt-4 rounded-xl border p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold">
        <TriangleAlert className="h-3.5 w-3.5" />
        {warnings.length === 1
          ? "One setting contradicts another"
          : `${warnings.length} settings contradict each other`}
      </p>
      <ul className="text-muted-foreground mt-2 flex flex-col gap-1.5 text-xs leading-relaxed">
        {warnings.map((w) => (
          <li key={w} className="flex gap-2">
            <span aria-hidden>·</span>
            <span>{w}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Generic segmented picker over a small closed set of string values. */
export function SegmentedPicker<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <div className="flex w-full gap-1" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`h-8 flex-1 rounded-lg border px-2 text-xs font-semibold transition disabled:opacity-50 ${
            value === o.value
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-card hover:border-foreground/40"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** One labelled row: name + blurb on the left, a control on the right. */
export function KnobRow({
  label,
  blurb,
  control,
  trailing,
}: {
  label: string;
  /** Optional — a module is DEFINED once, on Signals. Engines just set it. */
  blurb?: string;
  control: React.ReactNode;
  /** Optional resolved-value caption under the control. */
  trailing?: React.ReactNode;
}) {
  return (
    <div className="border-border bg-background flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        {blurb ? (
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {blurb}
          </p>
        ) : null}
      </div>
      <div className="shrink-0 sm:w-64">
        {control}
        {trailing ? (
          <p className="text-muted-foreground mt-1.5 text-right text-[11px]">
            {trailing}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** "Updated <stamp>" caption, or the honest absence of one. */
export function UpdatedStamp({ at }: { at: string | null }) {
  return (
    <p className="text-muted-foreground text-xs">
      {at ? `Updated ${new Date(at).toLocaleString()}` : "Never saved"}
    </p>
  );
}

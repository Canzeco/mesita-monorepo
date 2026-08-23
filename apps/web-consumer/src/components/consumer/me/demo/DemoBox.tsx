"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// THE EMULATOR, STATED ONCE (decision: Pato — standardize the demo control).
//
// Three Me sheets can fake an identity the guest doesn't have yet: Instagram
// (a connected account with a follower count), Class (the four metals) and
// Plan (Free / Premium). They each grew their own dashed box — different chip
// colours, different labels, one of them at the bottom of the sheet — so the
// same affordance read as three different features.
//
// One shell, one place: a dashed box at the TOP of the sheet body, so demo
// state is declared before the surface it changes rather than discovered after
// scrolling past it. The chip is neutral on purpose — the sheets below reserve
// colour for the thing being previewed (a metal, a plan), and an amber DEMO
// pill was competing with it.
//
// Remove the whole folder with the MOCK_ paths once these states can be
// produced with real data.

export function DemoBox({
  label,
  action,
  children,
}: {
  /** What is being previewed, in two words: "Preview", "Preview connected". */
  label: string;
  /** Optional control on the header row — Instagram's on/off switch. */
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="border-border/70 rounded-2xl border border-dashed p-3">
      <div className="flex min-h-6 items-center gap-1.5">
        <span className="bg-muted text-muted-foreground type-meta rounded px-1.5 py-0.5 font-bold tracking-[0.12em] uppercase">
          Demo
        </span>
        <span className="text-muted-foreground type-label font-medium">
          {label}
        </span>
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

// The segmented picker inside a DemoBox — two rungs (plan) or four (class).
// Generic over the option value so each sheet keeps its own union type.
export function DemoSegmented<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="bg-muted/60 flex rounded-lg p-1">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onSelect(o.value)}
            aria-pressed={active}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-center text-xs font-semibold whitespace-nowrap transition",
              active
                ? "bg-background text-foreground shadow-rest"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// The header-row switch — Instagram's "connected or not", the one demo control
// that is a state rather than a choice between named rungs.
export function DemoSwitch({
  checked,
  onToggle,
  ariaLabel,
}: {
  checked: boolean;
  onToggle: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition",
        checked ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "shadow-rest inline-block h-5 w-5 transform rounded-full bg-white transition",
          checked ? "translate-x-[18px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "./cn";
import { FOCUS_RING_CLASS, TOUCH_TARGET_CLASS } from "./classes";
import { Switch as UiSwitch } from "./ui/switch";

/** An on/off control. `pending` disables it while a write is in flight. */
export function Switch({
  checked,
  onCheckedChange,
  pending = false,
  disabled = false,
  label,
  className,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  pending?: boolean;
  disabled?: boolean;
  /** Accessible name; the switch has no visible text of its own. */
  label: string;
  className?: string;
}) {
  return (
    <UiSwitch
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={pending || disabled}
      aria-label={label}
      className={className}
    />
  );
}

/** One labelled switch in a well: label, optional hint, optional KnobState slot. */
export function SwitchRow({
  label,
  hint,
  state,
  checked,
  onCheckedChange,
  pending,
  disabled,
  switchLabel,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  /** A KnobState (Enforced / Fallback / Not wired). */
  state?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  pending?: boolean;
  disabled?: boolean;
  /** Accessible name when `label` is not plain text. */
  switchLabel?: string;
}) {
  return (
    <div className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-medium">{label}</span>
        {hint ? <span className="text-muted-foreground type-meta">{hint}</span> : null}
        {state}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        pending={pending}
        disabled={disabled}
        label={switchLabel ?? (typeof label === "string" ? label : "")}
      />
    </div>
  );
}

/** One stop in a row of mutually exclusive choices; `aria-pressed` marks the pick. */
export function ChoicePill({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center rounded-full px-3.5 type-body font-semibold tabular-nums transition disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "bg-foreground text-background"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground border",
        FOCUS_RING_CLASS,
        TOUCH_TARGET_CLASS,
      )}
    >
      {children}
    </button>
  );
}

/** The one disclosure: native <details>, ChevronRight turning 90°. No JS state. */
export function Collapsible({
  summary,
  children,
  defaultOpen = false,
  id,
}: {
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** A link target (MESITA-3939): a URL hash naming it opens it, on first
   *  load and on hashchange, then brings it into view. */
  id?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!id) return;
    const sync = () => {
      const el = ref.current;
      if (!el || el.open || decodeURIComponent(location.hash) !== `#${id}`) return;
      el.open = true;
      requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [id]);
  return (
    <details ref={ref} id={id} className="group mt-5 scroll-mt-16" open={defaultOpen || undefined}>
      <summary
        className={cn(
          "text-muted-foreground hover:text-foreground flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-full text-sm font-medium [&::-webkit-details-marker]:hidden",
          FOCUS_RING_CLASS,
          TOUCH_TARGET_CLASS,
        )}
      >
        <ChevronRight aria-hidden className="h-4 w-4 transition-transform group-open:rotate-90" />
        {summary}
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

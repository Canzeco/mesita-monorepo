"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useStoredFlag, useStoredString } from "@/lib/local-store";

// Presentational building blocks for the Me page and its Settings modal —
// grouped, rounded, icon-led rows in the app's premium light-theme language.
// Extracted from the old ProfileClient so the modular Me boxes and the
// Settings modal render identical row chrome.

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-foreground/60 text-[10px] font-semibold tracking-[0.16em] uppercase">
      {children}
    </p>
  );
}

export function SettingsGroup({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      {title && <SectionEyebrow>{title}</SectionEyebrow>}
      <div className="border-border bg-card overflow-hidden rounded-2xl border">
        {children}
      </div>
    </section>
  );
}

export function RowDivider() {
  return <div className="border-border/60 border-t" />;
}

export type RowTint =
  | "primary"
  | "muted"
  | "instagram"
  | "emerald"
  | "amber"
  | "sky"
  | "violet"
  | "rose"
  | "destructive";

const TINT_CLASSES: Record<RowTint, string> = {
  primary: "bg-primary/10 text-primary",
  muted: "bg-muted text-foreground/70",
  instagram:
    "bg-[linear-gradient(135deg,oklch(0.70_0.20_30),oklch(0.65_0.20_350))] text-white",
  emerald: "bg-emerald-500/10 text-emerald-600",
  amber: "bg-amber-500/10 text-amber-600",
  sky: "bg-sky-500/10 text-sky-600",
  violet: "bg-violet-500/10 text-violet-600",
  rose: "bg-rose-500/10 text-rose-600",
  destructive: "bg-destructive/10 text-destructive",
};

export function IconCircle({
  tint,
  children,
}: {
  tint: RowTint;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
        TINT_CLASSES[tint],
      )}
    >
      {children}
    </span>
  );
}

function RowText({
  label,
  sub,
  destructive,
}: {
  label: string;
  sub?: string;
  destructive?: boolean;
}) {
  return (
    <span className="min-w-0 flex-1">
      <span
        className={cn(
          "block text-sm font-semibold",
          destructive && "text-destructive",
        )}
      >
        {label}
      </span>
      {sub && (
        <span className="text-muted-foreground block truncate text-[11px]">
          {sub}
        </span>
      )}
    </span>
  );
}

export function SettingsActionRow({
  Icon,
  tint,
  label,
  sub,
  destructive,
  onClick,
}: {
  Icon: LucideIcon;
  tint: RowTint;
  label: string;
  sub?: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition"
    >
      <IconCircle tint={tint}>
        <Icon className="h-[18px] w-[18px]" />
      </IconCircle>
      <RowText label={label} sub={sub} destructive={destructive} />
      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
    </button>
  );
}

export function SettingsStaticRow({
  Icon,
  tint,
  label,
  sub,
  trailing,
}: {
  Icon: LucideIcon;
  tint: RowTint;
  label: string;
  sub?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex w-full items-center gap-3 px-4 py-3">
      <IconCircle tint={tint}>
        <Icon className="h-[18px] w-[18px]" />
      </IconCircle>
      <RowText label={label} sub={sub} />
      {trailing}
    </div>
  );
}

export function SettingsLinkRow({
  Icon,
  tint,
  href,
  label,
  sub,
  external,
}: {
  Icon: LucideIcon;
  tint: RowTint;
  href: string;
  label: string;
  sub?: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition"
    >
      <IconCircle tint={tint}>
        <Icon className="h-[18px] w-[18px]" />
      </IconCircle>
      <RowText label={label} sub={sub} />
      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
    </a>
  );
}

// ─── Toggles ──────────────────────────────────────────────────────────────

function Switch({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full transition",
        on ? "bg-pink-gradient" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
          on ? "left-[18px]" : "left-0.5",
        )}
      />
    </span>
  );
}

// Device-persisted boolean row. `defaultOn` is the pre-set value shown until
// the user flips it.
export function StoredToggleRow({
  Icon,
  tint,
  storageKey,
  label,
  sub,
  defaultOn = true,
}: {
  Icon: LucideIcon;
  tint: RowTint;
  storageKey: string;
  label: string;
  sub?: string;
  defaultOn?: boolean;
}) {
  const [on, set] = useStoredFlag(storageKey, defaultOn);
  return (
    <button
      type="button"
      onClick={() => set()}
      role="switch"
      aria-checked={on}
      className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition"
    >
      <IconCircle tint={tint}>
        <Icon className="h-[18px] w-[18px]" />
      </IconCircle>
      <RowText label={label} sub={sub} />
      <Switch on={on} />
    </button>
  );
}

// ─── Select (language / default location) ─────────────────────────────────

// Device-persisted single-choice row rendered as a styled native <select> on
// the right — accessible and zero extra overlay layers.
export function StoredSelectRow({
  Icon,
  tint,
  storageKey,
  label,
  sub,
  options,
  defaultValue,
}: {
  Icon: LucideIcon;
  tint: RowTint;
  storageKey: string;
  label: string;
  sub?: string;
  options: { value: string; label: string }[];
  defaultValue: string;
}) {
  const [value, set] = useStoredString(storageKey, defaultValue);
  return (
    <label className="hover:bg-muted flex w-full cursor-pointer items-center gap-3 px-4 py-3 transition">
      <IconCircle tint={tint}>
        <Icon className="h-[18px] w-[18px]" />
      </IconCircle>
      <RowText label={label} sub={sub} />
      <select
        value={value}
        onChange={(e) => set(e.target.value)}
        className="border-border bg-background text-foreground focus:border-primary max-w-[42%] shrink-0 truncate rounded-lg border px-2 py-1.5 text-[12.5px] font-medium outline-none"
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

"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { PushLink } from "@/components/consumer/nav/PushLink";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { INSTAGRAM_ICON_GRADIENT_CLASS } from "@/lib/ui-classes";

// Presentational building blocks for the Me page and its Settings modal —
// icon-led rows. Extracted from the old ProfileClient so the modular Me
// boxes and the Settings modal render identical row chrome.
//
// SECTIONS IN BOXES (MESITA-4052, Pato 2026-11-15: "do put sections into
// boxes, specially in modular configuration pages"): a group is Wallet's
// 16px heading over one rounded white box of rows split by hairlines
// (SectionBox, the Wallet list's box). MESITA-4000 had made them flat on
// white, an eyebrow over full-width rows; the place screen's sheets keep
// that flat form (`flat`), since a sheet is already its own card.

/** The box every Me section draws: Wallet's list box (WalletLists.tsx). The
 *  rows inside carry their own 16px padding; the box adds none. */
export const SECTION_BOX_CLASS =
  "border-border bg-card overflow-hidden rounded-2xl border";

/** A section's heading: Wallet's list heading, 16px display (decision 1A),
 *  never the small uppercase eyebrow. */
export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-base font-semibold tracking-tight">
      {children}
    </h2>
  );
}

/** One section: an optional heading (with an optional control on its
 *  right), then one box. */
export function SectionBox({
  title,
  action,
  className,
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      {(title || action) && (
        <div className="flex min-h-6 items-center justify-between gap-3">
          {title ? <SectionHeading>{title}</SectionHeading> : <span />}
          {action}
        </div>
      )}
      <div className={cn(SECTION_BOX_CLASS, className)}>{children}</div>
    </section>
  );
}

/** The small uppercase label, for the flat sheet groups only. */
export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-foreground/60 type-meta font-semibold tracking-[0.14em] uppercase">
      {children}
    </p>
  );
}

export function SettingsGroup({
  title,
  flat = false,
  children,
}: {
  title?: string;
  /** The place screen's sheets: rows flat on the sheet, no box. */
  flat?: boolean;
  children: ReactNode;
}) {
  if (!flat) return <SectionBox title={title}>{children}</SectionBox>;
  return (
    <section className="flex flex-col gap-2">
      {title && <SectionEyebrow>{title}</SectionEyebrow>}
      {/* -mx-4: the rows' own 16px padding lines their text up with the
          sheet's edge, and their hover runs nearly edge to edge. */}
      <div className="-mx-4">{children}</div>
    </section>
  );
}

export function RowDivider() {
  return <div className="border-border/60 border-t" />;
}

/** Marks the guest's own Class or Plan row, beside its title (MESITA-2983);
 *  the row's subtitle never changes. PerkList's Soon pill's shape. */
export function CurrentPill(props: { [key: `data-${string}`]: string }) {
  return (
    <span
      {...props}
      className="bg-foreground text-paper type-meta ml-1.5 rounded-full px-1.5 py-0.5 align-middle font-semibold"
    >
      Current
    </span>
  );
}

/** Every button on a Me page: 44px, one radius, one weight (MESITA-2983). */
export const ME_BUTTON_CLASS =
  "h-11 min-h-11 rounded-xl py-0 text-sm font-semibold";

export type RowTint = "muted" | "instagram";

/** One icon box for every Me icon: the hub tile's chip — a 36px rounded
 *  square in the page grey (Pato, MESITA-2569 "A · Ink chip"). Rows inside
 *  the pages wore 36px circles at 70% ink until MESITA-2983. */
export const ICON_CHIP_CLASS =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl";

const TINT_CLASSES = {
  muted: "bg-muted text-foreground",
  instagram: [INSTAGRAM_ICON_GRADIENT_CLASS, "text-white"].join(" "),
} as const satisfies Record<RowTint, string>;

export function IconChip({
  tint = "muted",
  children,
}: {
  tint?: RowTint;
  children: ReactNode;
}) {
  return (
    <span className={cn(ICON_CHIP_CLASS, TINT_CLASSES[tint])} aria-hidden>
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
        <span className="text-muted-foreground type-label block truncate">
          {sub}
        </span>
      )}
    </span>
  );
}

/** A fact, not a door: icon, label, value, no chevron (Settings › Phone,
 *  MESITA-2547). */
export function SettingsInfoRow({
  Icon,
  tint,
  label,
  value,
}: {
  Icon: LucideIcon;
  tint: RowTint;
  label: string;
  value: string;
}) {
  return (
    <div className="flex w-full items-center gap-3 px-4 py-3">
      <IconChip tint={tint}>
        <Icon className="h-[18px] w-[18px]" />
      </IconChip>
      <RowText label={label} sub={value} />
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
  const className =
    "hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition";
  const inner = (
    <>
      <IconChip tint={tint}>
        <Icon className="h-[18px] w-[18px]" />
      </IconChip>
      <RowText label={label} sub={sub} />
      {/* A door out of the app wears an arrow out, not a chevron (MESITA-3793). */}
      {external ? (
        <ArrowUpRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <ChevronRight
          className="text-muted-foreground h-4 w-4 shrink-0"
          aria-hidden
        />
      )}
    </>
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {inner}
      </a>
    );
  }
  return (
    <PushLink href={href} className={className}>
      {inner}
    </PushLink>
  );
}

/** A door that opens a dialog, not a page (Instagram › Disconnect;
 *  Settings › Delete account until MESITA-3468). SettingsLinkRow's chrome; `destructive` inks the label. */
export function SettingsActionRow({
  Icon,
  label,
  sub,
  destructive,
  disabled,
  onClick,
}: {
  Icon: LucideIcon;
  label: string;
  sub?: string;
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition disabled:pointer-events-none disabled:opacity-60"
    >
      <IconChip>
        <Icon
          className={cn("h-[18px] w-[18px]", destructive && "text-destructive")}
        />
      </IconChip>
      <RowText label={label} sub={sub} destructive={destructive} />
      <ChevronRight
        className="text-muted-foreground h-4 w-4 shrink-0"
        aria-hidden
      />
    </button>
  );
}

// ─── Toggles ──────────────────────────────────────────────────────────────

export function Switch({ on }: { on: boolean }) {
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

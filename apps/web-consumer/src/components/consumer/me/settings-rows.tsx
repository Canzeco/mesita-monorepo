"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { INSTAGRAM_ICON_GRADIENT_CLASS } from "@/lib/ui-classes";

// Presentational building blocks for the Me page and its Settings modal —
// grouped, rounded, icon-led rows in the app's premium light-theme language.
// Extracted from the old ProfileClient so the modular Me boxes and the
// Settings modal render identical row chrome.

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-foreground/60 type-meta font-semibold tracking-[0.14em] uppercase">
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

/** The page's one opening line under the header, where it says something
 *  (Contact's reply time, Instagram's follower bar, Profile's caption). No
 *  icon disc: the header already names the page (MESITA-2983). */
export function MeLead({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground type-label mb-5">{children}</p>;
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

function RowText({ label, sub }: { label: string; sub?: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-semibold">{label}</span>
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
      <ChevronRight
        className="text-muted-foreground h-4 w-4 shrink-0"
        aria-hidden
      />
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
    <Link href={href} className={className}>
      {inner}
    </Link>
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

"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { Check, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { DiscountMeter, type DiscountLevel } from "./DiscountMeter";

type ClimbCardAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  /** Secondary actions render as a quiet bordered button under the primary. */
  secondary?: boolean;
};

export type ClimbCardData = {
  key: string;
  icon: LucideIcon;
  iconBg: string;
  title: string;
  via?: string;
  accent?: boolean;
  /** Door one-liner under the title row (price / threshold / invite). */
  door?: string;
  discountLevel: DiscountLevel;
  /** The class's perks, rendered as a check-list under the meter. */
  perks?: string[];
  reached: boolean;
  reachedLabel: string;
  /** Doors into the class — a card can have several. */
  actions?: ClimbCardAction[];
  note?: string;
};

export function ClimbCard({ data }: { data: ClimbCardData }) {
  const Icon = data.icon;

  let footer: ReactNode = null;
  if (data.reached) {
    footer = (
      <span className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/15 py-2.5 text-[12px] font-semibold text-emerald-700">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
        {data.reachedLabel}
      </span>
    );
  } else if (data.actions && data.actions.length > 0) {
    // Primary actions stack full-width; consecutive SECONDARY actions share
    // one row (consecutive secondary actions render side by side).
    const groups = data.actions.reduce<ClimbCardAction[][]>((acc, action) => {
      const last = acc[acc.length - 1];
      if (action.secondary && last && last[0]?.secondary) last.push(action);
      else acc.push([action]);
      return acc;
    }, []);
    footer = (
      <div className="flex flex-col gap-2">
        {groups.map((group) => (
          <div key={group[0].label} className="flex gap-2">
            {group.map((action) => {
              const cls = cn(
                "flex min-h-11 flex-1 items-center justify-center rounded-lg py-2.5 text-[13px] font-semibold transition active:scale-[0.99]",
                action.secondary
                  ? "border-border bg-card hover:bg-muted border"
                  : "bg-pink-gradient text-white shadow-sm",
              );
              return action.href ? (
                <Link key={action.label} href={action.href} className={cls}>
                  {action.label}
                </Link>
              ) : (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className={cls}
                >
                  {action.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  } else if (data.note) {
    footer = (
      <span className="border-border bg-muted/40 text-muted-foreground flex min-h-11 items-center justify-center rounded-lg border py-2.5 text-[12px] font-medium">
        {data.note}
      </span>
    );
  }

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5",
        data.accent
          ? "border-tier-premium/30 bg-tier-premium/[0.03]"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-3.5">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm",
            data.iconBg,
          )}
        >
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "font-display text-[16px] leading-none font-bold tracking-tight",
                data.accent && "text-premium",
              )}
            >
              {data.title}
            </span>
            {data.via && (
              <span className="text-muted-foreground text-[13px] font-medium">
                via {data.via}
              </span>
            )}
          </div>
          {data.door && (
            <p className="text-muted-foreground mt-1.5 text-[12px] leading-snug">
              {data.door}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <DiscountMeter level={data.discountLevel} />
      </div>

      {data.perks && data.perks.length > 0 && (
        <ul className="mt-3.5 flex flex-col gap-2">
          {data.perks.map((perk) => (
            <li
              key={perk}
              className="flex items-start gap-2 text-[12.5px] leading-snug"
            >
              <span
                className={cn(
                  "mt-[1px] flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full",
                  data.accent
                    ? "bg-tier-premium/15 text-premium"
                    : "bg-emerald-500/15 text-emerald-700",
                )}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="text-foreground/85">{perk}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4">{footer}</div>
    </article>
  );
}

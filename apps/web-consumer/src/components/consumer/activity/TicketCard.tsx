"use client";

// THE TICKET (MESITA-3688, Pato: "reservations, visits, payments,
// prepayments, gifts are tickets"). One card for every kind:
//
//   ┌──────────────────────────────────────┐
//   │ (photo) Taquería Orinoco   [Confirmed]│  the place, one line; the pill
//   ├╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴┤  the perforation, notched
//   │ Tue Nov 10 · 8:00 PM                  │  the big fact
//   │ 2 people · #48213907                  │  the facts under it
//   └──────────────────────────────────────┘
//
// The notches are half circles in the page's own grey (bg-background), so
// the card reads as torn along the line on the grey page. No red anywhere:
// red is the Premier seal's.

import { PushLink } from "@/components/consumer/nav/PushLink";
import { Skeleton } from "@/components/shared/Skeleton";
import { cn } from "@/lib/utils";

export type PillTone = "green" | "ink" | "grey";

export type Ticket = {
  key: string;
  place: string;
  photo: string | null;
  pill: { label: string; tone: PillTone };
  /** The one fact the ticket is for: a time, an amount, a state. */
  big: string;
  /** The facts under it, joined with middle dots. */
  line: string;
  /** Over the place name: "Next up" on the reservation that comes next. */
  label?: string;
  /** Cancelled, declined, expired: drawn quieter. */
  dim?: boolean;
  href?: string;
};

const PILL: Record<PillTone, string> = {
  green: "bg-green-100 text-green-800",
  ink: "border border-foreground/30 text-foreground",
  grey: "bg-muted text-muted-foreground",
};

export function TicketCard({ t }: { t: Ticket }) {
  const body = (
    <>
      {t.label ? (
        <span className="text-muted-foreground type-eyebrow block px-4 pt-3">
          {t.label}
        </span>
      ) : null}
      <span
        className={cn(
          "flex items-center gap-3 px-4 pb-3",
          t.label ? "pt-1.5" : "pt-3",
        )}
      >
        {t.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={t.photo}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            className="bg-muted h-9 w-9 shrink-0 rounded-full"
            aria-hidden
          />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {t.place}
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs leading-none font-semibold",
            PILL[t.pill.tone],
          )}
        >
          {t.pill.label}
        </span>
      </span>
      <span className="relative block" aria-hidden>
        <span className="border-border block border-t border-dashed" />
        <span className="bg-background absolute top-1/2 -left-2 h-4 w-4 -translate-y-1/2 rounded-full" />
        <span className="bg-background absolute top-1/2 -right-2 h-4 w-4 -translate-y-1/2 rounded-full" />
      </span>
      <span className="block px-4 pt-3 pb-3.5">
        <span className="block text-base font-semibold tabular-nums">
          {t.big}
        </span>
        {t.line ? (
          <span className="text-muted-foreground mt-0.5 block truncate text-xs tabular-nums">
            {t.line}
          </span>
        ) : null}
      </span>
    </>
  );
  const cls = cn(
    "bg-card border-border relative block overflow-hidden rounded-2xl border",
    t.dim && "opacity-60",
  );
  return t.href ? (
    <PushLink
      href={t.href}
      className={cn(cls, "hover:bg-muted/40 transition")}
      aria-label={`${t.place}, ${t.pill.label}, ${t.big}`}
    >
      {body}
    </PushLink>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function TicketSkeleton() {
  return (
    <div
      className="bg-card border-border overflow-hidden rounded-2xl border"
      aria-hidden
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="border-border border-t border-dashed" />
      <div className="px-4 pt-3 pb-3.5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-1.5 h-3 w-28" />
      </div>
    </div>
  );
}

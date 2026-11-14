"use client";

// ONE ROW OF ACTIVITY (MESITA-3770, Pato: "It should not look like a ticket").
// The ticket it replaced (MESITA-3688) had a perforation and two notches;
// each row now sits in one white card of rows per group, split by a
// hairline, the way a bank lists its movements:
//
//   (photo) Taquería Orinoco                   $450.00
//           Ana · #48213 · Nov 10                 Paid
//
//   (photo) Café Canta'o                       Upcoming
//           Tue Nov 10 · 8:00 PM
//           2 people · #60967768
//
// A money row puts its amount on the right over its state; any other row
// puts its time under the place and only the state on the right. The state
// is coloured text, never a pill. No red: red is the Premier seal's.
//
// A QUIET ROW (MESITA-3865): a ticket nothing was paid on, or a table that
// never happened, writes its place in grey and fades its photo. The words
// keep their full contrast; the row is never faded whole. An open bill's row
// carries its one button under it, in the same card.

import { ChevronRight } from "lucide-react";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { Skeleton } from "@/components/shared/Skeleton";
import { cn } from "@/lib/utils";

export type StatusTone = "green" | "ink" | "grey";

export type ActivityItem = {
  key: string;
  place: string;
  photo: string | null;
  status: { label: string; tone: StatusTone };
  /** The one fact the row is for: a time, an amount, a state. */
  big: string;
  /** `big` is money: drawn on the right, over the state. */
  money?: boolean;
  /** The facts under it, joined with middle dots. */
  line: string;
  /** Over the place name: "Next up" on the reservation that comes next. */
  label?: string;
  /** Cancelled, declined, expired: drawn quieter. */
  dim?: boolean;
  href?: string;
  /** The one thing to do about it, a filled button under the row. */
  action?: { label: string; href: string };
};

const TONE: Record<StatusTone, string> = {
  green: "text-green-700",
  ink: "text-foreground",
  grey: "text-muted-foreground",
};

/** The white card a group's rows sit in. */
export function ActivityRows({ children }: { children: React.ReactNode }) {
  return (
    <ul
      className="bg-card border-border divide-border divide-y overflow-hidden rounded-2xl border"
      data-activity
    >
      {children}
    </ul>
  );
}

export function ActivityRow({ t }: { t: ActivityItem }) {
  const body = (
    <>
      {t.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={t.photo}
          alt=""
          className={cn(
            "h-10 w-10 shrink-0 self-start rounded-full object-cover",
            t.dim && "opacity-60",
          )}
        />
      ) : (
        <span
          className="bg-muted h-10 w-10 shrink-0 self-start rounded-full"
          aria-hidden
        />
      )}
      <span className="min-w-0 flex-1">
        {t.label ? (
          <span className="block text-xs font-semibold text-green-700">
            {t.label}
          </span>
        ) : null}
        <span
          className={cn(
            "block truncate text-base font-semibold",
            t.dim && "text-muted-foreground",
          )}
        >
          {t.place}
        </span>
        {!t.money && t.big ? (
          <span className="mt-0.5 block truncate text-sm tabular-nums">
            {t.big}
          </span>
        ) : null}
        {t.line ? (
          <span className="text-muted-foreground mt-0.5 block truncate text-sm tabular-nums">
            {t.line}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        {t.money ? (
          <span className="text-base font-semibold tabular-nums">
            {t.big}
          </span>
        ) : null}
        {t.status.label ? (
          <span className={cn("text-sm font-medium", TONE[t.status.tone])}>
            {t.status.label}
          </span>
        ) : null}
      </span>
      {t.href ? (
        <ChevronRight
          className="text-muted-foreground/60 h-4 w-4 shrink-0 self-center"
          aria-hidden
        />
      ) : null}
    </>
  );
  const cls = "flex items-center gap-3 px-4 py-3.5";
  return (
    <li>
      {t.href ? (
        <PushLink
          href={t.href}
          className={cn(cls, "hover:bg-muted/40 active:bg-muted/60 transition")}
          aria-label={[t.place, t.status.label, t.big, t.line]
            .filter(Boolean)
            .join(", ")}
        >
          {body}
        </PushLink>
      ) : (
        <div className={cls}>{body}</div>
      )}
      {t.action ? (
        <div className="px-4 pb-3.5">
          <PushLink
            href={t.action.href}
            className="bg-foreground text-background flex h-11 items-center justify-center rounded-full text-sm font-semibold transition hover:opacity-90"
          >
            {t.action.label}
          </PushLink>
        </div>
      ) : null}
    </li>
  );
}

/** Three rows' bones, in their card. */
export function ActivityRowsSkeleton() {
  return (
    <div
      className="bg-card border-border divide-border divide-y overflow-hidden rounded-2xl border"
      aria-busy
    >
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5" aria-hidden>
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-1.5 h-3 w-28" />
          </div>
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  );
}

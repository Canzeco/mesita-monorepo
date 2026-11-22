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
import { PANEL_CLASS, Panel } from "@/components/shared/Panel";
import { KIND_WORD } from "@/lib/ticket-rows";
import { timeAgo } from "@/lib/time-ago";
import { KindBadge } from "./KindBadge";
import { cn } from "@/lib/utils";

export type StatusTone = "green" | "ink" | "grey";

/** What a row is (MESITA-4001): its badge and the first word its name says. */
export type TicketRowKind =
  | "visit"
  | "payment"
  | "voucher"
  | "bonus"
  | "gift_in"
  | "gift_out"
  | "gift_back"
  | "gift_link"
  | "refund"
  | "reversal"
  | "reservation";

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
  /** When it happened: "2h", "3d" or "Nov 10" ends the line (MESITA-4000;
   *  rows no longer sit under day headings). */
  when?: string | null;
  /** Over the place name: "Next up" on the reservation that comes next. */
  label?: string;
  /** Cancelled, declined, expired: drawn quieter. */
  dim?: boolean;
  /** Not resolved yet (MESITA-4623): a bill waiting for the waiter. The
   *  row wears a yellow background. */
  pending?: boolean;
  /** A voucher's credit or bonus still landing (MESITA-4625): blue. */
  landing?: boolean;
  /** Its kind: the badge on the photo and the name's first word. */
  kind?: TicketRowKind;
  /** What happened to the guest's credit (MESITA-4001): "+" came in (green),
   *  "−" went out; none for card or cash money. Drawn before `big`. */
  sign?: "+" | "−" | null;
  href?: string;
  /** The one thing to do about it, a filled button under the row. */
  action?: { label: string; href: string };
};

const TONE: Record<StatusTone, string> = {
  green: "text-green-700",
  ink: "text-foreground",
  grey: "text-muted-foreground",
};

/** The box every Me list sits in: the app's one Panel (components/shared,
 *  MESITA-4071), a hairline between rows (Pato, 2026-11-14: "maybe add gray
 *  lines to separate events"). */
export const LIST_BOX_CLASS = `${PANEL_CLASS} divide-border divide-y`;

/** A list's rows IN ONE PANEL (MESITA-4053, Pato 2026-11-15: "put sections
 *  into boxes"): the page margin around it, the rows' own 16px inside.
 *  A titled list wears its heading INSIDE the panel (MESITA-4071, Wallet's
 *  style), the rows stepping 4px under it. MESITA-4000 had run them full
 *  width on white to the screen's edges. */
export function ActivityRows({
  title,
  children,
  ...data
}: {
  title?: string;
  children: React.ReactNode;
  [key: `data-${string}`]: boolean | string | undefined;
}) {
  if (title) {
    return (
      <Panel title={title}>
        <ul className="divide-border mt-1 divide-y" data-activity {...data}>
          {children}
        </ul>
      </Panel>
    );
  }
  return (
    <ul className={LIST_BOX_CLASS} data-activity {...data}>
      {children}
    </ul>
  );
}

export function ActivityRow({ t }: { t: ActivityItem }) {
  const amount = t.money && t.sign ? `${t.sign}${t.big}` : t.big;
  const body = (
    <>
      <span className="relative h-10 w-10 shrink-0 self-start">
        {t.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={t.photo}
            alt=""
            className={cn(
              "h-10 w-10 rounded-full object-cover",
              t.dim && "opacity-50 grayscale",
            )}
          />
        ) : (
          <span className="bg-muted block h-10 w-10 rounded-full" aria-hidden />
        )}
        {t.kind ? <KindBadge kind={t.kind} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        {t.label ? (
          <span className="block text-xs font-semibold text-green-700">
            {t.label}
          </span>
        ) : null}
        <span
          className={cn(
            "block text-base font-semibold break-words",
            t.dim && "text-muted-foreground",
          )}
        >
          {t.place}
        </span>
        {!t.money && t.big ? (
          <span className="mt-0.5 block text-sm break-words tabular-nums">
            {t.big}
          </span>
        ) : null}
        {t.line || t.when ? (
          <span className="text-muted-foreground mt-0.5 block text-sm break-words tabular-nums">
            {[t.line, t.when ? timeAgo(t.when) : ""].filter(Boolean).join(" · ")}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        {t.money ? (
          <span
            className={cn(
              "text-base tabular-nums",
              t.dim
                ? "text-muted-foreground font-semibold"
                : t.sign === "+"
                  ? "font-semibold text-green-700"
                  : "font-semibold",
            )}
          >
            {amount}
          </span>
        ) : null}
        {t.status.label ? (
          <span className={cn("text-sm font-semibold", TONE[t.status.tone])}>
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
  // NEVER A CUT WORD (MESITA-4343, Pato: "if not enough space, it's ok if
  // tickets are a bit taller … all the tickets in four sections"): lines
  // wrap and the row grows; nothing truncates.
  const cls = cn("flex items-center gap-3 px-4 py-3", t.pending && "bg-amber-50", t.landing && "bg-blue-50");
  return (
    <li>
      {t.href ? (
        <PushLink
          href={t.href}
          className={cn(cls, "hover:bg-muted/40 active:bg-muted/60 transition")}
          aria-label={[
            t.kind && KIND_WORD[t.kind],
            t.place,
            t.status.label,
            t.money ? amount : t.big,
            t.line,
          ]
            .filter(Boolean)
            .join(", ")}
        >
          {body}
        </PushLink>
      ) : (
        <div className={cls}>{body}</div>
      )}
      {t.action ? (
        <div className="px-4 pb-3">
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

/** Three rows' bones, INSIDE the list box (decision 2A). */
export function ActivityRowsSkeleton() {
  return (
    <div className={LIST_BOX_CLASS} aria-busy>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3" aria-hidden>
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

"use client";

// THE TICKET'S PARTS (MESITA-4002, Tickets redesign 2/10, Pato 2026-11-14:
// "THE UI OF ALL THE TICKETS … MUST ENHANCE"). One page of ticket furniture
// that every ticket page wears, so a visit, a voucher and a gift read as one
// family: the same header, the same flat cards, the same lines, the same two
// buttons. Used by the Visit page now; the credit pages move over after it.
//
//   TicketHeader     48px place photo with the kind's badge, the place (a link
//                    to it), when, the amount large, the state coloured
//   TicketCard       an eyebrow over hairline lines on white, no box (D7)
//   TicketLine       label (+ a quiet line) left, value (+ state) right
//   TicketTimeline   every step, closed until tapped
//   TicketActions    one filled button, one outline
//   TestModeNote     the "Test · no real money" chip
//   TicketSkeleton   the header's bones, the loading frame of every ticket
//
// Colour is for the header's state alone: a line's state is ink or grey, and
// nothing reads red (a failed card part says "Didn't go through" in ink).

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { Skeleton } from "@/components/shared/Skeleton";
import { cn } from "@/lib/utils";
import type { TicketRowKind } from "./ActivityRow";
import { KindBadge } from "./KindBadge";

export type TicketTone = "green" | "ink" | "grey";

const TONE: Record<TicketTone, string> = {
  green: "text-green-700",
  ink: "text-foreground",
  grey: "text-muted-foreground",
};

export function TicketHeader({
  kind,
  photo,
  place,
  placeHref,
  when,
  amount,
  state,
  tone = "ink",
  dim = false,
}: {
  kind: TicketRowKind;
  photo?: string | null;
  place: string;
  /** With it, the place name is a link to the place. */
  placeHref?: string;
  when: string;
  /** The display amount, already written (with its sign when it has one). */
  amount: string;
  state: string;
  tone?: TicketTone;
  /** The amount in grey: nothing was paid. */
  dim?: boolean;
}) {
  const name = <span className="truncate">{place}</span>;
  return (
    <header>
      <div className="flex items-center gap-3">
        <span className="relative h-12 w-12 shrink-0">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <span className="bg-muted block h-12 w-12 rounded-full" aria-hidden />
          )}
          <KindBadge kind={kind} />
        </span>
        <div className="min-w-0 flex-1">
          {placeHref ? (
            <PushLink
              href={placeHref}
              className="-mx-1 inline-flex max-w-full items-center gap-1 rounded-md px-1 text-lg font-semibold"
            >
              {name}
              <ChevronRight className="text-muted-foreground/60 h-4 w-4 shrink-0" aria-hidden />
            </PushLink>
          ) : (
            <h1 className="flex text-lg font-semibold">{name}</h1>
          )}
          <p className="text-muted-foreground mt-0.5 text-sm tabular-nums">{when}</p>
        </div>
      </div>
      <p
        className={cn(
          "font-display mt-4 text-4xl font-semibold tracking-tight tabular-nums",
          dim && "text-muted-foreground",
        )}
      >
        {amount}
      </p>
      <p className={cn("mt-1 text-sm font-semibold", TONE[tone])}>{state}</p>
    </header>
  );
}

/** A section: its eyebrow over lines split by hairlines, flat on white. */
export function TicketCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="text-muted-foreground type-eyebrow mb-2">{title}</h2>
      <div className="divide-border divide-y">{children}</div>
    </section>
  );
}

/** One line of a card: the label (and a quiet line under it) on the left, the
 *  value (and its state under it) on the right. With `href`, a link;
 *  `trailing` sits after the value (a copy button). */
export function TicketLine({
  label,
  sub,
  value,
  state,
  tone = "ink",
  icon,
  href,
  strong = false,
  trailing,
}: {
  label: string;
  sub?: string | null;
  value?: string | null;
  state?: string | null;
  tone?: TicketTone;
  icon?: ReactNode;
  href?: string;
  strong?: boolean;
  trailing?: ReactNode;
}) {
  const body = (
    <>
      {icon ? (
        <span className="bg-muted text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full" aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm", strong ? "font-semibold" : "text-muted-foreground")}>{label}</span>
        {sub ? <span className="text-muted-foreground mt-0.5 block text-xs tabular-nums">{sub}</span> : null}
      </span>
      <span className="flex shrink-0 flex-col items-end text-right">
        {value ? (
          <span className={cn("text-base tabular-nums", strong ? "font-semibold" : "font-medium")}>{value}</span>
        ) : null}
        {state ? <span className={cn("mt-0.5 text-xs font-medium", TONE[tone])}>{state}</span> : null}
      </span>
      {trailing}
      {href ? <ChevronRight className="text-muted-foreground/60 h-4 w-4 shrink-0" aria-hidden /> : null}
    </>
  );
  const cls = "flex items-center gap-3 py-3";
  return href ? (
    <PushLink href={href} className={cn(cls, "hover:bg-muted/40 transition")}>
      {body}
    </PushLink>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export type TicketStep = { label: string; when: string; value?: string | null };

/** Every step of the ticket, oldest first, closed until tapped. */
export function TicketTimeline({ steps }: { steps: TicketStep[] }) {
  if (steps.length === 0) return null;
  return (
    <details className="group">
      <summary className="hover:bg-muted/40 flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 transition [&::-webkit-details-marker]:hidden">
        <span className="text-muted-foreground text-sm">Timeline</span>
        <ChevronDown
          className="text-muted-foreground/60 h-4 w-4 shrink-0 transition group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="divide-border border-border divide-y border-t">
        {steps.map((s, i) => (
          <TicketLine key={`${s.when}-${s.label}-${i}`} label={s.label} sub={s.when} value={s.value ?? null} />
        ))}
      </div>
    </details>
  );
}

/** One filled button and one outline, side by side. */
export function TicketActions({
  primary,
  secondary,
}: {
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <div className="flex gap-2">
      <Link
        href={primary.href}
        className="bg-foreground text-background flex h-11 flex-1 items-center justify-center rounded-full text-sm font-semibold transition hover:opacity-90"
      >
        {primary.label}
      </Link>
      {secondary ? (
        <Link
          href={secondary.href}
          className="border-border bg-card hover:bg-muted/60 flex h-11 flex-1 items-center justify-center rounded-full border text-sm font-semibold transition"
        >
          {secondary.label}
        </Link>
      ) : null}
    </div>
  );
}

export function TestModeNote() {
  return (
    <span className="bg-muted text-muted-foreground inline-flex self-start rounded-full px-2.5 py-1 text-xs font-medium">
      Test · no real money
    </span>
  );
}

/** The loading frame of every ticket page: the header's bones, then two cards. */
export function TicketSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="mt-2 h-4 w-36" />
          </div>
        </div>
        <Skeleton className="mt-4 h-10 w-44" />
        <Skeleton className="mt-2 h-4 w-24" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}

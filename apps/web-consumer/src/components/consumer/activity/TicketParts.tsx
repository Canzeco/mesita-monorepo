"use client";

// THE TICKET'S PARTS (MESITA-4002, Tickets redesign 2/10, Pato 2026-11-14:
// "THE UI OF ALL THE TICKETS … MUST ENHANCE"). One page of ticket furniture
// that every ticket page wears, so a visit, a credit, a refund and a gift
// read as one family.
//
// IN BOXES (MESITA-4118, Pato 2026-11-15: "make these tickets modular. use
// boxes … check the GIFT ticket. its beautiful. the other tickets must follow
// same standard"). The Gift page (MESITA-4066) set the shape; every ticket
// page now draws it from these parts, never a copy:
//
//   TicketPage       the column: boxes 16px apart
//   TicketHero       the top box, centred: the marks, the headline (the
//                    amount or the gift's sentence), the state coloured, the
//                    place (a link), when, a note, the Test chip
//   PlaceMark        the 64px place photo, with the kind's badge or without
//   TicketPanel      a titled box of lines (the shared Panel, MESITA-4071)
//   TimelinePanel    the Timeline in its own box
//   TicketLine       label (+ a quiet line) left, value (+ state) right
//   TicketActions    one filled button, one outline, under the boxes
//   TestModeNote     the "Test · no real money" chip
//   TicketSkeleton   the boxes' bones, the loading frame of every ticket
//
// TicketHeader is the older flat header, still worn inside the Reservation
// ticket's own top panel (MESITA-4115).
//
// Colour is for the state alone: a line's state is ink or grey, and
// nothing reads red (a failed card part says "Didn't go through" in ink).

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { Panel } from "@/components/shared/Panel";
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
          "mt-4 text-4xl font-semibold tracking-tight tabular-nums",
          dim && "text-muted-foreground",
        )}
      >
        {amount}
      </p>
      <p className={cn("mt-1 text-sm font-semibold", TONE[tone])}>{state}</p>
    </header>
  );
}

/** The ticket's column: its boxes, 16px apart. */
export function TicketPage({
  children,
  ...data
}: {
  children: ReactNode;
  [key: `data-${string}`]: string | boolean | undefined;
}) {
  return (
    <div className="flex flex-col gap-4 pt-4 pb-4" {...data}>
      {children}
    </div>
  );
}

/** The place's 64px photo (a muted square without one), with the kind's
 *  badge in its corner when given. */
export function PlaceMark({ photo, kind }: { photo?: string | null; kind?: TicketRowKind }) {
  return (
    <span className="relative h-16 w-16 shrink-0" aria-hidden>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="bg-muted h-16 w-16 rounded-2xl object-cover" />
      ) : (
        <span className="bg-muted block h-16 w-16 rounded-2xl" />
      )}
      {kind ? <KindBadge kind={kind} /> : null}
    </span>
  );
}

/** The ticket's top box, centred: the marks, the headline, the state in its
 *  tone, the place (a link with `placeHref`), when, a note, the Test chip. */
export function TicketHero({
  marks,
  headline,
  state,
  tone = "ink",
  place,
  placeHref,
  when,
  note,
  test = false,
  dim = false,
  ...data
}: {
  marks: ReactNode;
  /** The amount or the sentence, already written. */
  headline: string;
  state: string;
  tone?: TicketTone;
  place: string;
  placeHref?: string;
  when?: string;
  /** One quiet sentence under the place ("Refunded to the card you paid with."). */
  note?: ReactNode;
  test?: boolean;
  /** The headline in grey: nothing was paid. */
  dim?: boolean;
  [key: `data-${string}`]: string | boolean | undefined;
}) {
  const name = <span className="truncate">{place}</span>;
  return (
    <Panel className="flex flex-col items-center p-4 text-center" {...data}>
      <div className="flex items-center gap-3">{marks}</div>
      <h1 className={cn("mt-4 text-lg font-semibold tabular-nums", dim && "text-muted-foreground")}>{headline}</h1>
      <p className={cn("mt-1 text-sm font-semibold", TONE[tone])}>{state}</p>
      {placeHref ? (
        <PushLink
          href={placeHref}
          className="text-muted-foreground hover:text-foreground mt-1 inline-flex max-w-full items-center gap-1 text-sm transition"
        >
          {name}
          <ChevronRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
        </PushLink>
      ) : (
        <p className="text-muted-foreground mt-1 flex max-w-full text-sm">{name}</p>
      )}
      {when ? <p className="text-muted-foreground mt-0.5 text-sm tabular-nums">{when}</p> : null}
      {note ? <p className="mt-3 text-sm">{note}</p> : null}
      {test ? <TestModeNote className="mt-3 self-center" /> : null}
    </Panel>
  );
}

/** A section in its own box: the title inside, then lines split by hairlines. */
export function TicketPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel title={title}>
      <div className="divide-border divide-y px-4 pb-1">{children}</div>
    </Panel>
  );
}

/** The Timeline in its own box; nothing when there are no steps. */
export function TimelinePanel({ steps, open = false }: { steps: TicketStep[]; open?: boolean }) {
  if (steps.length === 0) return null;
  return (
    <Panel className="px-4">
      <TicketTimeline steps={steps} open={open} />
    </Panel>
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
          <span className={cn("text-base tabular-nums", strong && "font-semibold")}>{value}</span>
        ) : null}
        {state ? <span className={cn("mt-0.5 text-xs font-semibold", TONE[tone])}>{state}</span> : null}
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
export function TicketTimeline({ steps, open = false }: { steps: TicketStep[]; open?: boolean }) {
  if (steps.length === 0) return null;
  return (
    <details className="group" open={open}>
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

export function TestModeNote({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "bg-muted text-muted-foreground inline-flex self-start rounded-full px-2.5 py-1 text-xs font-semibold",
        className,
      )}
    >
      Test · no real money
    </span>
  );
}

/** The loading frame of every ticket page: the top box's bones, then two boxes. */
export function TicketSkeleton() {
  return (
    <div className="flex flex-col gap-4 pt-4 pb-4" aria-busy>
      <div className="border-border bg-card flex flex-col items-center rounded-2xl border p-4">
        <Skeleton className="h-16 w-16 rounded-2xl" />
        <Skeleton className="mt-4 h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-24" />
        <Skeleton className="mt-2 h-4 w-32" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}

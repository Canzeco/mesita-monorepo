"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, MapPin, QrCode, Sparkles, Star } from "lucide-react";

import { PlacePickList } from "@/components/consumer/rewards/PlacePickList";
import { SavingsReveal } from "@/components/consumer/rewards/SavingsReveal";
import { type ConsumerTicketRow } from "@/lib/api/tickets";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useConsumerTickets } from "@/lib/hooks/useConsumerTickets";
import { useStartVisit } from "@/lib/hooks/useStartVisit";

// New Visit — ONE job: pick a place and start a visit.
//
// History MOVED to Inbox > Visits (Pato, 2026-08-16: "move the visits history
// there"), which retired the last tab and the switcher with it — a one-tab tab
// bar is chrome pretending to be a control. This tab is now where a visit
// STARTS and where you pay; Inbox is where you watch the ones in flight. The
// ticket lists are gone from this file entirely; `tickets` stays only to
// detect a just-paid reveal and to know which places already hold a live one.
//
// IT IS A PLACE LIST AND NOTHING ELSE (Pato, 2026-08-11: "you don't see the
// tickets… you only see places, step 1 — list all the places in Mesita,
// that's it"). The live ticket no longer pins above the list: New is the
// question "where are you?", and a ticket sitting in the answer slot made the
// surface look like two products. Tickets live on THE TICKET and in Inbox.
//
// ONE TAP CREATES THE TICKET (Pato, same session: "you select a place, a
// ticket is automatically created — only by clicking a place. create ticket,
// then id… so you open a modal, the modal has multiple steps"). The 2-step
// TicketWizard sheet is GONE: there is no pre-create screen at all. Every
// ticket is created at "base" and THE TICKET — a four-step modal at
// /visit/[id] — owns reward → task → QR → results.
//
// "base" is what makes the reward stop being a create-time boundary: the
// submit-review / submit-story EFs accept any OPEN ticket, and a late task
// re-prices upward, so the QR works from the first frame and the rung is
// picked afterwards inside the modal.
//
// Tapping a place that already holds a live ticket re-opens that ticket
// instead of 409-ing on `already_open` (D5).

export function NewVisitClient({ userId }: { userId: string }) {
  const tickets = useConsumerTickets(userId);

  const activePlaceIds = useMemo(
    () => new Set(tickets.active.map((t) => t.project_id)),
    [tickets.active],
  );

  // ── Ticket creation: tap a place, that's it. ──
  //
  // The create/recover/seed flow moved into useStartVisit (MESITA-1065) when
  // the place-detail action bar grew its own Visit button. Same contract,
  // one implementation — this surface is no longer the only door in.
  const refreshTickets = useCallback(() => {
    void tickets.refresh();
  }, [tickets]);
  const {
    pickPlace: onPick,
    startingId,
    error: startError,
  } = useStartVisit({
    activeTickets: tickets.active,
    onCreated: refreshTickets,
  });

  // The paid beat (MESITA-808, 4A): a watched ticket flipping to revealed
  // holds a savings reveal before settling into History.
  const [justPaid, setJustPaid] = useState<ConsumerTicketRow | null>(null);
  const prevActiveIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (tickets.status !== "ready") return;
    const prev = prevActiveIdsRef.current;
    const revealed = tickets.history.find(
      (t) => t.status === "revealed" && prev.has(t.id),
    );
    prevActiveIdsRef.current = new Set(tickets.active.map((t) => t.id));
    if (revealed) setJustPaid(revealed);
  }, [tickets.status, tickets.active, tickets.history]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* Page-level orientation lives in a shrink-0 header, OUTSIDE the scroll
          body: the steps are what tell you where you are, and an orientation
          control that scrolls away has stopped orienting. */}
      <div className="border-border bg-background/90 shrink-0 border-b px-4 pt-3 pb-2.5 backdrop-blur-xl">
        {/* ALWAYS, no gate.
            decision: Pato, 2026-08-10 — "always leave the 4 steps, never
            remove them, those are the header." The steps are the wallet's
            masthead: they say what this surface IS. Do not re-gate this.

            Boxed as its own module so the header reads as two clean controls
            stacked — the steps say what this surface is, the track below says
            which slice you're looking at — instead of loose marks floating over
            a band. */}
        <div className="border-border bg-card rounded-xl border px-2 py-2.5">
          <PitchSteps />
        </div>

        {/* The tab track is GONE (Pato, 2026-08-16: "move the visits history
            there"). History moved to Inbox › Visits, which leaves this tab with
            exactly one job — pick a place and start a visit — and no switcher
            to justify. A one-tab tab bar is chrome pretending to be a control.

            The pointer stays because a feature that MOVED needs a forwarding
            address; anyone who knew History lived here has to be told where it
            went, once, in the place they'll look. */}
        <Link
          href={CONSUMER_ROUTES.inbox.visits}
          className="text-muted-foreground hover:text-foreground mt-2 flex items-center justify-center gap-1 text-[11.5px] font-semibold transition"
        >
          Your visits live in Inbox
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 pt-4 pb-6">
        {justPaid ? (
          <SavingsReveal
            placeName={justPaid.place?.name ?? "the place"}
            savedCents={justPaid.discount_cents ?? 0}
            onDone={() => setJustPaid(null)}
          />
        ) : null}

        {startError ? (
          <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-[12.5px]">
            {startError}
          </p>
        ) : null}
        {/* Step 1, and only step 1: every place on Mesita. */}
        <PlacePickList
          activePlaceIds={activePlaceIds}
          busyPlaceId={startingId}
          onPick={onPick}
        />
      </div>
    </div>
  );
}

// Connected glyph rail (MESITA-908): 28px circular nodes on one hairline —
// not fat 40px tiles. Number is a primary micro-caption above the label.
const PITCH_STEPS = [
  { icon: MapPin, label: "Pick place" },
  { icon: Sparkles, label: "Pick reward" },
  { icon: Star, label: "Do it" },
  { icon: QrCode, label: "Show QR" },
] as const;

function PitchSteps() {
  return (
    <ol className="relative flex items-start px-1 pt-0.5 pb-0.5">
      {/* Continuous hairline through node centers (14px into the 28px circle). */}
      <span
        aria-hidden="true"
        className="bg-border absolute top-[21px] right-[12.5%] left-[12.5%] h-px"
      />
      {PITCH_STEPS.map(({ icon: Icon, label }, i) => (
        <li
          key={label}
          className="relative z-[1] flex w-0 flex-1 flex-col items-center gap-1"
        >
          <span className="text-primary text-[9px] leading-none font-bold tabular-nums">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="border-secondary/25 bg-background text-secondary grid size-7 place-items-center rounded-full border">
            <Icon className="size-3.5" strokeWidth={2.25} />
          </span>
          <span className="text-foreground text-center text-[10.5px] leading-tight font-semibold">
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

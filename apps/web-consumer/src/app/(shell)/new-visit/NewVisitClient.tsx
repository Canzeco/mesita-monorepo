"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, QrCode } from "lucide-react";

import { PlacePickList } from "@/components/consumer/rewards/PlacePickList";
import { SavingsReveal } from "@/components/consumer/rewards/SavingsReveal";
import { SearchBar } from "@/components/consumer/search/SearchBar";
import { type ConsumerTicketRow } from "@/lib/api/tickets";
import { CONSUMER_ROUTES, visitPath } from "@/lib/consumer-route-contract";
import { useConsumerTickets } from "@/lib/hooks/useConsumerTickets";
import { useStartVisit } from "@/lib/hooks/useStartVisit";
import { MONTERREY_CENTER } from "@/lib/map-defaults";
import { useUserLocation } from "@/lib/use-user-location";
import { cn } from "@/lib/utils";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";

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
// tickets… you only see places"). The quick list is the closest 50 listed
// places around the guest; typing searches by name when the place is not in
// that 50. The live ticket no longer pins above the list — Pay never paints
// an Open chip. Tickets live on THE TICKET and in Inbox.
//
// A SEARCH FIELD IS THE HEADER (Pato, 2026-08-16: "remove the stupid banner on
// top displaying the steps" + "replace that with a searchbar"). This overturns
// the 2026-08-10 "always leave the 4 steps" ruling, and the steps rail is gone
// with it — four glyphs that never moved and never reflected state spent the
// header's whole budget explaining a flow the guest is already inside. The
// header now DOES the surface's job instead of narrating it: this list answers
// "where are you?", and typing is how you answer it in one move rather than
// scrolling a hundred rows. Do not restore the rail.
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

  // The query lives HERE, not in PlacePickList: the field renders in the
  // shrink-0 header and the list renders in the scroll body, so the only
  // common owner is this component. PlacePickList still owns the rows and
  // does the matching — this holds the string and nothing else.
  const [query, setQuery] = useState("");
  const coords = useUserLocation();
  const origin = useMemo(
    () => coords ?? MONTERREY_CENTER,
    [coords],
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

  // The one open ticket that earns the header slot. `active` is already
  // fetched for the pick list (it decides which places re-open rather than
  // 409); this reads it, it does not add a fetch. Most recent wins when a
  // guest somehow holds two — the one they just started is the one they are
  // standing in front of.
  const liveTicket = tickets.active[0] ?? null;

  // The Cards row left this surface on 2026-09-01: Wallet is a real Pay
  // SECTION now, so cards live one pill away instead of as a row wedged above
  // the place list. Me keeps its own doorway regardless — consumer-web-add-card
  // returns to /me?cards=added and supabase/ is out of scope here.
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
      {/* The search field lives in a shrink-0 header, OUTSIDE the scroll body:
          a filter that scrolls away has stopped filtering — you would have to
          scroll back up to correct a query whose results you are looking at. */}
      <div className="border-border bg-background/90 shrink-0 border-b px-4 pt-3 pb-2.5 backdrop-blur-xl">
        {/* The SAME bar Search uses, minus the filter affordance (the wallet
            has no discovery filters). Two hand-rolled search inputs on two tabs
            drift apart; one component cannot. */}
        <SearchBar
          query={query}
          showClear={query.length > 0}
          onQueryChange={setQuery}
          onClear={() => setQuery("")}
          placeholder="Find the place you're at…"
        />

        {/* The tab track is GONE (Pato, 2026-08-16: "move the visits history
            there"). History moved to Inbox › Visits, which leaves this tab with
            exactly one job — pick a place and start a visit — and no switcher
            to justify. A one-tab tab bar is chrome pretending to be a control.

            The pointer stays because a feature that MOVED needs a forwarding
            address; anyone who knew History lived here has to be told where it
            went, once, in the place they'll look. It therefore has to say
            HISTORY: the label read "Your visits live in Inbox", which names
            the destination but not the thing that moved, so the one reader it
            exists for — someone hunting the History tab — had nothing to
            match on. */}
        {liveTicket ? (
          /* A LIVE TICKET OUTRANKS THE POINTER (2026-09-01).

             This does NOT restore the Open chip. The chip was a badge on a
             place ROW inside the list — same tap target class as "start a
             visit here", which is why it went. This is one row in the header,
             above the list, that navigates and cannot create anything.

             The case for it: the guest standing at a table with an open
             ticket is the moment this product exists for, and until now the
             ticket was two taps deep in Activity while Pay showed them a list
             to start a SECOND one. Time-critical beats passive for the one
             piece of permanent real estate on this surface. The pointer below
             is passive by definition, so it yields. */
          <Link
            href={visitPath(liveTicket.id)}
            className="border-primary/25 bg-primary/8 hover:bg-primary/12 mt-2 flex items-center gap-2 rounded-xl border px-3 py-2 transition active:scale-[0.99]"
          >
            <span className="bg-primary/15 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
              <QrCode className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="text-foreground block truncate text-xs font-semibold">
                {liveTicket.place?.name ?? "Your visit"}
              </span>
              <span className="text-muted-foreground type-label block">
                Show your QR
              </span>
            </span>
            <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
          </Link>
        ) : (
          <Link
            href={CONSUMER_ROUTES.inbox.visits}
            className="text-muted-foreground hover:text-foreground mt-2 flex items-center justify-center gap-1 text-xs font-semibold transition"
          >
            Your visit history lives in Activity
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
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
          <p className={cn(ERROR_BOX_CLASS, "type-body")}>
            {startError}
          </p>
        ) : null}
        {/* Closest 50 around the guest; the header query is name search. */}
        <PlacePickList
          origin={origin}
          busyPlaceId={startingId}
          onPick={onPick}
          query={query}
          onClearQuery={() => setQuery("")}
        />
      </div>

    </div>
  );
}

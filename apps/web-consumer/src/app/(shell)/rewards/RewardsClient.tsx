"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, QrCode, Sparkles, Star, TicketX } from "lucide-react";

import { PlacePickList } from "@/components/consumer/rewards/PlacePickList";
import { SavingsReveal } from "@/components/consumer/rewards/SavingsReveal";
import { TicketRow } from "@/components/consumer/rewards/TicketRow";
import { TicketCardSkeleton } from "./RewardsTabLoading";
import { EFError } from "@/lib/api/_invoke";
import {
  ACTIVE_TICKET_STATUSES,
  apiCreateTicket,
  apiListConsumerTickets,
  type ConsumerTicketRow,
} from "@/lib/api/tickets";
import type { Place } from "@/lib/api/places";
import { ticketPath } from "@/lib/consumer-route-contract";
import { useConsumerTickets } from "@/lib/hooks/useConsumerTickets";
import { EmptyState } from "@/components/shared";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

// Rewards Wallet — TWO tabs: New / History (MESITA-1024, Pato: "just two
// pages"; Pending died — a status bucket that almost always held one row or
// none).
//
// NEW IS A PLACE LIST AND NOTHING ELSE (Pato, 2026-08-11: "you don't see the
// tickets… you only see places, step 1 — list all the places in Mesita,
// that's it"). The live ticket no longer pins above the list: New is the
// question "where are you?", and a ticket sitting in the answer slot made the
// tab look like two products. Tickets live on THE TICKET and in History.
//
// ONE TAP CREATES THE TICKET (Pato, same session: "you select a place, a
// ticket is automatically created — only by clicking a place. create ticket,
// then id… so you open a modal, the modal has multiple steps"). The 2-step
// TicketWizard sheet is GONE: there is no pre-create screen at all. Every
// ticket is created at "base" and THE TICKET — a four-step modal at
// /rewards/ticket/[id] — owns reward → task → QR → results.
//
// "base" is what makes the reward stop being a create-time boundary: the
// submit-review / submit-story EFs accept any OPEN ticket, and a late task
// re-prices upward, so the QR works from the first frame and the rung is
// picked afterwards inside the modal.
//
// Tapping a place that already holds a live ticket re-opens that ticket
// instead of 409-ing on `already_open` (D5).

type Tab = "new" | "history";

/** THE TICKET path with the one-time entrance flag (TicketScreen strips it). */
function bornTicketPath(id: string): string {
  return `${ticketPath(id)}?born=1`;
}

export function RewardsClient({ userId }: { userId: string }) {
  const supabase = useBrowserSupabase();
  const router = useRouter();
  const tickets = useConsumerTickets(userId);

  // New is always the default: it is where every visit starts, so there is no
  // state to route to. A manual tap pins the choice for the session.
  const [tabChoice, setTabChoice] = useState<Tab | null>(null);
  const tab: Tab = tabChoice ?? "new";

  const activePlaceIds = useMemo(
    () => new Set(tickets.active.map((t) => t.project_id)),
    [tickets.active],
  );

  // ── Ticket creation: tap a place, that's it. ──
  const [startingId, setStartingId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const openTicket = useCallback(
    (id: string) => {
      router.push(ticketPath(id), { scroll: false });
    },
    [router],
  );

  const startTicket = useCallback(
    async (place: Place) => {
      setStartingId(place.id);
      setStartError(null);
      // ALWAYS "base": no task attached, nothing gating the QR. The rung is
      // the modal's step 1, not this tap's decision.
      try {
        const res = await apiCreateTicket(supabase, place.id, "base");
        void tickets.refresh();
        router.push(bornTicketPath(res.ticket.id), { scroll: false });
      } catch (err) {
        if (err instanceof EFError && err.code === "already_open") {
          // Another device/tab won the race — open the existing ticket. The
          // friendly 409 carries its id; the index-race arm doesn't, so fall
          // back to a fresh list (never the stale closure state).
          const fromBody = err.body?.ticketId;
          let id = typeof fromBody === "string" ? fromBody : null;
          if (!id) {
            const rows = await apiListConsumerTickets(supabase).catch(
              () => [] as ConsumerTicketRow[],
            );
            id =
              rows.find(
                (t) =>
                  t.project_id === place.id &&
                  ACTIVE_TICKET_STATUSES.has(t.status),
              )?.id ?? null;
          }
          if (id) {
            openTicket(id);
            return;
          }
        }
        setStartError(
          err instanceof Error ? err.message : "Couldn't start your ticket.",
        );
      } finally {
        setStartingId(null);
      }
    },
    [supabase, tickets, router, openTicket],
  );

  const onPick = useCallback(
    (place: Place) => {
      const existing = tickets.active.find((t) => t.project_id === place.id);
      if (existing) {
        // Live ticket → open it rather than making a second one (D5).
        openTicket(existing.id);
        return;
      }
      void startTicket(place);
    },
    [tickets.active, openTicket, startTicket],
  );

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
          body: the steps and the tab switcher are what tell you where you are,
          and an orientation control that scrolls away has stopped orienting. */}
      <div className="border-border bg-background/90 shrink-0 border-b px-4 pt-3 pb-2.5 backdrop-blur-xl">
        {/* ALWAYS. On every tab, no gate.
            decision: Pato, 2026-08-10 — "always leave the 4 steps, never
            remove them, those are the header." This supersedes MESITA-1018,
            which had scoped them to New on the reasoning that Pending and
            History hold tickets already made. The steps are the wallet's
            masthead, not a per-tab progress indicator: they say what this tab
            IS, and a header that appears and disappears as you switch tabs is
            worse than one that simply stays. Do not re-gate this.

            Boxed as its own module so the header reads as two clean controls
            stacked — the steps say what this surface is, the track below says
            which slice you're looking at — instead of loose marks floating over
            a band. */}
        <div className="border-border bg-card rounded-xl border px-2 py-2.5">
          <PitchSteps />
        </div>

        {/* Slim muted track (MESITA-908): ~32px paint, ≥44px hit via vertical
            slop so the control stays calm without sacrificing touch targets. */}
        <div className="-mb-1.5 pt-2 pb-1.5">
          <div className="bg-muted grid grid-cols-2 gap-0.5 rounded-[10px] p-[3px]">
            {(
              [
                { id: "new", label: "New" },
                { id: "history", label: "History" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTabChoice(t.id)}
                aria-pressed={tab === t.id}
                className={cn(
                  "flex min-h-8 items-center justify-center gap-1 rounded-[8px] px-1 text-center text-[12px] font-semibold transition",
                  tab === t.id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 pt-4 pb-6">
        {justPaid ? (
          <SavingsReveal
            placeName={justPaid.place?.name ?? "the place"}
            savedCents={justPaid.discount_cents ?? 0}
            onDone={() => setJustPaid(null)}
          />
        ) : null}

        {tab === "new" ? (
          <>
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
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-2.5">
            {tickets.status === "loading" ? (
              <TicketCardSkeleton />
            ) : tickets.status === "error" ? (
              <ErrorBox retry={tickets.retry} />
            ) : tickets.history.length === 0 ? (
              <EmptyState
                icon={TicketX}
                title="No closed visits yet"
                description="Once you use a ticket, it lands here with what you saved."
              />
            ) : (
              tickets.history.map((t) => (
                <TicketRow
                  key={t.id}
                  ticket={t}
                  onOpen={() => openTicket(t.id)}
                />
              ))
            )}
          </div>
        )}
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

function ErrorBox({ retry }: { retry: () => void }) {
  return (
    <div className="border-border bg-card flex items-center justify-between gap-3 rounded-2xl border px-4 py-3">
      <p className="text-muted-foreground text-[12.5px]">
        Couldn&apos;t load your tickets.
      </p>
      <button
        type="button"
        onClick={retry}
        className="text-primary text-[12.5px] font-semibold"
      >
        Retry
      </button>
    </div>
  );
}

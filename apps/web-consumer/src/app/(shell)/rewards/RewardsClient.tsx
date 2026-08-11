"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, QrCode, Sparkles, Star, TicketX } from "lucide-react";

import { PlacePickList } from "@/components/consumer/rewards/PlacePickList";
import { SavingsReveal } from "@/components/consumer/rewards/SavingsReveal";
import { TicketRow } from "@/components/consumer/rewards/TicketRow";
import {
  TicketWizard,
  bornTicketPath,
} from "@/components/consumer/rewards/TicketWizard";
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
import { strategyForPlaceRow } from "@/lib/promo-rates";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

// Rewards Wallet — TWO tabs: New / History (MESITA-1024, Pato: "just two
// pages"; Pending died — a status bucket that almost always held one row or
// none). The wallet is the DOOR: tapping a partner in New opens the 2-step
// TicketWizard (Pick reward → Do it), which creates the ticket and lands on
// THE ticket screen (/rewards/ticket/[id]?born=1). A LIVE ticket is a
// TicketRow pinned at the top of New, above the place list — the current
// visit leads the tab you start visits from. History is compact rows into
// the same screen. The venue pass modal and in-list QR cards died with
// MESITA-857 — one object, one surface. Zero-strategy partners skip the
// wizard (D9): create at "base", go.

type Tab = "new" | "history";

export function RewardsClient({ userId }: { userId: string }) {
  const supabase = useBrowserSupabase();
  const router = useRouter();
  const tickets = useConsumerTickets(userId);

  // New is always the default: it holds the live ticket too, so there is no
  // state to route to. A manual tap pins the choice for the session.
  const [tabChoice, setTabChoice] = useState<Tab | null>(null);
  const tab: Tab = tabChoice ?? "new";

  const activePlaceIds = useMemo(
    () => new Set(tickets.active.map((t) => t.project_id)),
    [tickets.active],
  );

  // ── Ticket creation: tap → wizard (or the D9 zero-strategy fast path). ──
  const [startingId, setStartingId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [wizardPlace, setWizardPlace] = useState<Place | null>(null);

  const openTicket = useCallback(
    (id: string) => {
      router.push(ticketPath(id), { scroll: false });
    },
    [router],
  );

  // D9 fast path: zero/null-strategy partners have nothing to pick and
  // nothing gates — create at "base" and land on THE TICKET directly.
  const startBaseTicket = useCallback(
    async (place: Place) => {
      setStartingId(place.id);
      setStartError(null);
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
        // Live ticket → bypass the wizard, open THE TICKET (D5).
        openTicket(existing.id);
        return;
      }
      if (strategyForPlaceRow(place) === "zero") {
        void startBaseTicket(place);
        return;
      }
      setWizardPlace(place);
    },
    [tickets.active, openTicket, startBaseTicket],
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
            {/* The live ticket leads the tab (MESITA-1024) — Pending's only
                content, folded in here. Rows stay ONE column: a ticket is
                scanned for its state at arm's length in a dark venue. Silent
                while loading (PlacePickList carries the tab's skeleton) and
                silent on error — the place list is still usable and the
                History tab reports ticket-load failures. */}
            {tickets.active.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {tickets.active.map((t) => (
                  <TicketRow
                    key={t.id}
                    ticket={t}
                    onOpen={() => openTicket(t.id)}
                  />
                ))}
              </div>
            ) : null}
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

        {/* The 2-step generation ceremony — Pick reward → Do it (D5–D11). */}
        <TicketWizard
          place={wizardPlace}
          activeTickets={tickets.active}
          onClose={() => setWizardPlace(null)}
          onCreated={() => {
            void tickets.refresh();
          }}
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

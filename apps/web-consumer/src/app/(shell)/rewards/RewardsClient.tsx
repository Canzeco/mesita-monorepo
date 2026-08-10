"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  QrCode,
  TicketX,
} from "lucide-react";

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
import { strategyForPlaceRow } from "@/lib/promo-rates";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

// Rewards Wallet (MESITA-811 · 820 · 857) — New / Pending / History. The
// wallet is the DOOR: tapping a partner in New opens the 2-step TicketWizard
// (Pick reward → Do it, plan ticket-flow-20260809), which creates the ticket
// and lands on THE ticket screen (/rewards/ticket/[id]?born=1). Pending and
// History are compact rows into the same screen. The venue pass modal and
// in-list QR cards died with MESITA-857 — one object, one surface. The old
// wantsStory interstitial died with the wizard (D6: chosenReward subsumes
// it). Zero-strategy partners skip the wizard (D9): create at "base", go.

type Tab = "new" | "pending" | "history";

export function RewardsClient({ userId }: { userId: string }) {
  const supabase = useBrowserSupabase();
  const router = useRouter();
  const tickets = useConsumerTickets(userId);

  // Default tab is DERIVED, not effect-set: Pending while a live ticket
  // exists, New otherwise. A manual tap pins the choice for the session.
  const [tabChoice, setTabChoice] = useState<Tab | null>(null);
  const tab: Tab = tabChoice ?? (tickets.active.length > 0 ? "pending" : "new");

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
      setTabChoice("pending");
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
        setTabChoice("pending");
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
    <div className="scrollbar-hide flex h-full min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 pt-4 pb-6">

      {justPaid ? (
        <SavingsReveal
          placeName={justPaid.place?.name ?? "the place"}
          savedCents={justPaid.discount_cents ?? 0}
          onDone={() => setJustPaid(null)}
        />
      ) : null}

      {/* Slim muted track (MESITA-908): ~32px paint, ≥44px hit via vertical
          slop so the control stays calm without sacrificing touch targets. */}
      <div className="-my-1.5 py-1.5">
        <div className="bg-muted grid grid-cols-3 gap-0.5 rounded-[10px] p-[3px]">
          {(
            [
              { id: "new", label: "New" },
              { id: "pending", label: "Pending" },
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
              {t.id === "pending" && tickets.active.length > 0 ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[9px] font-bold leading-none",
                    tab === "pending"
                      ? "bg-background/25 text-background"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {tickets.active.length}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {tab === "new" ? (
        <>
          {startError ? (
            <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-[12.5px]">
              {startError}
            </p>
          ) : null}
          <PlacePickList
            activePlaceIds={activePlaceIds}
            busyPlaceId={startingId}
            onPick={onPick}
          />
        </>
      ) : tab === "pending" ? (
        <div className="flex flex-col gap-2.5">
          {tickets.status === "loading" ? (
            <TicketCardSkeleton />
          ) : tickets.status === "error" ? (
            <ErrorBox retry={tickets.retry} />
          ) : tickets.active.length === 0 ? (
            <div className="surface-card flex flex-col items-center gap-3 rounded-2xl px-6 py-10 text-center">
              <span className="bg-primary/10 text-primary grid size-12 place-items-center rounded-2xl">
                <QrCode className="size-6" />
              </span>
              <p className="text-foreground text-[14px] font-semibold">
                No live ticket
              </p>
              <p className="text-muted-foreground max-w-[280px] text-[12.5px] leading-relaxed">
                Pick the place you&apos;re visiting in New and your ticket opens
                with its QR.
              </p>
              <button
                type="button"
                onClick={() => setTabChoice("new")}
                className="bg-pink-gradient shadow-glow mt-1 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white transition active:scale-[0.99]"
              >
                Browse places
              </button>
            </div>
          ) : (
            tickets.active.map((t) => (
              <TicketRow
                key={t.id}
                ticket={t}
                onOpen={() => openTicket(t.id)}
              />
            ))
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {tickets.status === "loading" ? (
            <TicketCardSkeleton />
          ) : tickets.status === "error" ? (
            <ErrorBox retry={tickets.retry} />
          ) : tickets.history.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
              <span className="bg-muted text-muted-foreground grid size-11 place-items-center rounded-full">
                <TicketX className="size-5" />
              </span>
              <p className="text-muted-foreground text-[12.5px]">
                Your closed visits will land here.
              </p>
            </div>
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
          setTabChoice("pending");
          void tickets.refresh();
        }}
      />
    </div>
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

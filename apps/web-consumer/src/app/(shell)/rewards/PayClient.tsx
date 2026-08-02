"use client";

import { useCallback, useMemo, useState } from "react";
import { Plus, TicketX } from "lucide-react";

import { MyQrCard } from "@/components/consumer/MyQrCard";
import { RewardProgramCard } from "@/components/consumer/RewardProgramCard";
import { RewardsTopCards } from "@/components/consumer/RewardsTopCards";
import { CheckTicketCard } from "@/components/consumer/rewards/CheckTicketCard";
import { CreateTicketSheet } from "@/components/consumer/rewards/CreateTicketSheet";
import { HistoryTicketCard } from "@/components/consumer/rewards/HistoryTicketCard";
import { TicketCardSkeleton } from "./PayTabLoading";
import { apiCancelTicket } from "@/lib/api/tickets";
import {
  computeRewardStats,
  useConsumerPayTickets,
} from "@/lib/hooks/useConsumerPayTickets";
import {
  derivePassTicketFromRows,
  useConsumerTickets,
} from "@/lib/hooks/useConsumerTickets";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

// Rewards — Tickets v2 (MESITA-806): program card + passport, then the
// TICKET-driven New/History tabs. New = live tickets (the QR is the ticket:
// it encodes mesita.ai/check/<code>) + the create flow; History = closed
// visits. Notifications stay underneath as the bill push/poll + the member
// scorecard source; tickets are the state, notifications the signal.

type Tab = "new" | "history";

export function PayClient({
  userId,
  code,
  name,
  instagramHandle,
}: {
  userId: string;
  code: string;
  name?: string;
  instagramHandle?: string | null;
}) {
  const supabase = useBrowserSupabase();
  const [tab, setTab] = useState<Tab>("new");
  const [createOpen, setCreateOpen] = useState(false);

  const tickets = useConsumerTickets(userId);
  // Notification bundles still feed the passport's member scorecard.
  const notifications = useConsumerPayTickets(userId);
  const stats = useMemo(
    () => computeRewardStats(notifications.bundles, notifications.ticketMetaById),
    [notifications.bundles, notifications.ticketMetaById],
  );
  const activeTicket = useMemo(
    () => derivePassTicketFromRows(tickets.active),
    [tickets.active],
  );

  const cancelTicket = useCallback(
    async (ticketId: string) => {
      await apiCancelTicket(supabase, ticketId);
      await tickets.refresh();
    },
    [supabase, tickets],
  );

  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-6">
      <RewardProgramCard />

      <RewardsTopCards />

      <MyQrCard
        code={code}
        name={name}
        instagramHandle={instagramHandle}
        stats={stats}
        activeTicket={activeTicket}
      />

      {/* New / History — the ticket tabs (saved/reservations two-pill pattern). */}
      <div className="border-border bg-card grid grid-cols-2 gap-0 rounded-2xl border p-1">
        {(
          [
            { id: "new", label: "New" },
            { id: "history", label: "History" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl px-1 py-1.5 text-center text-[12px] font-medium transition",
              tab === t.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.id === "new" && tickets.active.length > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] font-bold",
                  tab === "new"
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

      {tab === "new" ? (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="bg-pink-gradient shadow-glow flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white transition active:scale-[0.99]"
          >
            <Plus className="size-4" strokeWidth={2.5} />
            Start a ticket
          </button>

          {tickets.status === "loading" ? (
            <TicketCardSkeleton />
          ) : tickets.status === "error" ? (
            <ErrorBox retry={tickets.retry} />
          ) : tickets.active.length === 0 ? (
            <p className="text-muted-foreground px-2 py-4 text-center text-[12.5px] leading-relaxed">
              No live ticket. Start one when you sit down — pick the place,
              show the QR, and your discount applies at the bill.
            </p>
          ) : (
            tickets.active.map((t) => (
              <CheckTicketCard key={t.id} ticket={t} onCancel={cancelTicket} />
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
            tickets.history.map((t) => <HistoryTicketCard key={t.id} ticket={t} />)
          )}
        </div>
      )}

      <CreateTicketSheet
        // Remount per open: fresh state without a reset effect (React 19
        // set-state-in-effect rule).
        key={String(createOpen)}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async () => {
          await tickets.refresh();
          setTab("new");
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

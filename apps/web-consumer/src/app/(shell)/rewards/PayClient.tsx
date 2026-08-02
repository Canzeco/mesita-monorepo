"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Plus, QrCode, Sparkles, TicketX } from "lucide-react";

import { ContextStrip } from "@/components/consumer/rewards/ContextStrip";
import { CheckTicketCard } from "@/components/consumer/rewards/CheckTicketCard";
import { CreateTicketSheet } from "@/components/consumer/rewards/CreateTicketSheet";
import { HistoryTicketCard } from "@/components/consumer/rewards/HistoryTicketCard";
import { HowItWorksSheet } from "@/components/consumer/rewards/HowItWorksSheet";
import { MemberRow } from "@/components/consumer/rewards/MemberRow";
import { SavingsReveal } from "@/components/consumer/rewards/SavingsReveal";
import { TicketCardSkeleton } from "./PayTabLoading";
import { apiCancelTicket, type ConsumerTicketRow } from "@/lib/api/tickets";
import {
  computeRewardStats,
  useConsumerPayTickets,
} from "@/lib/hooks/useConsumerPayTickets";
import { useConsumerTickets } from "@/lib/hooks/useConsumerTickets";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

// Rewards is a WALLET (MESITA-808, redesign 1A): the first viewport answers
// "what do I do at this table?" — the live ticket QR (or the Start hero +
// pitch strip) owns THE slot; the context strip carries orientation; the
// identity row replaces the retired passport card (2A: no second QR, ever);
// all education lives in the How-it-works sheet. Motion budget = exactly two
// beats: the verified pulse (CheckTicketCard) and the savings reveal here.

type Tab = "ticket" | "history";

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
  const [tab, setTab] = useState<Tab>("ticket");
  const [createOpen, setCreateOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

  const tickets = useConsumerTickets(userId);
  // Notifications remain the scorecard + bill-poll source.
  const notifications = useConsumerPayTickets(userId);
  const stats = useMemo(
    () => computeRewardStats(notifications.bundles, notifications.ticketMetaById),
    [notifications.bundles, notifications.ticketMetaById],
  );

  const cancelTicket = useCallback(
    async (ticketId: string) => {
      await apiCancelTicket(supabase, ticketId);
      await tickets.refresh();
    },
    [supabase, tickets],
  );

  // The paid beat (4A): when a ticket the guest was WATCHING (it was active)
  // flips to revealed on a poll, hold it in THE slot as a savings reveal for
  // a few seconds before it settles into History.
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
      <ContextStrip onOpenHow={() => setHowOpen(true)} />

      {/* THE slot — the wallet's object. */}
      {justPaid ? (
        <SavingsReveal
          placeName={justPaid.place?.name ?? "the place"}
          savedCents={justPaid.discount_cents ?? 0}
          onDone={() => setJustPaid(null)}
        />
      ) : null}

      {/* Ticket / History pills (5A) — ≥44px hit areas (Pass 6). */}
      <div className="border-border bg-card grid grid-cols-2 gap-0 rounded-2xl border p-1">
        {(
          [
            { id: "ticket", label: "Ticket" },
            { id: "history", label: "History" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={cn(
              "flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-1 text-center text-[12.5px] font-semibold transition",
              tab === t.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.id === "ticket" && tickets.active.length > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] font-bold",
                  tab === "ticket"
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

      {tab === "ticket" ? (
        <div className="flex flex-col gap-3">
          {tickets.status === "loading" ? (
            <TicketCardSkeleton />
          ) : tickets.status === "error" ? (
            <ErrorBox retry={tickets.retry} />
          ) : tickets.active.length === 0 ? (
            <EmptyPitch onStart={() => setCreateOpen(true)} />
          ) : (
            <>
              {tickets.active.map((t) => (
                <CheckTicketCard key={t.id} ticket={t} onCancel={cancelTicket} />
              ))}
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="border-border text-muted-foreground hover:text-foreground flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-dashed text-[12.5px] font-semibold transition"
              >
                <Plus className="size-4" /> Another place
              </button>
            </>
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

      {/* Identity row — the demoted passport (2A: text code, no QR). */}
      <MemberRow code={code} name={name} instagramHandle={instagramHandle} />

      <HowItWorksSheet
        open={howOpen}
        onClose={() => setHowOpen(false)}
        stats={stats}
      />

      <CreateTicketSheet
        // Remount per open: fresh state without a reset effect (React 19
        // set-state-in-effect rule).
        key={String(createOpen)}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async () => {
          await tickets.refresh();
          setTab("ticket");
        }}
      />
    </div>
  );
}

// The empty state IS the pitch (3A): the three-step story plus the one
// gradient hero this page is allowed when no ticket is live.
function EmptyPitch({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="border-border bg-card grid grid-cols-3 gap-1 rounded-2xl border px-3 py-4">
        <PitchStep icon={<MapPin className="size-[18px]" />} label="Pick the place" />
        <PitchStep icon={<QrCode className="size-[18px]" />} label="Show your QR" />
        <PitchStep icon={<Sparkles className="size-[18px]" />} label="Pay less" />
      </div>
      <button
        type="button"
        onClick={onStart}
        className="bg-pink-gradient shadow-glow flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white transition active:scale-[0.99]"
      >
        <Plus className="size-4" strokeWidth={2.5} />
        Start a ticket
      </button>
    </div>
  );
}

function PitchStep({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <span className="bg-secondary/10 text-secondary grid size-9 place-items-center rounded-xl">
        {icon}
      </span>
      <span className="text-foreground text-[11px] leading-tight font-semibold">
        {label}
      </span>
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

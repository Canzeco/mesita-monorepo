"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MapPin, QrCode, Sparkles, TicketX } from "lucide-react";

import { CheckTicketCard } from "@/components/consumer/rewards/CheckTicketCard";
import { HistoryTicketCard } from "@/components/consumer/rewards/HistoryTicketCard";
import { PlacePickList } from "@/components/consumer/rewards/PlacePickList";
import { SavingsReveal } from "@/components/consumer/rewards/SavingsReveal";
import { VenuePassModal } from "@/components/consumer/rewards/VenuePassModal";
import { TicketCardSkeleton } from "./PayTabLoading";
import { apiCancelTicket, type ConsumerTicketRow } from "@/lib/api/tickets";
import type { Place } from "@/lib/api/places";
import { useConsumerTickets } from "@/lib/hooks/useConsumerTickets";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

// Rewards Wallet v3 (MESITA-811 · MESITA-820) — the three steps → New /
// Pending / History. No identity header: the tab bar already reads
// "Me · <class>", so repeating name+tier here was pure chrome on a page
// whose job is doing. New lists every partner place (no searchbar yet); tapping one
// opens the venue pass modal, which reuses-or-creates the ticket and shows
// the QR. Education stays on Me > Help (MESITA-809); the motion budget
// (verified pulse + savings reveal) carries over from MESITA-808.

type Tab = "new" | "pending" | "history";

export function PayClient({ userId }: { userId: string }) {
  const supabase = useBrowserSupabase();
  const tickets = useConsumerTickets(userId);

  // Default tab is DERIVED, not effect-set: Pending while a live ticket
  // exists (mid-visit the QR is one tap away), New otherwise. A manual tap
  // pins the choice for the session.
  const [tabChoice, setTabChoice] = useState<Tab | null>(null);
  const tab: Tab =
    tabChoice ?? (tickets.active.length > 0 ? "pending" : "new");

  const [passPlace, setPassPlace] = useState<Place | null>(null);

  const activePlaceIds = useMemo(
    () => new Set(tickets.active.map((t) => t.project_id)),
    [tickets.active],
  );

  const cancelTicket = useCallback(
    async (ticketId: string) => {
      await apiCancelTicket(supabase, ticketId);
      await tickets.refresh();
    },
    [supabase, tickets],
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
      <PitchSteps />

      {justPaid ? (
        <SavingsReveal
          placeName={justPaid.place?.name ?? "the place"}
          savedCents={justPaid.discount_cents ?? 0}
          onDone={() => setJustPaid(null)}
        />
      ) : null}

      {/* Segmented control — a FILLED track, not a bordered card, so it
          reads as a control and never twins with the step rail above.
          ≥44px hit areas. */}
      <div className="bg-muted grid grid-cols-3 gap-1 rounded-2xl p-1">
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
              "flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-1 text-center text-[12.5px] font-semibold transition",
              tab === t.id
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.id === "pending" && tickets.active.length > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] font-bold",
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

      {tab === "new" ? (
        <PlacePickList
          activePlaceIds={activePlaceIds}
          onPick={(place) => setPassPlace(place)}
        />
      ) : tab === "pending" ? (
        <div className="flex flex-col gap-3">
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
                Pick the place you&apos;re visiting in New and your QR is
                ready to scan.
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
            tickets.history.map((t) => (
              <HistoryTicketCard key={t.id} ticket={t} />
            ))
          )}
        </div>
      )}

      <VenuePassModal
        // Remount per venue: fresh modal state without reset effects.
        key={passPlace?.id ?? "closed"}
        place={passPlace}
        tickets={tickets}
        onClose={() => setPassPlace(null)}
        onTicketStarted={() => setTabChoice("pending")}
      />
    </div>
  );
}

// The three steps — a RAIL, not a card: numbered, connected by hairlines, no
// border. Previously it was a bordered card sitting directly above the tab
// card, so the two read as twins; steps are instruction and tabs are control,
// and they should never look alike.
const PITCH_STEPS = [
  { icon: MapPin, label: "Pick the place" },
  { icon: QrCode, label: "Show your QR" },
  { icon: Sparkles, label: "Pay less" },
] as const;

function PitchSteps() {
  return (
    <ol className="flex items-start px-1 pt-1 pb-0.5">
      {PITCH_STEPS.map(({ icon: Icon, label }, i) => (
        <Fragment key={label}>
          <li className="flex w-0 flex-1 flex-col items-center gap-1.5">
            <span className="bg-secondary/10 text-secondary grid size-10 place-items-center rounded-xl">
              <Icon className="size-[18px]" />
            </span>
            <span className="text-foreground text-center text-[11px] leading-tight font-semibold">
              <span className="text-primary font-extrabold">{i + 1}</span>{" "}
              {label}
            </span>
          </li>
          {i < PITCH_STEPS.length - 1 ? (
            <span
              aria-hidden="true"
              className="bg-border mt-5 h-px w-5 shrink-0 sm:w-8"
            />
          ) : null}
        </Fragment>
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

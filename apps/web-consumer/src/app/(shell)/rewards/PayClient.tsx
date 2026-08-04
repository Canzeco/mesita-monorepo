"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Instagram,
  Loader2,
  MapPin,
  QrCode,
  Sparkles,
  Star,
  TicketX,
} from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { PlacePickList } from "@/components/consumer/rewards/PlacePickList";
import { SavingsReveal } from "@/components/consumer/rewards/SavingsReveal";
import { TicketRow } from "@/components/consumer/rewards/TicketRow";
import { TicketCardSkeleton } from "./PayTabLoading";
import { EFError } from "@/lib/api/_invoke";
import {
  ACTIVE_TICKET_STATUSES,
  apiCreateTicket,
  apiListConsumerTickets,
  type ConsumerTicketRow,
} from "@/lib/api/tickets";
import type { Place } from "@/lib/api/places";
import { ticketPath } from "@/lib/consumer-route-contract";
import { useConsumerClass } from "@/lib/class-context";
import { useConsumerTickets } from "@/lib/hooks/useConsumerTickets";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

// Rewards Wallet (MESITA-811 · 820 · 857) — the four steps → New / Pending /
// History. The wallet is now purely the DOOR: tapping a partner in New
// creates the ticket and navigates straight to THE ticket screen
// (/rewards/ticket/[id]); Pending and History are compact rows into the same
// screen. The venue pass modal and the in-list QR card died with MESITA-857 —
// one object, one surface. Influencers get the one create-time interstitial
// (wantsStory can't be added after create).

type Tab = "new" | "pending" | "history";

export function PayClient({ userId }: { userId: string }) {
  const supabase = useBrowserSupabase();
  const router = useRouter();
  const tickets = useConsumerTickets(userId);
  const { key: classKey } = useConsumerClass();

  // Default tab is DERIVED, not effect-set: Pending while a live ticket
  // exists, New otherwise. A manual tap pins the choice for the session.
  const [tabChoice, setTabChoice] = useState<Tab | null>(null);
  const tab: Tab = tabChoice ?? (tickets.active.length > 0 ? "pending" : "new");

  const activePlaceIds = useMemo(
    () => new Set(tickets.active.map((t) => t.project_id)),
    [tickets.active],
  );

  // ── Ticket creation: tap → create → navigate. ──
  const [startingId, setStartingId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [storyPlace, setStoryPlace] = useState<Place | null>(null);
  const [wantsStory, setWantsStory] = useState(false);

  const openTicket = useCallback(
    (id: string) => {
      setTabChoice("pending");
      router.push(ticketPath(id), { scroll: false });
    },
    [router],
  );

  const startTicket = useCallback(
    async (place: Place, withStory: boolean) => {
      setStartingId(place.id);
      setStartError(null);
      try {
        const res = await apiCreateTicket(supabase, place.id, withStory);
        void tickets.refresh();
        openTicket(res.ticket.id);
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
    [supabase, tickets, openTicket],
  );

  const onPick = useCallback(
    (place: Place) => {
      const existing = tickets.active.find((t) => t.project_id === place.id);
      if (existing) {
        openTicket(existing.id);
        return;
      }
      if (classKey === "influencer") {
        // The one create-time choice: the Story rung can't be added later.
        setWantsStory(false);
        setStoryPlace(place);
        return;
      }
      void startTicket(place, false);
    },
    [tickets.active, classKey, openTicket, startTicket],
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

      {/* Influencer interstitial — the ONE create-time choice (wantsStory). */}
      <LocalSheet
        open={storyPlace !== null}
        onClose={() => setStoryPlace(null)}
        ariaLabel="Add the Story bonus?"
      >
        <div className="flex flex-col gap-4 px-5 pt-4 pb-8">
          <div>
            <h2 className="text-foreground text-lg leading-tight font-bold tracking-tight">
              Add the Story bonus?
            </h2>
            <p className="text-muted-foreground mt-0.5 text-[12.5px]">
              Yours alone as an Influencer — decide before the ticket opens.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setWantsStory((v) => !v)}
            aria-pressed={wantsStory}
            className={cn(
              "flex items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition",
              wantsStory
                ? "border-secondary/40 bg-secondary/5"
                : "border-border",
            )}
          >
            <span className="bg-secondary/10 text-secondary grid size-8 shrink-0 place-items-center rounded-lg">
              <Instagram className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-foreground block text-[13px] font-semibold">
                Post a tagged story at the table
              </span>
              <span className="text-muted-foreground block text-[12px] leading-snug">
                A bigger reward than your class rate — verified before it pays.
              </span>
            </span>
            <span
              className={cn(
                "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-bold",
                wantsStory
                  ? "border-secondary bg-secondary text-white"
                  : "border-border text-transparent",
              )}
            >
              ✓
            </span>
          </button>
          <button
            type="button"
            disabled={startingId !== null}
            onClick={() => {
              const p = storyPlace;
              setStoryPlace(null);
              if (p) void startTicket(p, wantsStory);
            }}
            className="bg-pink-gradient shadow-glow flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-50"
          >
            {startingId ? <Loader2 className="size-4 animate-spin" /> : null}
            Open my ticket
          </button>
        </div>
      </LocalSheet>
    </div>
  );
}

// The four steps — a RAIL, not a card (MESITA-826): numbered, connected by
// hairlines, instruction-weight. Pato's wording verbatim.
const PITCH_STEPS = [
  { icon: MapPin, label: "Pick place" },
  { icon: Star, label: "Post review" },
  { icon: QrCode, label: "Show QR" },
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
              className="bg-border mt-5 h-px w-3 shrink-0 sm:w-6"
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

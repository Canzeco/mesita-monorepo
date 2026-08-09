"use client";

// TicketWizard — the 2-step generation ceremony (plan ticket-flow-20260809,
// D5–D11). Step 1 "Pick reward": the guest's rate as a big live number +
// one chip per reachable action; the CTA creates the ticket (the create-time
// boundary — the choice can't change after). Step 2 "Do it": the chosen
// action's proof, softened ("Order first…") with a visible park exit.
// There is NO QR here (MESITA-857): every path lands on THE TICKET via
// ticketPath(id)?born=1, which plays the one-time pass entrance.
//
// Hosted as a LocalSheet state overlay (overlay standard): both steps are
// transient UI on the Rewards tab — pre-create there is nothing to route to,
// post-create the routeable object is THE TICKET itself, so a routed wizard
// page would just be a second home for ticket state. (D5's navigation
// contract is what matters and is fully honored; the plan's SlideOverShell
// wording assumed 4 pages — decision: LocalSheet, 2026-08-09.)
//
// Zero-strategy places never open this (D9) — RewardsClient creates directly
// with chosenReward "base" and navigates.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ExternalLink,
  Instagram,
  Loader2,
  Star,
  UtensilsCrossed,
} from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { BigRateLockup } from "@/components/consumer/rewards/BigRateLockup";
import { RewardChip } from "@/components/consumer/rewards/RewardChip";
import { googleMapsSearchUrl } from "@/components/consumer/rewards/GoogleReviewSheet";
import { instagramOpenUrl } from "@/components/consumer/rewards/InstagramStorySheet";
import { EFError } from "@/lib/api/_invoke";
import {
  ACTIVE_TICKET_STATUSES,
  apiCreateTicket,
  apiSubmitReview,
  apiSubmitStory,
  type ChosenReward,
  type ConsumerTicketRow,
} from "@/lib/api/tickets";
import type { Place } from "@/lib/api/places";
import { ticketPath } from "@/lib/consumer-route-contract";
import { useConsumerClass } from "@/lib/class-context";
import { strategyForPlaceRow } from "@/lib/promo-rates";
import { baseRateForClass, rateForSegment } from "@/lib/reward-segments";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

/** THE TICKET path with the one-time entrance flag (stripped after play). */
export function bornTicketPath(id: string): string {
  return `${ticketPath(id)}?born=1`;
}

type Step = "pick" | "do";

export function TicketWizard({
  place,
  activeTickets,
  onClose,
  onCreated,
}: {
  /** Open while non-null. Parent guarantees partner + non-zero strategy. */
  place: Place | null;
  /** Parent's polled rows — mid-wizard cancel detection ejects to THE TICKET. */
  activeTickets: ConsumerTicketRow[];
  onClose: () => void;
  /** Fired right after a successful create so the parent can refresh. */
  onCreated: () => void;
}) {
  const supabase = useBrowserSupabase();
  const router = useRouter();
  const { key: classKey, handle } = useConsumerClass();
  const igConnected = Boolean(handle?.trim());

  const [step, setStep] = useState<Step>("pick");
  // Review out-rates story on every strategy, so it is the default
  // "highest-rate reachable action" selection (Pass 4 anatomy).
  const [chosen, setChosen] = useState<ChosenReward>("review");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Reset when a different place opens so a reopened wizard never carries
  // stale step/choice state.
  const placeId = place?.id ?? null;
  const prevPlaceRef = useRef<string | null>(placeId);
  useEffect(() => {
    if (placeId === prevPlaceRef.current || placeId === null) {
      prevPlaceRef.current = placeId;
      return;
    }
    prevPlaceRef.current = placeId;
    const raf = requestAnimationFrame(() => {
      setStep("pick");
      setChosen("review");
      setTicketId(null);
      setCreateError(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [placeId]);

  const go = useCallback(
    (id: string) => {
      router.push(bornTicketPath(id), { scroll: false });
    },
    [router],
  );

  // Ticket cancelled/closed from elsewhere mid-"Do it" — eject to THE
  // TICKET, which renders the terminal state honestly.
  useEffect(() => {
    if (step !== "do" || !ticketId) return;
    const row = activeTickets.find((t) => t.id === ticketId);
    if (row && !ACTIVE_TICKET_STATUSES.has(row.status)) go(ticketId);
  }, [step, ticketId, activeTickets, go]);

  const create = useCallback(async () => {
    if (!place) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await apiCreateTicket(supabase, place.id, chosen);
      onCreated();
      setTicketId(res.ticket.id);
      if (chosen === "base") {
        go(res.ticket.id);
        return;
      }
      setStep("do");
    } catch (err) {
      if (err instanceof EFError && err.code === "already_open") {
        const fromBody = err.body?.ticketId;
        if (typeof fromBody === "string") {
          go(fromBody);
          return;
        }
      }
      setCreateError(
        err instanceof Error ? err.message : "Couldn't start your ticket.",
      );
    } finally {
      setCreating(false);
    }
  }, [place, supabase, chosen, onCreated, go]);

  const confirmProof = useCallback(async () => {
    if (!ticketId) return;
    if (chosen === "story") await apiSubmitStory(supabase, ticketId);
    else await apiSubmitReview(supabase, ticketId);
  }, [supabase, ticketId, chosen]);

  const park = useCallback(() => {
    if (ticketId) go(ticketId);
  }, [ticketId, go]);

  const close = useCallback(() => {
    // Pick step: nothing exists yet — plain dismiss. Do step: the ticket is
    // real — park on THE TICKET, never silently cancel (D5).
    if (step === "do" && ticketId) {
      go(ticketId);
      return;
    }
    onClose();
  }, [step, ticketId, go, onClose]);

  const strategy = place ? strategyForPlaceRow(place) : "zero";
  const base = baseRateForClass(classKey, strategy);
  const storyRate = rateForSegment("story", classKey, strategy);
  const reviewRate = rateForSegment("review", classKey, strategy);
  const shownRate =
    chosen === "review" ? reviewRate : chosen === "story" ? storyRate : base;
  const classLabel =
    classKey.charAt(0).toUpperCase() + classKey.slice(1);
  const suffix =
    chosen === "review"
      ? "— with a Google review"
      : chosen === "story"
        ? "— with a tagged story"
        : `— your ${classLabel} base, no task`;
  const ctaLabel =
    chosen === "review"
      ? `Do the review → unlock ${reviewRate}%`
      : chosen === "story"
        ? `Post a story → unlock ${storyRate}%`
        : `Open my ticket at ${base}%`;

  return (
    <LocalSheet
      open={place !== null}
      onClose={close}
      ariaLabel={place ? `Get your ticket at ${place.name}` : "Get your ticket"}
    >
      {place === null ? null : step === "pick" ? (
        <div className="flex flex-col gap-3.5 px-5 pt-3 pb-8">
          <StepRail step={1} />
          <BigRateLockup
            caption={`Your discount at ${place.name}`}
            percent={shownRate}
            suffix={suffix}
          />
          <div className="flex flex-col gap-2">
            <RewardChip
              label="Just my base"
              percent={base}
              selected={chosen === "base"}
              onSelect={() => setChosen("base")}
            />
            <RewardChip
              icon={<Instagram className="size-4" />}
              label="Post a tagged story"
              subLabel={igConnected ? undefined : "+ Connect Instagram"}
              percent={storyRate}
              selected={chosen === "story"}
              disabled={!igConnected}
              onSelect={() => setChosen("story")}
            />
            <RewardChip
              icon={<Star className="size-4" />}
              label="Leave a Google review"
              percent={reviewRate}
              selected={chosen === "review"}
              onSelect={() => setChosen("review")}
            />
          </div>
          <p className="text-muted-foreground/80 text-center text-[10.5px] leading-snug">
            One action, one discount — you always keep your single best. First
            time here? Your Welcome rate may apply — it shows on your pass.
          </p>
          {createError ? (
            <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-[12px]">
              {createError}
            </p>
          ) : null}
          <button
            type="button"
            disabled={creating}
            onClick={() => void create()}
            className="bg-pink-gradient shadow-glow flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-bold text-white transition active:scale-[0.99] disabled:opacity-50"
          >
            {creating ? <Loader2 className="size-4 animate-spin" /> : null}
            {creating ? "Opening your ticket…" : ctaLabel}
          </button>
        </div>
      ) : (
        <DoItStep
          placeName={place.name}
          placeAddress={place.address}
          isReview={chosen !== "story"}
          rate={shownRate}
          onConfirm={confirmProof}
          onConfirmed={park}
          onPark={park}
        />
      )}
    </LocalSheet>
  );
}

function StepRail({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-[9px] font-extrabold tracking-[0.1em] uppercase">
        Step {step} · 2
      </span>
      <span className="bg-primary h-1 flex-1 rounded-full" />
      <span
        className={cn(
          "h-1 flex-1 rounded-full",
          step === 2 ? "bg-primary" : "bg-border",
        )}
      />
    </div>
  );
}

// Step 2 — one job: the chosen action's proof. Softened beat (D8): order
// first, park exit, honest framing. Proofs self-attest (MESITA-849): confirm
// lands self_verified, so THE TICKET's QR is scannable on arrival.
function DoItStep({
  placeName,
  placeAddress,
  isReview,
  rate,
  onConfirm,
  onConfirmed,
  onPark,
}: {
  placeName: string;
  placeAddress: string | null;
  isReview: boolean;
  rate: number;
  onConfirm: () => Promise<void>;
  onConfirmed: () => void;
  onPark: () => void;
}) {
  const [phase, setPhase] = useState<
    "idle" | "opening" | "confirming" | "success"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const openTarget = useCallback(() => {
    setPhase("opening");
    window.open(
      isReview
        ? googleMapsSearchUrl(placeName, placeAddress)
        : instagramOpenUrl(),
      "_blank",
      "noopener,noreferrer",
    );
    window.setTimeout(() => setPhase("idle"), 600);
  }, [isReview, placeName, placeAddress]);

  const confirm = useCallback(async () => {
    setPhase("confirming");
    setError(null);
    try {
      await onConfirm();
      setPhase("success");
      window.setTimeout(() => onConfirmed(), 400);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't confirm that just yet.",
      );
      setPhase("idle");
    }
  }, [onConfirm, onConfirmed]);

  return (
    <div className="flex flex-col gap-3 px-5 pt-3 pb-8">
      <StepRail step={2} />
      <BigRateLockup
        percent={rate}
        suffix={isReview ? "unlocks with your review" : "unlocks with your story"}
        size="recap"
      />
      <p className="rounded-xl bg-amber-500/12 px-3 py-2 text-center text-[11.5px] leading-snug font-bold text-amber-800">
        <UtensilsCrossed className="mr-1 inline size-3.5 align-[-2px]" />
        Order first — do this while your food comes.
      </p>
      <div className="surface-card rounded-2xl px-4 py-4 text-center">
        <span className="bg-secondary/10 text-secondary mx-auto grid size-11 place-items-center rounded-xl">
          {isReview ? (
            <Star className="size-5" />
          ) : (
            <Instagram className="size-5" />
          )}
        </span>
        <p className="text-foreground mt-2 text-[14.5px] font-extrabold tracking-tight">
          {isReview ? "Leave your Google review" : "Post your tagged story"}
        </p>
        <p className="text-muted-foreground mt-1 text-[12px] leading-snug">
          {isReview
            ? "Rate your visits here — you can edit it later."
            : `Tag ${placeName} in your story, then confirm below.`}
        </p>
      </div>
      <button
        type="button"
        onClick={openTarget}
        disabled={phase === "confirming"}
        className="bg-pink-gradient shadow-glow flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-bold text-white transition active:scale-[0.99] disabled:opacity-50"
      >
        {phase === "opening" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ExternalLink className="size-4" />
        )}
        {isReview ? "Open Google" : "Open Instagram"}
      </button>
      <button
        type="button"
        onClick={() => void confirm()}
        disabled={phase === "confirming" || phase === "opening"}
        className="border-border bg-card text-foreground flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border text-[14px] font-bold transition active:scale-[0.99] disabled:opacity-50"
      >
        {phase === "confirming" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : phase === "success" ? (
          <Check className="size-4 text-emerald-600" strokeWidth={3} />
        ) : null}
        {phase === "confirming"
          ? "Confirming…"
          : phase === "success"
            ? "Done — opening your pass"
            : "I posted it"}
      </button>
      {error ? (
        <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-[12px]">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onPark}
        className="text-muted-foreground hover:text-foreground mx-auto flex min-h-11 items-center text-[12.5px] font-semibold transition"
      >
        I&apos;ll finish this in a bit
      </button>
    </div>
  );
}

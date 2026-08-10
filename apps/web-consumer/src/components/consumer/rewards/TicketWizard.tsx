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
  MapPin,
  QrCode,
  Sparkles,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { BigRateLockup } from "@/components/consumer/rewards/BigRateLockup";
import { RewardChip } from "@/components/consumer/rewards/RewardChip";
import { googleMapsSearchUrl } from "@/components/consumer/rewards/GoogleReviewSheet";
import { instagramOpenUrl } from "@/components/consumer/rewards/InstagramStorySheet";
import { EFError } from "@/lib/api/_invoke";
import {
  ACTIVE_TICKET_STATUSES,
  apiCreateTicket,
  apiGetRewardQuote,
  apiSubmitReview,
  apiSubmitStory,
  type ChosenReward,
  type ConsumerTicketRow,
  type RewardQuote,
} from "@/lib/api/tickets";
import type { Place } from "@/lib/api/places";
import { ticketPath } from "@/lib/consumer-route-contract";
import { useConsumerClass } from "@/lib/class-context";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

/** THE TICKET path with the one-time entrance flag (stripped after play). */
export function bornTicketPath(id: string): string {
  return `${ticketPath(id)}?born=1`;
}

// One modal, every step. The sheet is a FIXED height and only its body
// scrolls, because a sheet that resizes per step reads as a different modal
// each time — which is exactly what made this flow feel like three products
// stitched together (page rail → wizard sheet → full-page pass route).
type Step = "pick" | "do" | "pass";

const STEP_INDEX: Record<Step, number> = { pick: 2, do: 3, pass: 4 };

// A FIXED height is the whole point. Percentage rather than dvh because the
// panel sits inside the app frame and already carries max-h-[85%] of that same
// box, so a viewport unit would fight it.
const SHEET_HEIGHT = "h-[75%]";

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
  // Captured at create so the QR can render in THIS sheet instead of sending
  // the guest to a different-looking page mid-flow.
  const [checkUrl, setCheckUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // The engine's own numbers (MESITA-992 v10). Null until they land — we show a
  // spinner rather than the static ladder, because quoting a rate the bill
  // won't honor is the bug this replaced.
  //
  // Both are STAMPED WITH THE PLACE they describe and read back through a
  // match, instead of being cleared in the effect. That keeps the fetch out of
  // the set-state-in-effect trap and, more importantly, makes it impossible to
  // show place A's rate for one frame after the sheet reopens on place B.
  const [quoteRes, setQuoteRes] = useState<{
    placeId: string;
    quote: RewardQuote;
  } | null>(null);
  const [quoteErr, setQuoteErr] = useState<{
    placeId: string;
    message: string;
  } | null>(null);

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
      setCheckUrl(null);
      setCreateError(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [placeId]);

  // Pull the guest's real breakdown for THIS place every time the sheet opens
  // on a new one. Deliberately not cached across places: base, Welcome and the
  // story override all vary by place strategy and by whether they've been here.
  useEffect(() => {
    if (placeId === null) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiGetRewardQuote(supabase, placeId);
        if (!cancelled) setQuoteRes({ placeId, quote: res.quote });
      } catch (err) {
        if (cancelled) return;
        setQuoteErr({
          placeId,
          message:
            err instanceof Error ? err.message : "Couldn't load your rate.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [placeId, supabase]);

  // Only this place's answer counts — anything older reads as "still loading".
  const quote = quoteRes?.placeId === placeId ? quoteRes.quote : null;
  const quoteError = quoteErr?.placeId === placeId ? quoteErr.message : null;

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
      setCheckUrl(res.checkUrl);
      // Stay in this sheet either way — "base" has no task, so it goes
      // straight to the QR.
      setStep(chosen === "base" ? "pass" : "do");
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

  // "I'll finish this in a bit" and a finished proof both land on the QR step
  // in THIS sheet. The ticket is already real by then, so there is nothing to
  // navigate to — the pass is right here.
  const toPass = useCallback(() => setStep("pass"), []);

  const close = useCallback(() => {
    // The ticket is real from the "do" step onward, and it stays open and
    // visible under Pending — closing the sheet never cancels it (D5). The
    // full-page pass remains its permanent home for deep links.
    onClose();
  }, [onClose]);

  // Every number below comes from the ENGINE (v10 additive), never from the
  // static program ladder — that table is program education and stopped
  // matching the bill when MESITA-992 shipped.
  //
  // Base and Welcome are AUTOMATIC: Welcome is a state of the visit, not a task
  // the guest picks. Together they are the floor the guest already has before
  // choosing anything, and each task stacks on top of that floor.
  const additive = quote?.additive ?? false;
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const welcomeBonus = quote?.bonuses.welcome ?? 0;
  const floor = quote
    ? additive
      ? clamp(quote.base + welcomeBonus)
      : quote.base
    : 0;
  // A legacy best-of engine pays the single best rung, so stacking there would
  // over-promise — the one direction a discount quote must never err.
  const withBonus = (bonus: number) =>
    !quote
      ? 0
      : additive
        ? clamp(floor + bonus)
        : clamp(Math.max(floor, bonus));
  const base = floor;
  const storyRate = withBonus(quote?.bonuses.story ?? 0);
  const reviewRate = withBonus(quote?.bonuses.google ?? 0);
  const shownRate =
    chosen === "review" ? reviewRate : chosen === "story" ? storyRate : base;
  const classLabel =
    classKey.charAt(0).toUpperCase() + classKey.slice(1);
  const welcomeOn = additive && welcomeBonus > 0;
  // "+N% on top" only means something when the engine actually stacks, so it
  // stays off on the legacy best-of path.
  const deltaLabel = (bonus: number) =>
    additive && bonus > 0 ? `+${bonus}% on top` : undefined;
  const suffix =
    chosen === "review"
      ? "— with a Google review"
      : chosen === "story"
        ? "— with a tagged story"
        : welcomeOn
          ? `— your ${classLabel} base + Welcome visit`
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
      panelClassName={SHEET_HEIGHT}
    >
      {place === null ? null : (
        <div className="flex h-full flex-col">
          {/* Persistent chrome. The rail never unmounts and the sheet never
              changes height, so moving between steps reads as ONE object
              rather than a new modal each time. */}
          <div className="border-border/60 shrink-0 border-b px-4 pt-1 pb-2.5">
            <JourneyRail current={STEP_INDEX[step]} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {step === "pick" ? (
        <div className="flex flex-col gap-3.5 px-5 pt-3 pb-6">
          {quote === null ? (
            <QuoteLoading error={quoteError} />
          ) : (
            <>
              <BigRateLockup
                caption={`Your discount at ${place.name}`}
                percent={shownRate}
                suffix={suffix}
              />
              {additive ? (
                <IncludedStrip
                  classLabel={classLabel}
                  base={quote.base}
                  welcome={welcomeBonus}
                />
              ) : null}
              <div className="flex flex-col gap-2">
                <RewardChip
                  label={welcomeOn ? "Base + Welcome — no task" : "Just my base"}
                  percent={base}
                  selected={chosen === "base"}
                  onSelect={() => setChosen("base")}
                />
                <RewardChip
                  icon={<Instagram className="size-4" />}
                  label="Post a tagged story"
                  subLabel={
                    !igConnected
                      ? "+ Connect Instagram"
                      : !quote.storyEligible
                        ? "Not offered here"
                        : deltaLabel(quote.bonuses.story)
                  }
                  percent={storyRate}
                  selected={chosen === "story"}
                  disabled={!quote.storyEligible}
                  onSelect={() => setChosen("story")}
                />
                <RewardChip
                  icon={<Star className="size-4" />}
                  label="Leave a Google review"
                  subLabel={deltaLabel(quote.bonuses.google)}
                  percent={reviewRate}
                  selected={chosen === "review"}
                  onSelect={() => setChosen("review")}
                />
              </div>
              <p className="text-muted-foreground/80 text-center text-[10.5px] leading-snug">
                {additive
                  ? "Your base and Welcome are already counted above — a task adds on top of them."
                  : "One action, one discount — you always keep your single best."}
              </p>
            </>
          )}
          {createError ? (
            <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-[12px]">
              {createError}
            </p>
          ) : null}
          <button
            type="button"
            disabled={creating || quote === null}
            onClick={() => void create()}
            className="bg-pink-gradient shadow-glow flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-bold text-white transition active:scale-[0.99] disabled:opacity-50"
          >
            {creating ? <Loader2 className="size-4 animate-spin" /> : null}
            {creating ? "Opening your ticket…" : ctaLabel}
          </button>
        </div>
      ) : step === "do" ? (
        <DoItStep
          placeName={place.name}
          placeAddress={place.address}
          isReview={chosen !== "story"}
          rate={shownRate}
          onConfirm={confirmProof}
          onConfirmed={toPass}
          onPark={toPass}
        />
      ) : (
        <PassStep
          placeName={place.name}
          percent={shownRate}
          checkUrl={checkUrl}
          ticketId={ticketId}
          onOpenFullPass={() => {
            if (ticketId) go(ticketId);
          }}
        />
      )}
          </div>
        </div>
      )}
    </LocalSheet>
  );
}

// What the guest already has before choosing anything. Welcome used to live in
// a footnote ("may apply — it shows on your pass"), which buried a real +N% at
// the exact moment they decide; at a conservative place that footnote was
// hiding half the offer. It is automatic money, so it reads as already-banked
// rather than as another option to weigh.
function IncludedStrip({
  classLabel,
  base,
  welcome,
}: {
  classLabel: string;
  base: number;
  welcome: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <IncludedPill label={`${classLabel} base`} percent={base} />
      {welcome > 0 ? (
        <IncludedPill label="Welcome visit" percent={welcome} accent />
      ) : null}
    </div>
  );
}

function IncludedPill({
  label,
  percent,
  accent = false,
}: {
  label: string;
  percent: number;
  accent?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold",
        accent
          ? "border-secondary/25 bg-secondary/10 text-secondary"
          : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      {accent ? <Sparkles className="size-3" /> : <Check className="size-3" />}
      {label}
      <span className="tabular-nums">+{percent}%</span>
    </span>
  );
}

// The rate is the whole point of this screen, so it never renders a guessed
// number while the engine's answer is in flight.
function QuoteLoading({ error }: { error: string | null }) {
  if (error) {
    return (
      <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-center text-[12px]">
        {error}
      </p>
    );
  }
  return (
    <div className="flex min-h-[128px] flex-col items-center justify-center gap-2">
      <Loader2 className="text-primary size-5 animate-spin" />
      <p className="text-muted-foreground text-[12px] font-semibold">
        Checking your rate here…
      </p>
    </div>
  );
}

// The journey rail, now INSIDE the sheet and reflecting real progress. It used
// to sit on the Rewards page as a static four-step pitch while the sheet
// separately claimed "Step 1 · 2" — two different step counts for one flow,
// in two different containers.
const JOURNEY = [
  { n: 1, label: "Place", icon: MapPin },
  { n: 2, label: "Reward", icon: Sparkles },
  { n: 3, label: "Do it", icon: Star },
  { n: 4, label: "Show QR", icon: QrCode },
] as const;

function JourneyRail({ current }: { current: number }) {
  return (
    <ol className="relative flex items-start">
      <span
        aria-hidden="true"
        className="bg-border absolute top-[13px] right-[12.5%] left-[12.5%] h-px"
      />
      {JOURNEY.map(({ n, label, icon: Icon }) => {
        const done = n < current;
        const now = n === current;
        return (
          <li
            key={n}
            className="relative z-[1] flex w-0 flex-1 flex-col items-center gap-1"
            aria-current={now ? "step" : undefined}
          >
            <span
              className={cn(
                "grid size-[26px] place-items-center rounded-full border transition",
                now
                  ? "bg-pink-gradient border-transparent text-white"
                  : done
                    ? "border-secondary/30 bg-secondary/10 text-secondary"
                    : "border-border bg-background text-muted-foreground/50",
              )}
            >
              {done ? (
                <Check className="size-3.5" strokeWidth={3} />
              ) : (
                <Icon className="size-3.5" strokeWidth={2.25} />
              )}
            </span>
            <span
              className={cn(
                "text-center text-[9.5px] leading-tight font-semibold",
                now ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// Step 4, in the SAME sheet. The full-page pass stays the ticket's permanent
// home for deep links and notification targets (D4) — this shows the same
// object without throwing the guest out of the flow to reach it.
function PassStep({
  placeName,
  percent,
  checkUrl,
  ticketId,
  onOpenFullPass,
}: {
  placeName: string;
  percent: number;
  checkUrl: string | null;
  ticketId: string | null;
  onOpenFullPass: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 px-5 pt-4 pb-6">
      <p className="text-muted-foreground text-center text-[12px] font-semibold">
        Your ticket at {placeName}
      </p>
      <div className="bg-pink-gradient shadow-glow rounded-3xl px-5 py-5 text-center text-white">
        <p className="font-display text-[40px] leading-none font-extrabold tracking-tight">
          {percent}% off
        </p>
        <span className="mx-auto mt-4 block w-fit rounded-2xl bg-white p-3">
          {checkUrl ? (
            <QRCodeSVG value={checkUrl} size={164} />
          ) : (
            <span className="bg-muted block size-[164px] animate-pulse rounded-lg" />
          )}
        </span>
        <p className="mt-3 text-[12.5px] leading-snug font-semibold text-white/90">
          Show this QR — staff scan it to start your visit.
        </p>
      </div>
      <button
        type="button"
        onClick={onOpenFullPass}
        disabled={!ticketId}
        className="border-border bg-card text-foreground flex min-h-11 w-full items-center justify-center rounded-2xl border text-[13px] font-bold transition active:scale-[0.99] disabled:opacity-50"
      >
        Open full pass
      </button>
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
    <div className="flex flex-col gap-3 px-5 pt-3 pb-6">
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

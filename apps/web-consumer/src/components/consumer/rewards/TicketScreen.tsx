"use client";

// THE TICKET (MESITA-857 · 908 · 886 · plan ticket-flow-20260809) — the whole
// ticket lifecycle in one 80%-tall bottom panel, organised as a FOUR-STEP
// MODAL (Pato, 2026-08-11: "so you open a modal — the modal has multiple
// steps: 1. select rewards/tasks, 2. do tasks, 3. show qr, 4. results page"):
//
//   chrome (back · place · status) → rail → step body → footer
//   1 Reward  · pick the rung, with the engine's live numbers
//   2 Do it   · the chosen proof, self-attested
//   3 Show QR · THE PASS — guest + rate lockup + QR + stub
//   4 Results · what the visit paid, the ★, the bill capture
//
// These steps used to live in TWO containers: the TicketWizard sheet on
// /rewards owned "pick reward" and "do it", this route owned the QR and the
// results. One flow, two shapes, two step counts. The wizard is DELETED —
// /rewards is now a bare list of places, tapping one creates the ticket and
// lands here, and everything after "which place?" happens in this panel.
//
// THE RATE IS NO LONGER A CREATE-TIME BOUNDARY. The ticket is created at
// "base", and consumer-web-submit-review / -submit-story accept any OPEN
// ticket — they never required a 'pending' status — with
// _shared/ticket-reprice bumping the rate upward when a task lands late. So
// the QR is live from the first frame and a task is pure upside. That also
// kills the dead end the old boundary created: a guest who didn't want to
// leave a review was stuck holding a QR locked behind one.
//
// The step-1 pick is therefore a LOCAL preference (useStoredString) until a
// proof lands — nothing on a ticket records "intends to review". Only the
// ticket's own status can lock the QR, so a pick can never gate anything;
// tickets created before this change (review/story 'pending') keep their lock
// and land straight on step 2.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Flag,
  Instagram,
  Loader2,
  Lock,
  PartyPopper,
  Sparkles,
  Star,
  Store,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";

import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  TicketReviewForm,
  type TicketReviewDraft,
} from "@/components/consumer/TicketReviewForm";
import { BigRateLockup } from "@/components/consumer/rewards/BigRateLockup";
import { JourneyRail } from "@/components/consumer/rewards/JourneyRail";
import { RewardChip } from "@/components/consumer/rewards/RewardChip";
import { TaskProof, type TaskKind } from "@/components/consumer/rewards/TaskProof";
import { submitTicketReview } from "@/lib/api/pay";
import { formatCurrency } from "@/lib/api/profile";
import {
  ACTIVE_TICKET_STATUSES,
  REPORT_REASONS,
  apiCancelTicket,
  apiReportTicket,
  apiSubmitReview,
  apiSubmitStory,
  apiGetRewardQuote,
  apiSubmitTicketTotal,
  checkUrlForCode,
  type ChosenReward,
  type ConsumerTicketRow,
  type ReportReason,
  type RewardQuote,
} from "@/lib/api/tickets";
import { CONSUMER_ROUTES, ticketPath } from "@/lib/consumer-route-contract";
import { useConsumerClass } from "@/lib/class-context";
import { classProperLabel } from "@/lib/consumer-data";
import { useStoredString } from "@/lib/local-store";
import { strategyForPlaceRow } from "@/lib/promo-rates";
import { useConsumerTickets } from "@/lib/hooks/useConsumerTickets";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

function passGradient(key: string): string {
  if (key === "aura")
    return "bg-[linear-gradient(150deg,#ff7a45_0%,#ffb03d_55%,#e0982e_100%)]";
  if (key === "influencer")
    return "bg-[linear-gradient(150deg,#ff7a45_0%,#4aa8ff_55%,#2f7fd6_100%)]";
  if (key === "premium")
    return "bg-[linear-gradient(150deg,#ff7a45_0%,#ff3d73_45%,#a13cf0_100%)]";
  return "bg-[linear-gradient(150deg,#ff7a45_0%,#ff4d6d_55%,#ff2d78_100%)]";
}

function statusLine(t: ConsumerTicketRow): string {
  switch (t.status) {
    case "open":
      return "Show this QR — staff scan it to start your visit.";
    case "awaiting_payment_confirm":
      // MESITA-886: bill is optional — never promise a table total.
      return "Scanned — staff closes your visit at the table.";
    default:
      return t.status;
  }
}

type TaskState = "todo" | "busy" | "checking" | "done" | "rejected";

function taskStateFor(v: string | null | undefined): TaskState {
  if (v == null || v === "not_required" || v === "pending") return "todo";
  if (v === "submitted") return "checking";
  if (v === "ai_rejected" || v === "staff_rejected") return "rejected";
  return "done";
}

/** Where the guest's step-1 pick lives until a proof makes it real. */
function pickStorageKey(ticketId: string): string {
  return `mesita.ticket.reward.${ticketId}`;
}

type Step = 1 | 2 | 3 | 4;
type TaskSheet = "mesita" | "report" | null;

export function TicketScreen({
  userId,
  ticketId,
  guestName = null,
  avatarUrl = null,
}: {
  userId: string;
  ticketId: string;
  guestName?: string | null;
  avatarUrl?: string | null;
}) {
  const supabase = useBrowserSupabase();
  const router = useRouter();
  const tickets = useConsumerTickets(userId);
  const { key: classKey, handle: igHandle } = useConsumerClass();

  const ticket = useMemo(
    () =>
      tickets.active.find((t) => t.id === ticketId) ??
      tickets.history.find((t) => t.id === ticketId) ??
      null,
    [tickets.active, tickets.history, ticketId],
  );

  // The pass quotes the ENGINE's number, not the static v6 ladder (MESITA-1013
  // / 1014). Before this, everything up to the bill showed a best-of rung from
  // reward-segments.ts while the bill paid base + welcome + each earned bonus —
  // so the screen the waiter scans was the one showing the wrong rate.
  //
  // Stamped with the place it describes and read back through a match, so a
  // quote can never be attributed to a different ticket's place.
  const quotePlaceId = ticket?.place?.id ?? null;
  const [quoteRes, setQuoteRes] = useState<{
    placeId: string;
    quote: RewardQuote;
  } | null>(null);
  useEffect(() => {
    if (quotePlaceId === null) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiGetRewardQuote(supabase, quotePlaceId);
        if (!cancelled) setQuoteRes({ placeId: quotePlaceId, quote: res.quote });
      } catch {
        // Non-fatal: the headline stays hidden rather than showing a number
        // the bill won't honor. The billed truth still renders once settled.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quotePlaceId, supabase]);
  const quote = quoteRes?.placeId === quotePlaceId ? quoteRes.quote : null;

  // Step 1's pick. useStoredString keeps the hydration render on the SSR
  // snapshot, so no setState-in-effect and no mismatch.
  const [storedPick, setStoredPick] = useStoredString(
    pickStorageKey(ticketId),
    "",
  );
  // Chip selection while the guest is still deciding — writing straight to the
  // store would advance the derived step out from under the tap.
  const [draftPick, setDraftPick] = useState<ChosenReward | null>(null);
  const [stepChoice, setStepChoice] = useState<Step | null>(null);

  const scanned = ticket?.first_scanned_at != null;
  const [pulse, setPulse] = useState(false);
  const wasScannedRef = useRef(scanned);
  useEffect(() => {
    if (scanned && !wasScannedRef.current) {
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 1400);
      return () => window.clearTimeout(t);
    }
    wasScannedRef.current = scanned;
  }, [scanned]);

  // ?born=1 — the handoff from the place list: play the pass entrance the
  // first time the QR renders, then strip the flag so reloads and
  // back-navigation stay calm.
  const [born, setBorn] = useState(false);
  useEffect(() => {
    if (!window.location.search.includes("born=1")) return;
    const raf = requestAnimationFrame(() => setBorn(true));
    const t = window.setTimeout(() => {
      router.replace(ticketPath(ticketId), { scroll: false });
    }, 700);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [router, ticketId]);

  const [sheet, setSheet] = useState<TaskSheet>(null);
  const openSheet = useCallback((next: TaskSheet) => setSheet(next), []);

  const confirmGoogle = useCallback(async () => {
    await apiSubmitReview(supabase, ticketId);
    await tickets.refresh();
  }, [supabase, ticketId, tickets]);

  const confirmStory = useCallback(async () => {
    await apiSubmitStory(supabase, ticketId);
    await tickets.refresh();
  }, [supabase, ticketId, tickets]);

  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState<TicketReviewDraft>({
    food: 0,
    service: 0,
    ambiance: 0,
    value: 0,
    overall: 0,
    comments: "",
  });
  const submitMesitaReview = useCallback(async () => {
    setReviewBusy(true);
    setReviewError(null);
    try {
      await submitTicketReview(supabase, { ticketId, ...reviewDraft });
      setReviewDone(true);
      setSheet(null);
    } catch (err) {
      setReviewError(
        err instanceof Error ? err.message : "Couldn't save your review.",
      );
    } finally {
      setReviewBusy(false);
    }
  }, [supabase, ticketId, reviewDraft]);

  const [totalDraft, setTotalDraft] = useState("");
  const [totalBusy, setTotalBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const submitTotal = useCallback(async () => {
    const pesos = Number(totalDraft.replace(/[,$\s]/g, ""));
    if (!Number.isFinite(pesos) || pesos <= 0) {
      setActionError("Type the bill total in pesos.");
      return;
    }
    setTotalBusy(true);
    setActionError(null);
    try {
      await apiSubmitTicketTotal(supabase, ticketId, Math.round(pesos * 100));
      await tickets.refresh();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Couldn't save that just yet.",
      );
    } finally {
      setTotalBusy(false);
    }
  }, [supabase, ticketId, tickets, totalDraft]);

  const [reportReason, setReportReason] = useState<ReportReason | null>(null);
  const [reportDetails, setReportDetails] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const submitReport = useCallback(async () => {
    if (!reportReason) return;
    setReportBusy(true);
    setReportError(null);
    try {
      await apiReportTicket(supabase, ticketId, reportReason, reportDetails);
      setReported(true);
      setSheet(null);
    } catch (err) {
      setReportError(
        err instanceof Error ? err.message : "Couldn't send that just yet.",
      );
    } finally {
      setReportBusy(false);
    }
  }, [supabase, ticketId, reportReason, reportDetails]);

  const [cancelling, setCancelling] = useState(false);
  const cancel = useCallback(async () => {
    setCancelling(true);
    try {
      await apiCancelTicket(supabase, ticketId);
      await tickets.refresh();
      router.push(CONSUMER_ROUTES.rewards.root, { scroll: false });
    } catch {
      setCancelling(false);
    }
  }, [supabase, ticketId, tickets, router]);

  if (tickets.status === "loading" && !ticket) {
    return (
      <Shell>
        <div className="flex flex-col gap-2.5">
          <div className="bg-muted h-12 animate-pulse rounded-[18px]" />
          <div className="bg-muted h-72 animate-pulse rounded-[28px]" />
          <div className="bg-muted h-12 animate-pulse rounded-2xl" />
        </div>
      </Shell>
    );
  }

  if (!ticket) {
    return (
      <Shell>
        <div className="surface-card flex flex-col items-center gap-3 rounded-2xl px-6 py-12 text-center">
          <span className="bg-muted text-muted-foreground grid size-12 place-items-center rounded-2xl">
            <XCircle className="size-6" />
          </span>
          <p className="text-foreground text-[15px] font-semibold">
            Ticket not found
          </p>
          <p className="text-muted-foreground max-w-[280px] text-[12.5px] leading-relaxed">
            It may have been cancelled, or it belongs to another account.
          </p>
          <Link
            href={CONSUMER_ROUTES.rewards.root}
            className="bg-pink-gradient shadow-glow mt-1 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white"
          >
            Back to Rewards
          </Link>
        </div>
      </Shell>
    );
  }

  const live = ACTIVE_TICKET_STATUSES.has(ticket.status);
  const closed = !live;
  const saved = ticket.status === "revealed";
  const cancelled = ticket.status === "cancelled";
  const billed = (ticket.total_cents ?? 0) > 0;
  const placeName = ticket.place?.name ?? "Partner place";
  const photo = ticket.place?.photos?.[0] ?? null;
  const category = ticket.place?.category ?? null;

  // Strategy still comes from the place's rate columns: those carry strategy
  // IDENTITY, not price. Keeping it synchronous means the structural gates
  // below (priced venue, QR lock) can't flicker while the quote is in flight.
  const strategy = strategyForPlaceRow(ticket.place);
  const priced = strategy !== "zero";

  // PRICES come from the engine. 0 until the quote lands — the headline is
  // guarded on `> 0`, so a loading pass shows no number rather than a wrong
  // one. Welcome is automatic, so it belongs in the floor, not in a task.
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const additive = quote?.additive ?? false;
  const welcomeBonus = quote?.bonuses.welcome ?? 0;
  const base = !quote ? 0 : additive ? clamp(quote.base + welcomeBonus) : quote.base;
  // A legacy best-of engine pays the single best rung, so stacking there would
  // over-promise — the one direction a discount quote must never err.
  const withBonus = (bonus: number) =>
    !quote ? 0 : additive ? clamp(base + bonus) : clamp(Math.max(base, bonus));
  const storyRate = withBonus(quote?.bonuses.story ?? 0);
  const reviewRate = withBonus(quote?.bonuses.google ?? 0);

  // What the TICKET records beats what the guest merely picked. Only a
  // persisted task can gate the QR (D6, pick-one); a local pick is an
  // intention and gates nothing.
  const storyOnTicket =
    ticket.story_status != null && ticket.story_status !== "not_required";
  const reviewOnTicket =
    ticket.review_status != null && ticket.review_status !== "not_required";
  const persistedTask: TaskKind | null = storyOnTicket
    ? "story"
    : reviewOnTicket
      ? "review"
      : null;
  const persistedState: TaskState | null = persistedTask
    ? taskStateFor(
        persistedTask === "story" ? ticket.story_status : ticket.review_status,
      )
    : null;

  const localPick: ChosenReward | null =
    storedPick === "base" || storedPick === "story" || storedPick === "review"
      ? storedPick
      : null;
  const pick: ChosenReward | null = persistedTask ?? localPick;
  const chosenTask: TaskKind | null =
    pick === "story" || pick === "review" ? pick : null;
  const chosenState: TaskState = persistedState ?? "todo";
  const chosenBonus = !quote
    ? 0
    : chosenTask === "story"
      ? quote.bonuses.story
      : quote.bonuses.google;
  const chosenRate =
    !quote || !chosenTask || !priced ? 0 : withBonus(chosenBonus);

  // The headline number + its honesty clause. Billed truth wins; a rejected
  // proof falls back to the class base (D7); everything else quotes the
  // chosen action, conditionally until done.
  const headlinePercent = billed
    ? (ticket.discount_percent ?? 0)
    : chosenTask && chosenState !== "rejected"
      ? chosenRate
      : base;
  const actionNoun = chosenTask === "story" ? "story" : "review";
  const headlineSuffix = billed
    ? "applied at the table"
    : !priced
      ? ""
      : chosenTask === null
        ? additive && welcomeBonus > 0
          ? `your ${classProperLabel(classKey)} base + Welcome visit`
          : `your ${classProperLabel(classKey)} base — no task needed`
        : chosenState === "done"
          ? `with your ${actionNoun} ✓`
          : chosenState === "rejected"
            ? `${actionNoun} not accepted — your base holds`
            : `unlocks with your ${actionNoun}`;

  // QR gate (MESITA-886, recomputed for pick-one): only a task the TICKET
  // carries gates, only while open and unscanned, only on priced venues.
  // Tickets created at "base" — every ticket made after 2026-08-11 — have no
  // gate at all, which is the point: the QR works before any task.
  const scannable =
    live &&
    Boolean(ticket.check_code) &&
    (ticket.status === "open" || ticket.status === "awaiting_payment_confirm");
  const qrLocked =
    ticket.status === "open" &&
    !scanned &&
    priced &&
    persistedTask !== null &&
    persistedState !== "done";
  const showPassCard = live && (qrLocked || scannable);
  // ★ never gates, never pays — it belongs to the visit, not the unlock
  // (D12): post-scan and completed visits only.
  const showMesitaStar = !cancelled && (scanned || saved);
  // Upside still on the table: the guest is holding a working QR but hasn't
  // done a task that would pay more.
  const upsideLeft =
    live && priced && chosenState !== "done" && Math.max(storyRate, reviewRate) > base;

  const showIgHandle =
    (classKey === "influencer" || storyOnTicket) && Boolean(igHandle);
  const stubCode = ticket.check_code
    ? `#${ticket.check_code.slice(0, 4).toUpperCase()}`
    : "";

  // ── Step machine ───────────────────────────────────────────────────────
  // Where the ticket naturally IS, overridden by wherever the guest tapped.
  // A closed ticket is pinned to Results: there is nothing else left to do.
  const naturalStep: Step = closed
    ? 4
    : !priced || pick === "base"
      ? 3
      : chosenTask === null
        ? 1
        : chosenState === "done"
          ? 3
          : 2;
  let step: Step = closed ? 4 : (stepChoice ?? naturalStep);
  if (step === 2 && chosenTask === null) step = 1;
  if (step === 1 && !priced) step = 3;

  const stepReachable = (n: number): boolean =>
    n === 4 ? closed : n === 1 ? live && priced : n === 2 ? live && chosenTask !== null : live;

  const igConnected = Boolean(igHandle?.trim());
  const selectedPick: ChosenReward = draftPick ?? pick ?? "review";
  const selectedRate =
    selectedPick === "story"
      ? storyRate
      : selectedPick === "review"
        ? reviewRate
        : base;
  const pickLocked = persistedTask !== null;
  const deltaLabel = (bonus: number) =>
    additive && bonus > 0 ? `+${bonus}% on top` : undefined;

  const confirmChosen = chosenTask === "story" ? confirmStory : confirmGoogle;

  const goToStep = (n: number) => {
    setStepChoice(n as Step);
  };

  return (
    <Shell>
      {/* Chrome row — place identity as chrome, not a card stack. */}
      <div className="flex shrink-0 items-center gap-2.5 px-0.5 py-1">
        <button
          type="button"
          onClick={() =>
            router.push(CONSUMER_ROUTES.rewards.root, { scroll: false })
          }
          aria-label="Back to Rewards"
          className="bg-muted text-foreground grid size-8 shrink-0 place-items-center rounded-full transition active:scale-95"
        >
          <ArrowLeft className="size-3.5" />
        </button>
        <div className="relative size-9 shrink-0 overflow-hidden rounded-xl">
          {photo ? (
            <Image src={photo} alt="" fill className="object-cover" />
          ) : (
            <div className="bg-pink-gradient grid h-full w-full place-items-center text-white/80">
              <Store className="size-4" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-[14px] leading-tight font-extrabold tracking-tight">
            {placeName}
          </p>
          {category ? (
            <p className="text-muted-foreground truncate text-[10.5px] capitalize">
              {category.replaceAll("_", " ")}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-widest uppercase",
            saved
              ? "bg-emerald-500/10 text-emerald-700"
              : cancelled
                ? "bg-muted text-muted-foreground"
                : "bg-primary/10 text-primary",
          )}
        >
          {saved ? "Completed" : cancelled ? "Cancelled" : "Live"}
        </span>
      </div>

      {/* The rail — this ticket's real progress, tappable wherever it's
          reachable so changing your mind is one tap, not a back-out. */}
      <div className="border-border shrink-0 border-b pt-1 pb-2.5">
        <JourneyRail
          current={step}
          onSelect={goToStep}
          isReachable={stepReachable}
        />
      </div>

      {/* Step body — the only part that scrolls, so the panel never changes
          shape as you move between steps. */}
      <div className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pt-3">
        {step === 1 ? (
          quote === null ? (
            <QuoteLoading />
          ) : (
            <>
              <BigRateLockup
                caption={`Your discount at ${placeName}`}
                percent={selectedRate}
                suffix={
                  selectedPick === "review"
                    ? "— with a Google review"
                    : selectedPick === "story"
                      ? "— with a tagged story"
                      : additive && welcomeBonus > 0
                        ? `— your ${classProperLabel(classKey)} base + Welcome visit`
                        : `— your ${classProperLabel(classKey)} base, no task`
                }
              />
              {additive ? (
                <IncludedStrip
                  classLabel={classProperLabel(classKey)}
                  base={quote.base}
                  welcome={welcomeBonus}
                />
              ) : null}
              <div className="flex flex-col gap-2">
                <RewardChip
                  label={
                    additive && welcomeBonus > 0
                      ? "Base + Welcome — no task"
                      : "Just my base"
                  }
                  percent={base}
                  selected={selectedPick === "base"}
                  disabled={pickLocked}
                  onSelect={() => setDraftPick("base")}
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
                  selected={selectedPick === "story"}
                  disabled={pickLocked || !quote.storyEligible || !igConnected}
                  onSelect={() => setDraftPick("story")}
                />
                <RewardChip
                  icon={<Star className="size-4" />}
                  label="Leave a Google review"
                  subLabel={deltaLabel(quote.bonuses.google)}
                  percent={reviewRate}
                  selected={selectedPick === "review"}
                  disabled={pickLocked}
                  onSelect={() => setDraftPick("review")}
                />
              </div>
              <p className="text-muted-foreground/80 text-center text-[10.5px] leading-snug">
                {pickLocked
                  ? "This ticket already carries its task — finish it to unlock the higher rate."
                  : additive
                    ? "Your base and Welcome are already counted above — a task adds on top of them. Your QR works either way."
                    : "One action, one discount — you always keep your single best."}
              </p>
            </>
          )
        ) : step === 2 && chosenTask ? (
          <TaskProof
            kind={chosenTask}
            placeName={placeName}
            placeAddress={ticket.place?.address}
            rate={chosenRate}
            rejected={chosenState === "rejected"}
            onConfirm={confirmChosen}
            onDone={() => goToStep(3)}
            onSkip={() => goToStep(3)}
          />
        ) : step === 3 ? (
          <>
            {showPassCard ? (
              <section
                className={cn(
                  "shrink-0 overflow-hidden rounded-[24px] px-4 pt-3.5 pb-3.5 text-white shadow-[0_16px_36px_-20px_rgba(255,77,109,0.55)]",
                  passGradient(classKey),
                  pulse && "animate-verified-pulse",
                  born && "animate-pass-born",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-6 shrink-0 overflow-hidden rounded-full ring-1 ring-white/40">
                      {avatarUrl ? (
                        <Image
                          src={avatarUrl}
                          alt=""
                          width={24}
                          height={24}
                          className="size-6 object-cover"
                        />
                      ) : (
                        <DefaultAvatar className="size-6" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[11.5px] leading-tight font-bold">
                        {guestName ?? "Mesita guest"}
                      </span>
                      {showIgHandle ? (
                        <span className="block truncate text-[9px] leading-tight text-white/80">
                          @{igHandle!.replace(/^@/, "")}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-white/22 px-2 py-0.5 text-[9px] font-extrabold tracking-widest uppercase">
                    {classProperLabel(classKey)}
                  </span>
                </div>

                <div aria-live="polite" className="mt-2 text-center">
                  {priced && headlinePercent > 0 ? (
                    <>
                      <p className="font-display text-[clamp(30px,9vw,38px)] leading-none font-extrabold tracking-tight">
                        {headlinePercent}% off
                      </p>
                      {headlineSuffix ? (
                        <p className="mt-1 text-[11px] leading-snug font-semibold text-white/90">
                          {headlineSuffix}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mx-auto max-w-[30ch] text-[12px] leading-snug font-semibold text-white/90">
                      Your discount is set by the place and applied at the table.
                    </p>
                  )}
                </div>

                {qrLocked ? (
                  <>
                    {/* Locked plate — same footprint as the QR so unlock is a
                        swap. Only pre-2026-08-11 tickets can land here. */}
                    <div className="mx-auto mt-2.5 grid aspect-square w-full max-w-[min(170px,48vw)] place-items-center rounded-2xl border-2 border-dashed border-white/45 bg-white/12">
                      <Lock className="size-8 text-white/90" />
                    </div>
                    <p
                      aria-live="polite"
                      className="mx-auto mt-2 max-w-[34ch] text-center text-[11px] leading-snug text-white/90"
                    >
                      Do your {actionNoun} to unlock your QR.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mx-auto mt-2.5 w-full max-w-[min(170px,48vw)] rounded-2xl bg-white p-2.5 shadow-[0_12px_30px_-12px_rgba(120,20,40,0.5)]">
                      <QRCodeSVG
                        value={checkUrlForCode(ticket.check_code!)}
                        size={170}
                        className="h-auto w-full"
                        bgColor="#ffffff"
                        fgColor="#2b1233"
                        level="M"
                        marginSize={0}
                      />
                    </div>
                    <p
                      aria-live="polite"
                      className="mx-auto mt-2 flex max-w-[34ch] items-center justify-center gap-1.5 text-center text-[11px] leading-snug text-white/90"
                    >
                      {scanned && ticket.status === "open" ? (
                        <>
                          <BadgeCheck className="size-3.5 shrink-0" /> Verified
                          by {placeName}
                        </>
                      ) : (
                        statusLine(ticket)
                      )}
                    </p>
                    {billed ? (
                      <div className="mt-2.5 rounded-xl bg-white/18 px-3 py-2 text-center">
                        <p className="text-[9px] font-bold tracking-[0.14em] uppercase opacity-90">
                          {ticket.discount_percent ?? 0}% off applied
                        </p>
                        <p className="font-display mt-0.5 text-[20px] leading-none font-bold">
                          {formatCurrency(
                            Math.max(
                              0,
                              (ticket.total_cents ?? 0) -
                                (ticket.discount_cents ?? 0),
                            ),
                          )}
                        </p>
                        <p className="mt-0.5 text-[10.5px] opacity-90">
                          to pay at the table
                          {ticket.discount_cents
                            ? ` — you save ${formatCurrency(ticket.discount_cents)}`
                            : ""}
                        </p>
                      </div>
                    ) : null}
                  </>
                )}

                {/* Stub row — perforation + the small print. */}
                <div className="mt-3 border-t-2 border-dashed border-white/35 pt-2">
                  <div className="flex items-center justify-between gap-3 text-[9.5px] font-semibold text-white/90">
                    <span>Ticket {stubCode}</span>
                    <span>
                      {chosenTask
                        ? chosenState === "done"
                          ? `${actionNoun === "story" ? "Story" : "Review"} ✓`
                          : chosenState === "rejected"
                            ? `${actionNoun === "story" ? "Story" : "Review"} not accepted`
                            : `${actionNoun === "story" ? "Story" : "Review"} pending`
                        : "No task — base rate"}
                    </span>
                  </div>
                </div>
              </section>
            ) : null}

            {/* Money still on the table. The QR already works, so this is an
                offer, not a gate — it sends you back to step 2 (or 1 if the
                pick was never made). */}
            {upsideLeft ? (
              <button
                type="button"
                onClick={() => goToStep(chosenTask ? 2 : 1)}
                className="border-border bg-card flex min-h-11 w-full shrink-0 items-center gap-2.5 rounded-2xl border px-3 py-2 text-left transition active:scale-[0.99]"
              >
                <span className="bg-secondary/10 text-secondary grid size-8 shrink-0 place-items-center rounded-lg">
                  {chosenTask === "story" ? (
                    <Instagram className="size-4" />
                  ) : chosenTask === "review" ? (
                    <Star className="size-4" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block text-[13px] leading-tight font-bold">
                    {chosenTask === "story"
                      ? "Post your tagged story"
                      : chosenTask === "review"
                        ? "Leave your Google review"
                        : "Earn a bigger discount"}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-[11px] leading-snug">
                    {chosenState === "rejected"
                      ? `Not accepted — you still keep your ${base}%. Try again?`
                      : "Order first — do this while your food comes."}
                  </span>
                </span>
                <span className="font-display text-foreground/80 shrink-0 text-[15px] leading-none font-extrabold tabular-nums">
                  {Math.max(storyRate, reviewRate, chosenRate)}%
                </span>
              </button>
            ) : null}

            {showMesitaStar ? (
              <RateVisitRow
                done={reviewDone}
                onOpen={() => {
                  setReviewError(null);
                  openSheet("mesita");
                }}
              />
            ) : null}
          </>
        ) : (
          /* Step 4 — Results */
          <>
            <section
              className={cn(
                "shrink-0 overflow-hidden rounded-[24px] px-4 pt-3.5 pb-4 text-white shadow-[0_16px_36px_-20px_rgba(255,77,109,0.55)]",
                passGradient(classKey),
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[9px] font-bold tracking-[0.14em] text-white/80 uppercase">
                  Mesita Pass
                </p>
                <span className="rounded-full bg-white/22 px-2 py-0.5 text-[9px] font-extrabold tracking-widest uppercase">
                  {classProperLabel(classKey)}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1.5 py-5 text-center">
                {saved ? (
                  <>
                    <PartyPopper className="size-7" />
                    <p className="text-[15px] font-extrabold">
                      {ticket.discount_cents
                        ? `You saved ${formatCurrency(ticket.discount_cents)}`
                        : "Visit complete"}
                    </p>
                    <p className="text-[11.5px] text-white/85">
                      {ticket.discount_percent
                        ? `${ticket.discount_percent}% off at ${placeName}`
                        : placeName}
                    </p>
                    {!billed ? (
                      <div className="mt-2.5 w-full max-w-[260px] rounded-xl bg-white/18 p-2.5 text-left">
                        <p className="text-[10px] font-bold tracking-wide uppercase opacity-90">
                          How much was the bill?
                        </p>
                        <p className="mt-0.5 text-[10px] leading-snug opacity-80">
                          Optional — it records what you saved.
                        </p>
                        <div className="mt-2 flex gap-1.5">
                          <input
                            inputMode="decimal"
                            placeholder="850"
                            value={totalDraft}
                            onChange={(e) => setTotalDraft(e.target.value)}
                            className="h-9 w-full min-w-0 rounded-lg border-0 bg-white/90 px-2.5 text-[13px] font-semibold text-neutral-900 outline-none placeholder:text-neutral-400"
                          />
                          <button
                            type="button"
                            disabled={totalBusy}
                            onClick={() => void submitTotal()}
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/90 text-neutral-900 transition active:scale-95 disabled:opacity-60"
                            aria-label="Save bill total"
                          >
                            {totalBusy ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Check className="size-4" strokeWidth={3} />
                            )}
                          </button>
                        </div>
                        {actionError ? (
                          <p className="mt-1.5 text-[10px] font-semibold text-white/90">
                            {actionError}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : cancelled ? (
                  <>
                    <p className="text-[15px] font-extrabold">Ticket cancelled</p>
                    <p className="text-[11.5px] text-white/85">
                      Start a fresh one from Rewards whenever you&apos;re back.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[15px] font-extrabold">Visit in progress</p>
                    <p className="text-[11.5px] text-white/85">
                      Your result lands here once {placeName} closes the visit.
                    </p>
                  </>
                )}
              </div>
            </section>

            {showMesitaStar ? (
              <RateVisitRow
                done={reviewDone}
                onOpen={() => {
                  setReviewError(null);
                  openSheet("mesita");
                }}
              />
            ) : null}
          </>
        )}
      </div>

      {/* Footer — the step's one commitment, then housekeeping. Pinned so a
          long chip list can never push the decision off-screen. */}
      <div className="shrink-0 pt-2.5">
        {step === 1 ? (
          <button
            type="button"
            disabled={quote === null}
            onClick={() => {
              if (!pickLocked) setStoredPick(selectedPick);
              goToStep(selectedPick === "base" ? 3 : 2);
            }}
            className="bg-pink-gradient shadow-glow flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-bold text-white transition active:scale-[0.99] disabled:opacity-50"
          >
            {selectedPick === "review"
              ? `Do the review → unlock ${reviewRate}%`
              : selectedPick === "story"
                ? `Post a story → unlock ${storyRate}%`
                : `Show my QR at ${base}%`}
          </button>
        ) : null}

        <div className="flex flex-col items-center gap-1 pt-1.5">
          {ticket.status === "open" ? (
            <button
              type="button"
              onClick={() => void cancel()}
              disabled={cancelling}
              className="text-muted-foreground hover:text-foreground flex min-h-9 items-center gap-1.5 text-[12px] font-semibold transition"
            >
              {cancelling ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Cancel this ticket
            </button>
          ) : null}

          {!cancelled ? (
            reported ? (
              <p className="border-border bg-muted/40 text-muted-foreground flex min-h-9 items-center gap-2 rounded-full border px-4 text-[12px] font-semibold">
                <Flag className="size-3.5" />
                Reported — Mesita is looking at it
              </p>
            ) : (
              <button
                type="button"
                onClick={() => openSheet("report")}
                className="text-muted-foreground hover:text-foreground flex min-h-9 items-center gap-1.5 text-[12px] font-semibold transition"
              >
                <Flag className="text-destructive size-3.5" />
                Report a problem
              </button>
            )
          ) : null}
        </div>
      </div>

      <LocalSheet
        open={sheet === "mesita"}
        onClose={() => setSheet(null)}
        ariaLabel={`Rate ${placeName} on Mesita`}
      >
        <div className="px-5 pt-4 pb-8">
          <TicketReviewForm
            draft={reviewDraft}
            onChange={setReviewDraft}
            onSubmit={() => void submitMesitaReview()}
            busy={reviewBusy}
            placeName={placeName}
            error={reviewError}
          />
        </div>
      </LocalSheet>

      <LocalSheet
        open={sheet === "report"}
        onClose={() => setSheet(null)}
        ariaLabel={`Report a problem at ${placeName}`}
      >
        <div className="flex flex-col gap-3 px-5 pt-4 pb-8">
          <div>
            <p className="text-foreground text-[15px] font-extrabold tracking-tight">
              What went wrong at {placeName}?
            </p>
            <p className="text-muted-foreground mt-0.5 text-[12px] leading-snug">
              A real person at Mesita reads every report. Places that don&apos;t
              honor tickets lose the program.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            {REPORT_REASONS.map((r) => {
              const active = reportReason === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setReportReason(r.key)}
                  className={cn(
                    "rounded-2xl px-3.5 py-3 text-left transition",
                    active
                      ? "bg-primary/8 ring-primary/40 ring-2"
                      : "bg-muted/40 active:scale-[0.99]",
                  )}
                >
                  <span className="text-foreground block text-[13.5px] font-bold">
                    {r.label}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-[11.5px]">
                    {r.hint}
                  </span>
                </button>
              );
            })}
          </div>

          <textarea
            value={reportDetails}
            onChange={(e) => setReportDetails(e.target.value.slice(0, 1000))}
            rows={3}
            placeholder="Anything else we should know? (optional)"
            className="border-border bg-card focus:border-foreground w-full resize-none rounded-2xl border px-3.5 py-3 text-[13px] outline-none"
          />

          {reportError ? (
            <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-[12px]">
              {reportError}
            </p>
          ) : null}

          <button
            type="button"
            disabled={!reportReason || reportBusy}
            onClick={() => void submitReport()}
            className="bg-pink-gradient shadow-glow flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-bold text-white transition active:scale-[0.99] disabled:opacity-50"
          >
            {reportBusy ? <Loader2 className="size-4 animate-spin" /> : null}
            Send report
          </button>
        </div>
      </LocalSheet>
    </Shell>
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

// The rate is the whole point of step 1, so it never renders a guessed number
// while the engine's answer is in flight.
function QuoteLoading() {
  return (
    <div className="flex min-h-[128px] flex-col items-center justify-center gap-2">
      <Loader2 className="text-primary size-5 animate-spin" />
      <p className="text-muted-foreground text-[12px] font-semibold">
        Checking your rate here…
      </p>
    </div>
  );
}

// ★ — belongs to the visit, never to the unlock (D12).
function RateVisitRow({ done, onOpen }: { done: boolean; onOpen: () => void }) {
  return (
    <section className="border-border bg-card shrink-0 overflow-hidden rounded-2xl border px-2.5 py-2">
      <button
        type="button"
        disabled={done}
        onClick={onOpen}
        className={cn(
          "flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition",
          done ? "bg-emerald-500/8" : "bg-muted/40 active:scale-[0.99]",
        )}
      >
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg",
            done
              ? "bg-emerald-500/15 text-emerald-700"
              : "bg-secondary/10 text-secondary",
          )}
        >
          {done ? (
            <Check className="size-4" strokeWidth={3} />
          ) : (
            <UtensilsCrossed className="size-4" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-[13px] leading-tight font-bold",
              done ? "text-emerald-800" : "text-foreground",
            )}
          >
            {done ? "Thanks — visit rated" : "Rate your visit"}
          </span>
          <span className="text-muted-foreground mt-0.5 block text-[11px] leading-snug">
            {done
              ? "It feeds this place's Mesita rating."
              : "Food · service · ambiance — feeds its rating"}
          </span>
        </span>
        {!done ? <Star className="text-foreground/60 size-4 shrink-0" /> : null}
      </button>
    </section>
  );
}

// THE TICKET sits as an 80%-tall panel anchored to the bottom, not full-bleed
// (Pato, 2026-08-10). It stays a real route — the @modal interceptor is dead
// and stays dead (MESITA-857) — but a full-height page made the QR read as
// "the app" rather than as one object you hold up and put away. Leaving the top
// 20% as page ground gives it an edge, and the rounded top + card fill make the
// gap read as a sheet rather than as content that failed to reach the top.
//
// Height is a percentage of the app frame. Scroll lives in the STEP BODY, not
// here, so the chrome, the rail and the footer stay put while a step changes.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col justify-end">
      <div className="border-border bg-card shadow-elev flex h-[80%] min-h-0 flex-col rounded-t-3xl border-x border-t px-4 pt-3 pb-4">
        {children}
      </div>
    </div>
  );
}

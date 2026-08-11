"use client";

// THE TICKET (MESITA-857 · 908 · 886 · 1029) — the whole ticket lifecycle on
// ONE FULL PAGE, organised as a FOUR-STEP MODAL (Pato, 2026-08-11: "1. select
// rewards/tasks, 2. do tasks, 3. show qr, 4. results page"):
//
//   chrome (back · place · status) → rail → step body → utility row
//   1 Reward  · direction C, plan ticket-open-fast-20260811: NO hero number —
//               the three chips ARE the screen, each carrying its engine rate
//               big in Fraunces (selected = gradient); CTA right under them
//   2 Do it   · the chosen proof, self-attested
//   3 Show QR · THE PASS — guest + rate lockup + QR + stub (the big Fraunces
//               % moment lives HERE, not on step 1)
//   4 Results · what the visit paid, the ★, the bill capture
//
// SPEED CONTRACT (MESITA-1029): this screen renders from what the tap already
// knew. Identity comes from useConsumerIdentity() (the shell layout's one
// profile fetch — never re-fetch it here); a fresh ticket comes from the seed
// cache (ticket-seed.ts) so the QR paints on the FIRST frame; the quote
// promise starts at create time and is consumed here. list-tickets reconciles
// everything in the background. The born entrance died with this (7.2B):
// instant IS the delight, and the animation fired on a screen where the pass
// wasn't even visible. The scanned verified-pulse stays.
//
// THE RATE IS NOT A CREATE-TIME BOUNDARY. Tickets are created at "base";
// submit-review / submit-story accept any OPEN ticket and ticket-reprice
// bumps late tasks upward, so the QR never waits on a task and a task is
// pure upside. The step-1 pick is a LOCAL preference (useStoredString) until
// a proof lands; only the ticket's own status can lock the QR. Pre-1026
// tickets with a 'pending' task keep their lock and land on step 2.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
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
import { JourneyRail } from "@/components/consumer/rewards/JourneyRail";
import { TaskProof } from "@/components/consumer/rewards/TaskProof";
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
  type ConsumerTicketRow,
  type ReportReason,
  type RewardQuote,
} from "@/lib/api/tickets";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useConsumerClass, useConsumerIdentity } from "@/lib/class-context";
import { classProperLabel } from "@/lib/consumer-data";
import { useStoredString } from "@/lib/local-store";
import { strategyForPlaceRow } from "@/lib/promo-rates";
import { peekTicketSeed } from "@/lib/ticket-seed";
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

function stubNoun(a: ActionKind): string {
  return a === "story" ? "Story" : a === "mesita" ? "Mesita ★" : "Review";
}

type Step = 1 | 2 | 3 | 4;
type TaskSheet = "mesita" | "report" | null;

const STEP_LABELS = ["Reward", "Do it", "Show QR", "Results"] as const;

// The modular reward model (Pato, 2026-08-11: "you have your base and you can
// select your bonuses… display all bonuses, automatic and action; automatic
// is automatic but still display it; action bonuses you can only select one"):
//   base reward            — always yours, shown first
//   welcome visit bonus    — AUTOMATIC (displayed, never selectable)
//   instagram story bonus  — action ┐
//   google review bonus    — action ├ pick ONE (or none — base always works)
//   mesita review bonus    — action ┘
// story/google map to the ticket's story_status/review_status columns; the
// Mesita ★ lives in ticket_reviews and the engine's resolveLiveTicketRate
// counts it via hasMesitaReview at billing time, so all three actions PAY.
type ActionKind = "story" | "google" | "mesita";
/** "base" = no action selected — the QR at the guest's floor. */
type RewardPick = ActionKind | "base";

export function TicketScreen({ ticketId }: { ticketId: string }) {
  const supabase = useBrowserSupabase();
  const router = useRouter();
  // Identity rides the shell layout's one profile fetch (S1) — this screen
  // adds ZERO server work of its own.
  const { userId, displayName: guestName, avatarUrl } = useConsumerIdentity();
  const tickets = useConsumerTickets(userId);
  const { key: classKey, handle: igHandle } = useConsumerClass();

  // The seed (S3) covers the gap between arrival and the first list-tickets
  // response — a freshly created ticket paints QR-and-all on frame 1. The
  // polled list wins the moment it has the row.
  const seed = useMemo(() => peekTicketSeed(ticketId), [ticketId]);
  const ticket = useMemo(
    () =>
      tickets.active.find((t) => t.id === ticketId) ??
      tickets.history.find((t) => t.id === ticketId) ??
      seed?.ticket ??
      null,
    [tickets.active, tickets.history, ticketId, seed],
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
  const [quoteFail, setQuoteFail] = useState<string | null>(null);
  const [quoteReload, setQuoteReload] = useState(0);
  useEffect(() => {
    if (quotePlaceId === null) return;
    let cancelled = false;
    void (async () => {
      try {
        // S4: a create-time prefetch may already hold the answer — consume it
        // instead of starting cold. It resolves null on failure, and a manual
        // retry (quoteReload > 0) always goes to the network.
        const seeded =
          quoteReload === 0 &&
          seed?.quote &&
          seed.ticket.project_id === quotePlaceId
            ? await seed.quote
            : null;
        const quote =
          seeded ?? (await apiGetRewardQuote(supabase, quotePlaceId)).quote;
        if (!cancelled) {
          setQuoteRes({ placeId: quotePlaceId, quote });
          setQuoteFail(null);
        }
      } catch {
        // The QR NEVER waits on the quote — only step 1's numbers do. The
        // failure renders as an inline retry + a "base" escape hatch there,
        // and the pass headline stays hidden rather than guessing a number.
        if (!cancelled) setQuoteFail(quotePlaceId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quotePlaceId, supabase, seed, quoteReload]);
  const quote = quoteRes?.placeId === quotePlaceId ? quoteRes.quote : null;
  const quoteError = quoteFail === quotePlaceId && quote === null;

  // Step 1's pick. useStoredString keeps the hydration render on the SSR
  // snapshot, so no setState-in-effect and no mismatch.
  const [storedPick, setStoredPick] = useStoredString(
    pickStorageKey(ticketId),
    "",
  );
  // Row selection while the guest is still deciding — writing straight to the
  // store would advance the derived step out from under the tap.
  const [draftPick, setDraftPick] = useState<RewardPick | null>(null);
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
  const submitMesitaReview = useCallback(async (): Promise<boolean> => {
    setReviewBusy(true);
    setReviewError(null);
    try {
      await submitTicketReview(supabase, { ticketId, ...reviewDraft });
      setReviewDone(true);
      setSheet(null);
      return true;
    } catch (err) {
      setReviewError(
        err instanceof Error ? err.message : "Couldn't save your review.",
      );
      return false;
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

  // A failed list call is NOT a missing ticket (Pass 2): telling a guest at
  // the table that their ticket "may have been cancelled" because the network
  // blipped is the worst possible misread. Error gets a retry; only a
  // successful list that lacks the row gets "not found".
  if (!ticket && tickets.status === "error") {
    return (
      <Shell>
        <div className="surface-card flex flex-col items-center gap-3 rounded-2xl px-6 py-12 text-center">
          <span className="bg-muted text-muted-foreground grid size-12 place-items-center rounded-2xl">
            <XCircle className="size-6" />
          </span>
          <p className="text-foreground text-[15px] font-semibold">
            Couldn&apos;t load your ticket
          </p>
          <p className="text-muted-foreground max-w-[280px] text-[12.5px] leading-relaxed">
            Check your connection — your ticket is safe.
          </p>
          <button
            type="button"
            onClick={tickets.retry}
            className="bg-pink-gradient shadow-glow mt-1 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white"
          >
            Retry
          </button>
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
  const mesitaRate = withBonus(quote?.bonuses.mesita ?? 0);

  // What the TICKET records beats what the guest merely picked. Only a
  // persisted task can gate the QR (D6, pick-one); a local pick is an
  // intention and gates nothing. story_status/review_status name the
  // Instagram and GOOGLE rungs; the Mesita ★ lives in ticket_reviews, so its
  // done-state is session-local (reviewDone) — the engine still counts it at
  // billing time via hasMesitaReview.
  const storyOnTicket =
    ticket.story_status != null && ticket.story_status !== "not_required";
  const reviewOnTicket =
    ticket.review_status != null && ticket.review_status !== "not_required";
  const persistedTask: ActionKind | null = storyOnTicket
    ? "story"
    : reviewOnTicket
      ? "google"
      : null;
  const persistedState: TaskState | null = persistedTask
    ? taskStateFor(
        persistedTask === "story" ? ticket.story_status : ticket.review_status,
      )
    : null;

  // Stored "review" predates the google/mesita split — read it as google.
  const localPick: RewardPick | null =
    storedPick === "review"
      ? "google"
      : storedPick === "base" ||
          storedPick === "story" ||
          storedPick === "google" ||
          storedPick === "mesita"
        ? storedPick
        : null;
  const pick: RewardPick | null = persistedTask ?? localPick;
  const chosenAction: ActionKind | null = pick === "base" ? null : pick;
  const chosenState: TaskState =
    chosenAction === "mesita"
      ? reviewDone
        ? "done"
        : "todo"
      : (persistedState ?? "todo");
  const actionBonus = (a: ActionKind | null): number =>
    !quote || a === null
      ? 0
      : a === "story"
        ? quote.bonuses.story
        : a === "google"
          ? quote.bonuses.google
          : quote.bonuses.mesita;
  const chosenRate =
    !quote || !chosenAction || !priced ? 0 : withBonus(actionBonus(chosenAction));

  // The headline number + its honesty clause. Billed truth wins; a rejected
  // proof falls back to the class base (D7); everything else quotes the
  // chosen action, conditionally until done.
  const headlinePercent = billed
    ? (ticket.discount_percent ?? 0)
    : chosenAction && chosenState !== "rejected"
      ? chosenRate
      : base;
  const actionNoun =
    chosenAction === "story"
      ? "story"
      : chosenAction === "mesita"
        ? "Mesita review"
        : "review";
  const headlineSuffix = billed
    ? "applied at the table"
    : !priced
      ? ""
      : chosenAction === null
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
  // ★ post-scan row: rating the visit belongs to the visit (D12). When the
  // guest PICKED mesita as their action bonus it's already done (or offered
  // on step 2), so this row is the catch-all for everyone else.
  const showMesitaStar = !cancelled && (scanned || saved);
  // Upside still on the table: the guest is holding a working QR but hasn't
  // done an action that would pay more. Only REACHABLE rungs count — a story
  // rate quoted to someone with no connected Instagram is a promise the
  // submit EF will refuse, and over-promising a discount is the one direction
  // this screen must never err. Post-scan the ★ row takes over.
  const igConnected = Boolean(igHandle?.trim());
  const reachableStoryRate =
    igConnected && quote?.storyEligible ? storyRate : 0;
  const reachableMesitaRate =
    !reviewDone && (quote?.bonuses.mesita ?? 0) > 0 ? mesitaRate : 0;
  const bestReachableRate = Math.max(
    reviewRate,
    reachableStoryRate,
    reachableMesitaRate,
    chosenRate,
  );
  const upsideLeft =
    live &&
    priced &&
    !scanned &&
    chosenState !== "done" &&
    bestReachableRate > base;

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
      : chosenAction === null
        ? 1
        : chosenState === "done"
          ? 3
          : 2;
  let step: Step = closed ? 4 : (stepChoice ?? naturalStep);
  if (step === 2 && chosenAction === null) step = 1;
  if (step === 1 && !priced) step = 3;

  const stepReachable = (n: number): boolean =>
    n === 4
      ? closed
      : n === 1
        ? live && priced
        : n === 2
          ? live && chosenAction !== null
          : live;

  // A ticket that already carries a persisted task (pre-1026) locks the pick.
  const pickLocked = persistedTask !== null;
  // Which action rows can actually be picked. A rung the engine prices at 0
  // is displayed (Pato: "display all bonuses") but inert — selecting it would
  // promise nothing.
  const storySelectable =
    Boolean(quote?.storyEligible) && igConnected && !pickLocked;
  const googleSelectable = (quote?.bonuses.google ?? 0) > 0 && !pickLocked;
  const mesitaSelectable =
    (quote?.bonuses.mesita ?? 0) > 0 && !reviewDone && !pickLocked;
  const defaultPick: RewardPick = googleSelectable
    ? "google"
    : mesitaSelectable
      ? "mesita"
      : storySelectable
        ? "story"
        : "base";
  const selectedPick: RewardPick = draftPick ?? pick ?? defaultPick;
  const selectedAction: ActionKind | null =
    selectedPick === "base" ? null : selectedPick;
  const selectedTotal = !quote
    ? 0
    : selectedAction
      ? withBonus(actionBonus(selectedAction))
      : base;
  // Tap the selected action again to drop back to base-only — one action max,
  // zero actions always allowed.
  const toggleAction = (a: ActionKind) =>
    setDraftPick(selectedPick === a ? "base" : a);
  // Per-row rate caption: additive stacks (+N%), legacy best-of shows the
  // resulting rate instead — never a "+" it won't honor.
  const bonusAmount = (bonus: number): string =>
    additive ? `+${bonus}%` : `${withBonus(bonus)}%`;

  const confirmChosen = chosenAction === "story" ? confirmStory : confirmGoogle;

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
        {/* Step swaps re-render in place; announce them (Pass 6 / T7). */}
        <p className="sr-only" aria-live="polite">
          Step {step} of 4 — {STEP_LABELS[step - 1]}
        </p>
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
          <>
            {/* Modular reward sheet (Pato, 2026-08-11): base first, then EVERY
                bonus — the automatic one marked AUTO, the three actions as a
                pick-one set. Each rung is a row, each row carries its own
                number, and the sum is spelled out under the list. */}
            <div className="pt-1 text-center">
              <p className="text-foreground text-[15px] font-extrabold tracking-tight">
                Your reward at {placeName}
              </p>
              <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
                Base is yours already — bonuses stack on top.
              </p>
            </div>
            {quoteError ? (
              // Rates unavailable ≠ ticket unavailable: the QR stays one tap
              // away at the guest's base while the quote retries.
              <div className="flex flex-col items-center gap-2 pt-1">
                <p className="bg-destructive/10 text-destructive w-full rounded-lg px-3 py-2 text-center text-[12px]">
                  Couldn&apos;t load your rates here.
                </p>
                <div className="flex items-center gap-5">
                  <button
                    type="button"
                    onClick={() => setQuoteReload((k) => k + 1)}
                    className="text-primary flex min-h-9 items-center text-[12.5px] font-semibold"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!pickLocked) setStoredPick("base");
                      goToStep(3);
                    }}
                    className="text-muted-foreground hover:text-foreground flex min-h-9 items-center text-[12.5px] font-semibold"
                  >
                    Show my QR anyway
                  </button>
                </div>
              </div>
            ) : quote === null ? (
              // Row-shaped skeletons — the headline paints, the rates pulse.
              <div className="flex flex-col gap-2 pt-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="border-border bg-card h-[52px] animate-pulse rounded-2xl border"
                  />
                ))}
              </div>
            ) : (
              <>
                <SectionLabel>Your base</SectionLabel>
                <BonusRow
                  state="included"
                  icon={<BadgeCheck className="size-4" />}
                  label="Base reward"
                  subLabel={`${classProperLabel(classKey)} class`}
                  amount={`${quote.base}%`}
                />

                <SectionLabel>Automatic bonus</SectionLabel>
                {welcomeBonus > 0 ? (
                  <BonusRow
                    state="included"
                    icon={<Sparkles className="size-4" />}
                    label="Welcome visit bonus"
                    subLabel="Your first visit here"
                    amount={bonusAmount(welcomeBonus)}
                  />
                ) : (
                  <BonusRow
                    state="off"
                    icon={<Sparkles className="size-4" />}
                    label="Welcome visit bonus"
                    subLabel={
                      quote.isFirstVisit
                        ? "Not offered here"
                        : "First visit only — you've been here"
                    }
                    amount={null}
                  />
                )}

                <SectionLabel>Action bonuses — pick one</SectionLabel>
                <div
                  role="radiogroup"
                  aria-label="Action bonus"
                  className="flex flex-col gap-2"
                >
                  <BonusRow
                    state={quote.storyEligible ? "action" : "off"}
                    icon={<Instagram className="size-4" />}
                    label="Instagram story bonus"
                    subLabel={
                      !quote.storyEligible
                        ? "Not offered here"
                        : !igConnected
                          ? "+ Connect Instagram"
                          : "Post a tagged story"
                    }
                    amount={
                      quote.storyEligible
                        ? bonusAmount(quote.bonuses.story)
                        : null
                    }
                    selected={selectedPick === "story"}
                    disabled={!storySelectable}
                    onSelect={() => toggleAction("story")}
                  />
                  <BonusRow
                    state={quote.bonuses.google > 0 ? "action" : "off"}
                    icon={<Star className="size-4" />}
                    label="Google review bonus"
                    subLabel={
                      quote.bonuses.google > 0
                        ? "Leave a Google review"
                        : "Not offered here"
                    }
                    amount={
                      quote.bonuses.google > 0
                        ? bonusAmount(quote.bonuses.google)
                        : null
                    }
                    selected={selectedPick === "google"}
                    disabled={!googleSelectable}
                    onSelect={() => toggleAction("google")}
                  />
                  {reviewDone ? (
                    // Already rated — the engine counts it automatically now,
                    // so it reads as banked, not as an option to weigh.
                    <BonusRow
                      state="included"
                      icon={<UtensilsCrossed className="size-4" />}
                      label="Mesita review bonus"
                      subLabel="Visit rated — counted at the bill"
                      amount={bonusAmount(quote.bonuses.mesita)}
                    />
                  ) : (
                    <BonusRow
                      state={quote.bonuses.mesita > 0 ? "action" : "off"}
                      icon={<UtensilsCrossed className="size-4" />}
                      label="Mesita review bonus"
                      subLabel={
                        quote.bonuses.mesita > 0
                          ? "Rate your visit on Mesita"
                          : "Not offered here"
                      }
                      amount={
                        quote.bonuses.mesita > 0
                          ? bonusAmount(quote.bonuses.mesita)
                          : null
                      }
                      selected={selectedPick === "mesita"}
                      disabled={!mesitaSelectable}
                      onSelect={() => toggleAction("mesita")}
                    />
                  )}
                </div>

                {/* The sum, spelled out — modular means the math is visible. */}
                <div className="pt-0.5 text-center">
                  {additive ? (
                    <p className="text-muted-foreground text-[11px] font-semibold">
                      {quote.base}% base
                      {welcomeBonus > 0 ? ` + ${welcomeBonus}% welcome` : ""}
                      {selectedAction
                        ? ` + ${actionBonus(selectedAction)}% ${
                            selectedAction === "story"
                              ? "story"
                              : selectedAction === "google"
                                ? "review"
                                : "Mesita review"
                          }`
                        : ""}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-[11px] font-semibold">
                      Your best single reward
                    </p>
                  )}
                  <p className="font-display text-pink-gradient text-[30px] leading-none font-extrabold tracking-tight">
                    = {selectedTotal}% off
                  </p>
                </div>

                <p className="text-muted-foreground/80 text-center text-[10.5px] leading-snug">
                  {pickLocked
                    ? "This ticket already carries its action — finish it to unlock the higher rate."
                    : "One action bonus per ticket — tap it again to skip it. Your QR works either way."}
                </p>

                {/* CTA right where the eye already is (D2), naming the deal
                    (7.1A): the ONE number repeat that's confirmation. */}
                <button
                  type="button"
                  onClick={() => {
                    if (!pickLocked) setStoredPick(selectedPick);
                    goToStep(selectedAction ? 2 : 3);
                  }}
                  className="bg-pink-gradient shadow-glow flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-2xl text-[14px] font-bold text-white transition active:scale-[0.99]"
                >
                  {selectedAction === "google"
                    ? `Do the review → unlock ${selectedTotal}%`
                    : selectedAction === "story"
                      ? `Post a story → unlock ${selectedTotal}%`
                      : selectedAction === "mesita"
                        ? `Rate on Mesita → unlock ${selectedTotal}%`
                        : `Show my QR at ${base}%`}
                </button>
              </>
            )}
          </>
        ) : step === 2 && chosenAction === "mesita" ? (
          // The Mesita ★ as the chosen action — the form IS the task, inline.
          <div className="flex flex-col gap-3 pt-1">
            <div className="surface-card rounded-2xl px-4 py-4">
              <TicketReviewForm
                draft={reviewDraft}
                onChange={setReviewDraft}
                onSubmit={() =>
                  void (async () => {
                    const ok = await submitMesitaReview();
                    if (ok) goToStep(3);
                  })()
                }
                busy={reviewBusy}
                placeName={placeName}
                error={reviewError}
              />
            </div>
            <button
              type="button"
              onClick={() => goToStep(3)}
              className="text-muted-foreground hover:text-foreground mx-auto flex min-h-11 items-center text-[12.5px] font-semibold transition"
            >
              I&apos;ll finish this in a bit — show my QR
            </button>
          </div>
        ) : step === 2 && chosenAction ? (
          <TaskProof
            kind={chosenAction === "story" ? "story" : "review"}
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
                      {chosenAction
                        ? chosenState === "done"
                          ? `${stubNoun(chosenAction)} ✓`
                          : chosenState === "rejected"
                            ? `${stubNoun(chosenAction)} not accepted`
                            : `${stubNoun(chosenAction)} pending`
                        : "No action — base rate"}
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
                onClick={() => goToStep(chosenAction ? 2 : 1)}
                className="border-border bg-card flex min-h-11 w-full shrink-0 items-center gap-2.5 rounded-2xl border px-3 py-2 text-left transition active:scale-[0.99]"
              >
                <span className="bg-secondary/10 text-secondary grid size-8 shrink-0 place-items-center rounded-lg">
                  {chosenAction === "story" ? (
                    <Instagram className="size-4" />
                  ) : chosenAction === "google" ? (
                    <Star className="size-4" />
                  ) : chosenAction === "mesita" ? (
                    <UtensilsCrossed className="size-4" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block text-[13px] leading-tight font-bold">
                    {chosenAction === "story"
                      ? "Post your tagged story"
                      : chosenAction === "google"
                        ? "Leave your Google review"
                        : chosenAction === "mesita"
                          ? "Rate your visit on Mesita"
                          : "Add an action bonus"}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-[11px] leading-snug">
                    {chosenState === "rejected"
                      ? `Not accepted — you still keep your ${base}%. Try again?`
                      : "Order first — do this while your food comes."}
                  </span>
                </span>
                <span className="font-display text-foreground/80 shrink-0 text-[15px] leading-none font-extrabold tabular-nums">
                  {bestReachableRate}%
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

      {/* Utility row — housekeeping only, ONE quiet line at the true bottom,
          physically far from any CTA (D2). Destructive and rare actions don't
          get button chrome next to the commit path. */}
      <div className="flex shrink-0 items-center justify-center gap-2.5 pt-2">
        {ticket.status === "open" ? (
          <button
            type="button"
            onClick={() => void cancel()}
            disabled={cancelling}
            className="text-muted-foreground hover:text-foreground flex min-h-9 items-center gap-1.5 text-[12px] font-semibold transition"
          >
            {cancelling ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Cancel ticket
          </button>
        ) : null}
        {ticket.status === "open" && !cancelled ? (
          <span aria-hidden="true" className="text-muted-foreground/40 text-[12px]">
            ·
          </span>
        ) : null}
        {!cancelled ? (
          reported ? (
            <p className="text-muted-foreground flex min-h-9 items-center text-[12px] font-semibold">
              Reported — Mesita is looking at it
            </p>
          ) : (
            <button
              type="button"
              onClick={() => openSheet("report")}
              className="text-muted-foreground hover:text-foreground flex min-h-9 items-center text-[12px] font-semibold transition"
            >
              Report a problem
            </button>
          )
        ) : null}
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

// Tiny uppercase group caption — the modular sheet's section voice.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground/80 px-1 pt-1 text-[10px] font-extrabold tracking-[0.12em] uppercase">
      {children}
    </p>
  );
}

// One rung of the modular reward sheet. Three states:
//   included — automatic money (base, welcome, an already-earned ★): tinted,
//              AUTO badge, never tappable.
//   action   — selectable, radio semantics (pick one, retap to unpick).
//   off      — displayed but inert (rung priced 0 / not eligible): dashed.
// The rate is the row's own number, Fraunces, gradient when selected.
function BonusRow({
  state,
  icon,
  label,
  subLabel,
  amount,
  selected = false,
  disabled = false,
  onSelect,
}: {
  state: "included" | "action" | "off";
  icon: React.ReactNode;
  label: string;
  subLabel?: string;
  /** "+10%" (additive) or "12%" (best-of) — null hides the number. */
  amount: string | null;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  const body = (
    <>
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg",
          state === "included"
            ? "bg-secondary/10 text-secondary"
            : selected
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-[13px] leading-tight font-bold">
          {label}
        </span>
        {subLabel ? (
          <span
            className={cn(
              "mt-0.5 block truncate text-[10.5px] font-bold",
              state === "included" ? "text-secondary" : "text-muted-foreground",
            )}
          >
            {subLabel}
          </span>
        ) : null}
      </span>
      {amount ? (
        <span
          className={cn(
            "font-display shrink-0 leading-none font-extrabold tabular-nums",
            selected
              ? "text-pink-gradient text-[24px]"
              : state === "included"
                ? "text-secondary text-[18px]"
                : "text-muted-foreground text-[18px]",
          )}
        >
          {amount}
        </span>
      ) : null}
      {state === "action" ? (
        <span
          aria-hidden="true"
          className={cn(
            "grid size-5 shrink-0 place-items-center rounded-full border-[1.5px]",
            selected
              ? "border-primary bg-primary text-white"
              : "border-border bg-card",
          )}
        >
          {selected ? <Check className="size-3" strokeWidth={3.5} /> : null}
        </span>
      ) : state === "included" ? (
        <span className="bg-secondary/10 text-secondary shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-wide uppercase">
          Auto
        </span>
      ) : null}
    </>
  );
  const shell = cn(
    "flex min-h-[52px] w-full items-center gap-2.5 rounded-2xl border-[1.5px] px-3 py-2.5 text-left",
    state === "included"
      ? "border-secondary/25 bg-secondary/[0.06]"
      : selected
        ? "border-primary bg-primary/5"
        : "border-border bg-card",
    state === "off" && "border-dashed opacity-55",
    state === "action" && disabled && "opacity-55",
  );
  if (state === "action" && !disabled) {
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onSelect}
        className={cn(shell, "transition active:scale-[0.99]")}
      >
        {body}
      </button>
    );
  }
  return (
    <div aria-disabled={state !== "included" ? true : undefined} className={shell}>
      {body}
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

// THE TICKET is a FULL PAGE (Pato, 2026-08-11: "better make the modal full
// page, not 80% tall"). This reverses MESITA-1022's 80% bottom panel, which
// reserved the top 20% as page ground so the ticket would read as a sheet you
// hold up and put away. With four steps inside it (MESITA-1026) that reasoning
// inverted: the panel had to carry chrome + rail + a scrolling step body + a
// pinned footer in 80% of the frame, so step 1's chips and step 3's QR both
// scrolled inside a box that was itself floating. It is a real route — the
// @modal interceptor is dead and stays dead (MESITA-857) — so it gets to be a
// real page.
//
// Ground is bg-background, like every other consumer surface: the step body's
// rows are `bg-card`, and a card fill here would erase their edges.
//
// Scroll lives in the STEP BODY, not here, so the chrome, the rail and the
// footer stay put while a step changes.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col px-4 pt-3 pb-3">
      {children}
    </div>
  );
}

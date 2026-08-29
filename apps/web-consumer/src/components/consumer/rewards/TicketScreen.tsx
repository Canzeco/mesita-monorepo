"use client";

// THE TICKET v4 (MESITA-1084 · 1088–1092) — the whole ticket lifecycle on ONE
// FULL PAGE, organised as the SEVEN-STEP JOURNEY from Notion 🦚 Main ›
// Tickets Workflow. The place was picked in the wallet; from here:
//
//   chrome (back · place) → seven-chip rail → step body → utility row
//   1 Bill     · the guest types the printed total + picks the tip
//                (10/15/20/custom, 15% preselected, tip BEFORE the discount)
//   2 Reward   · the lanes — payout · automatic · visit · class · plan ·
//                sharing (pick one) — live result + the cap, honestly
//   3 Task     · the chosen proof, done and uploaded right here
//   4 QR       · the HANDSHAKE, not the finish: the scan opens the ticket
//                staff-side; they approve or send back ONE named fix, which
//                returns the guest to that step — same code, no new QR (F1)
//   5 Pay      · after approval only — the amount is frozen; pay the place
//                directly (C2: card-through-Mesita and Yums are staged)
//   6 Validate · payment confirms → the ticket closes on its own
//   7 Results  · what the visit paid
//
// LIVE SYNC is owner-scoped polling (consumer-web-get-ticket at 10s +
// visibilitychange) — Realtime stays off `tickets` by design. A staff
// send-back arrives asynchronously: the rail chip turns AMBER, the banner
// NAMES the fix (never the failure — the word "rejected" appears nowhere),
// focus moves to the returned-to step, and ONE aria-live region announces it
// (D3 · T2). Approval auto-advances to Pay after ~900ms.
//
// SPEED CONTRACT (MESITA-1029) survives v4: identity rides the shell
// layout's one profile fetch, a fresh ticket paints from the seed cache, the
// quote promise starts at create time. The step machine itself lives in
// lib/ticket-journey.ts — pure and swept by tests, because its one bug class
// (a fix bouncing to a step the clamps refuse) only used to reproduce at a
// real restaurant.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BadgeCheck,
  Check,
  Crown,
  Gem,
  Loader2,
  Medal,
  RefreshCw,
  Sparkles,
  Star,
  Store,
  UtensilsCrossed,
  XCircle,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import {
  LocalDialog,
  LocalSheet,
} from "@/components/consumer/overlay/LocalOverlay";
import {
  TicketReviewForm,
  type TicketReviewDraft,
} from "@/components/consumer/TicketReviewForm";
import { JourneyRail } from "@/components/consumer/rewards/JourneyRail";
import { TicketHero } from "@/components/consumer/rewards/TicketHero";
import { TicketSkeleton } from "@/components/consumer/rewards/TicketSkeleton";
import { TaskProof } from "@/components/consumer/rewards/TaskProof";
import {
  GoogleGlyph,
  InstagramGlyph,
  MesitaGlyph,
} from "@/components/consumer/rewards/BrandGlyph";
import {
  Lane,
  LaneChip,
  MoneyRow,
  StepBill,
  StepPay,
  StepResults,
  StepValidate,
  TipHonesty,
} from "@/components/consumer/rewards/ticket-steps";
import { submitTicketReview } from "@/lib/api/pay";
import { formatCurrency } from "@/lib/api/profile";
import {
  ACTIVE_TICKET_STATUSES,
  REPORT_REASONS,
  apiCancelTicket,
  apiGetRewardQuote,
  apiGetTicket,
  apiReportTicket,
  apiSelectTicketPayment,
  apiSubmitReview,
  apiSubmitStory,
  apiSubmitTicketBill,
  checkUrlForCode,
  type ConsumerTicketRow,
  type GuestVisitsPolicy,
  type TicketSettlement,
  type ReportReason,
  type RewardQuote,
} from "@/lib/api/tickets";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useConsumerClass, useConsumerIdentity } from "@/lib/class-context";
import { classProperLabel } from "@/lib/consumer-data";
import { useStoredString } from "@/lib/local-store";
import { strategyForPlaceRow } from "@/lib/promo-rates";
import { peekTicketSeed } from "@/lib/ticket-seed";
import {
  FIX_COPY,
  fixReturnStep,
  isTicketFix,
  resolveStep,
  stepReachable,
  type JourneyInput,
  type TicketFix,
  type TicketStepId,
} from "@/lib/ticket-journey";
import { useConsumerTickets } from "@/lib/hooks/useConsumerTickets";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn, errMsg } from "@/lib/utils";
import { ERROR_BOX_CLASS, TEXTAREA_CLASS } from "@/lib/ui-classes";

const FOCUS_AFTER_APPROVE_MS = 900;
const SCAN_PULSE_MS = 1400;
const WAITING_TICK_MS = 15_000;

// The ticket's own gradient, by CLASS (Classes v2). Takes a string because the
// caller hands it the context key straight through; unknown values fall to the
// Bronze wash rather than rendering nothing.
function passGradient(key: string): string {
  if (key === "diamond")
    return "bg-[linear-gradient(150deg,#ff7a45_0%,#4aa8ff_55%,#2f7fd6_100%)]";
  if (key === "gold")
    return "bg-[linear-gradient(150deg,#ff7a45_0%,#ffb03d_55%,#e0982e_100%)]";
  if (key === "silver")
    return "bg-[linear-gradient(150deg,#ff7a45_0%,#c9ced6_55%,#98a1ad_100%)]";
  return "bg-[linear-gradient(150deg,#ff7a45_0%,#ff4d6d_55%,#ff2d78_100%)]";
}

type TaskState = "todo" | "busy" | "checking" | "done" | "rejected";

function taskStateFor(v: string | null | undefined): TaskState {
  if (v == null || v === "not_required" || v === "pending") return "todo";
  if (v === "submitted") return "checking";
  if (v === "ai_rejected" || v === "staff_rejected") return "rejected";
  return "done";
}

/** Where the guest's reward pick lives until a proof makes it real. */
function pickStorageKey(ticketId: string): string {
  return `mesita.ticket.reward.${ticketId}`;
}

type TaskSheet = "mesita" | "report" | null;

type ActionKind = "story" | "google" | "mesita";
/** "base" = no action selected — the QR at the guest's floor. */
type RewardPick = ActionKind | "base";

const ACTION_SHORT = {
  story: "Instagram Story",
  google: "Google Review",
  mesita: "Mesita Review",
} as const satisfies Record<ActionKind, string>;

const PAY_METHOD_LABEL = {
  at_place: "Paid at the place",
  mesita: "Card through Mesita",
} as const satisfies Record<string, string>;

/** The freshest of the wallet row and the 10s poll, by updated_at. */
function freshest(
  list: ConsumerTicketRow | null,
  polled: ConsumerTicketRow | null,
): ConsumerTicketRow | null {
  if (!polled) return list;
  if (!list) return polled;
  const a = list.updated_at ?? "";
  const b = polled.updated_at ?? "";
  return b >= a
    ? { ...list, ...polled, place: polled.place ?? list.place }
    : list;
}

export function TicketScreen({ ticketId }: { ticketId: string }) {
  const supabase = useBrowserSupabase();
  const router = useRouter();
  // Identity rides the shell layout's one profile fetch (S1) — this screen
  // adds ZERO server work of its own beyond its own ticket.
  const { userId, displayName: guestName, avatarUrl } = useConsumerIdentity();
  const tickets = useConsumerTickets(userId);
  const { key: classKey, handle: igHandle } = useConsumerClass();

  // The seed (S3) covers the gap between arrival and the first list response;
  // the 10s poll (v4) then owns freshness for THIS ticket.
  const seed = useMemo(() => peekTicketSeed(ticketId), [ticketId]);
  const [polled, setPolled] = useState<ConsumerTicketRow | null>(null);
  const listTicket = useMemo(
    () =>
      tickets.active.find((t) => t.id === ticketId) ??
      tickets.history.find((t) => t.id === ticketId) ??
      seed?.ticket ??
      null,
    [tickets.active, tickets.history, ticketId, seed],
  );
  const ticket = useMemo(
    () => freshest(listTicket, polled),
    [listTicket, polled],
  );

  const live = ticket ? ACTIVE_TICKET_STATUSES.has(ticket.status) : false;

  // ── The guest side of the handshake: poll THIS ticket at 10s while it is
  //    live, re-sync on visibilitychange, stop at terminal (F1). Transport
  //    failure is NOT an error state — after three misses one muted line
  //    appears; the card stays painted and the QR stays valid. ─────────────
  // Declared before the poll effect below, which drives it on staff
  // transitions (approve → auto-advance, send-back → returned step).
  const [stepChoice, setStepChoice] = useState<TicketStepId | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<ActionKind | null>(null);
  const [pollMisses, setPollMisses] = useState(0);
  // T2/F1: the ONE live region's text + the focus moves fire on the
  // TRANSITIONS the poll observes — staff approve, staff send-back — inside
  // the async handler, with stable copy. First observation only records a
  // baseline: arriving mid-wait is not a change worth announcing.
  const [announce, setAnnounce] = useState("");
  const [visits, setVisits] = useState<GuestVisitsPolicy | null>(null);
  const [settlement, setSettlement] = useState<TicketSettlement | null>(null);
  const pollMs = (visits?.consumerPollSeconds ?? 10) * 1000;
  const approveFocusTimer = useRef<number | null>(null);
  const stepBodyRef = useRef<HTMLDivElement | null>(null);
  const lastSyncRef = useRef<{ status: string | null; fix: string | null }>({
    status: null,
    fix: null,
  });
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const {
          ticket: fresh,
          visits: policy,
          settlement: rails,
        } = await apiGetTicket(supabase, ticketId);
        if (cancelled) return;
        if (policy) setVisits(policy);
        if (rails) setSettlement(rails);
        setPolled(fresh);
        setPollMisses(0);
        const prev = lastSyncRef.current;
        const freshFix = fresh.fix_requested ?? null;
        const placeName = fresh.place?.name ?? "the place";
        if (prev.status !== null) {
          if (fresh.status !== prev.status) {
            if (fresh.status === "scanned" && !freshFix) {
              setAnnounce(`Scanned. Waiting for ${placeName} to approve.`);
            } else if (fresh.status === "approved") {
              setAnnounce(`Approved by ${placeName}.`);
              // Auto-advance lands on Pay via the machine after ~900ms; move
              // focus with it so the change is never a silent teleport.
              if (approveFocusTimer.current !== null) {
                window.clearTimeout(approveFocusTimer.current);
              }
              approveFocusTimer.current = window.setTimeout(() => {
                approveFocusTimer.current = null;
                if (cancelled) return;
                setStepChoice(null);
                stepBodyRef.current?.focus();
              }, FOCUS_AFTER_APPROVE_MS);
            } else if (fresh.status === "revealed") {
              setAnnounce("Visit complete.");
              setStepChoice(null);
            }
          }
          if (freshFix && freshFix !== prev.fix && isTicketFix(freshFix)) {
            // D3/T2: the send-back names the fix and MOVES focus to the
            // returned-to step — without this a screen-reader user is
            // silently teleported mid-visit.
            setAnnounce(
              `${placeName} sent it back — ${FIX_COPY[freshFix].title}.`,
            );
            setStepChoice(null);
            stepBodyRef.current?.focus();
          }
        }
        lastSyncRef.current = { status: fresh.status, fix: freshFix };
      } catch {
        if (!cancelled) setPollMisses((n) => n + 1);
      }
    };
    void tick();
    const interval = window.setInterval(() => void tick(), pollMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      if (approveFocusTimer.current !== null) {
        window.clearTimeout(approveFocusTimer.current);
        approveFocusTimer.current = null;
      }
    };
  }, [supabase, ticketId, live, pollMs]);

  // The pass quotes the ENGINE's number (MESITA-1013/1014) — stamped with the
  // place it describes so it can never be attributed to another ticket.
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
        // The QR NEVER waits on the quote — only the Reward lanes do.
        if (!cancelled) setQuoteFail(quotePlaceId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quotePlaceId, supabase, seed, quoteReload]);
  const quote = quoteRes?.placeId === quotePlaceId ? quoteRes.quote : null;
  const quoteError = quoteFail === quotePlaceId && quote === null;

  // Step 1's pick. useStoredString keeps hydration on the SSR snapshot.
  const [storedPick, setStoredPick] = useStoredString(
    pickStorageKey(ticketId),
    "",
  );

  const scanned = ticket?.first_scanned_at != null;
  const [pulse, setPulse] = useState(false);
  const wasScannedRef = useRef(scanned);
  useEffect(() => {
    if (scanned && !wasScannedRef.current) {
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), SCAN_PULSE_MS);
      return () => window.clearTimeout(t);
    }
    wasScannedRef.current = scanned;
  }, [scanned]);

  const [sheet, setSheet] = useState<TaskSheet>(null);

  // ── Task submits (self-attested; the screenshot is the proof artifact). ──
  const confirmGoogle = useCallback(
    async (screenshotUrl: string) => {
      await apiSubmitReview(supabase, ticketId, screenshotUrl);
      await tickets.refresh();
    },
    [supabase, ticketId, tickets],
  );
  const confirmStory = useCallback(
    async (screenshotUrl: string) => {
      await apiSubmitStory(supabase, ticketId, screenshotUrl);
      await tickets.refresh();
    },
    [supabase, ticketId, tickets],
  );

  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState<TicketReviewDraft>({
    food: 0,
    service: 0,
    ambience: 0,
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
      setReviewError(errMsg(err, "Couldn't save your review."));
      return false;
    } finally {
      setReviewBusy(false);
    }
  }, [supabase, ticketId, reviewDraft]);

  // ── Bill save (step 1) → the EF prices everything server-side. ──────────
  const [billBusy, setBillBusy] = useState(false);
  const [billError, setBillError] = useState<string | null>(null);
  const saveBill = useCallback(
    async (bill: {
      subtotalCents: number;
      tipPct: number | null;
      tipCustomCents: number;
    }) => {
      setBillBusy(true);
      setBillError(null);
      try {
        const res = await apiSubmitTicketBill(supabase, ticketId, bill);
        setPolled((prev) =>
          prev ? { ...prev, ...res.ticket } : (res.ticket as ConsumerTicketRow),
        );
        await tickets.refresh();
        setStepChoice(null); // let the journey walk forward naturally
      } catch (err) {
        setBillError(errMsg(err, "Couldn't save the bill."));
      } finally {
        setBillBusy(false);
      }
    },
    [supabase, ticketId, tickets, setStepChoice],
  );

  // ── Pay (step 5): the ONE live path — the guest pays the place. ─────────
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const confirmAtPlace = useCallback(async () => {
    setPayBusy(true);
    setPayError(null);
    try {
      await apiSelectTicketPayment(supabase, ticketId, "at_place");
      const {
        ticket: fresh,
        visits: policy,
        settlement: rails,
      } = await apiGetTicket(supabase, ticketId);
      if (policy) setVisits(policy);
      if (rails) setSettlement(rails);
      setPolled(fresh);
      setStepChoice(null);
    } catch (err) {
      setPayError(errMsg(err, "Couldn't start the payment."));
    } finally {
      setPayBusy(false);
    }
  }, [supabase, ticketId, setStepChoice]);

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
      setReportError(errMsg(err, "Couldn't send that just yet."));
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
      router.push(CONSUMER_ROUTES.newVisit.root, { scroll: false });
    } catch {
      setCancelling(false);
    }
  }, [supabase, ticketId, tickets, router]);

  const waiting = ticket?.status === "scanned" && !ticket.fix_requested;

  if (tickets.status === "loading" && !ticket) {
    return <TicketSkeleton />;
  }

  // A failed list call is NOT a missing ticket: error → retry; only a
  // successful list that lacks the row gets "not found".
  if (!ticket && tickets.status === "error") {
    return (
      <Shell>
        <div className="surface-card flex flex-col items-center gap-3 rounded-2xl px-6 py-12 text-center">
          <span className="bg-muted text-muted-foreground grid size-12 place-items-center rounded-2xl">
            <XCircle className="size-6" />
          </span>
          <p className="text-foreground text-sm font-semibold">
            Couldn&apos;t load your ticket
          </p>
          <p className="text-muted-foreground max-w-[280px] text-xs leading-relaxed">
            Check your connection — your ticket is safe.
          </p>
          <Button
            type="button"
            onClick={tickets.retry}
            className="shadow-glow type-body mt-1 h-auto rounded-xl px-5 py-2.5 font-semibold"
          >
            Retry
          </Button>
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
          <p className="text-foreground text-sm font-semibold">
            Ticket not found
          </p>
          <p className="text-muted-foreground max-w-[280px] text-xs leading-relaxed">
            It may have been cancelled, or it belongs to another account.
          </p>
          <Button
            asChild
            className="shadow-glow type-body mt-1 h-auto rounded-xl px-5 py-2.5 font-semibold"
          >
            <Link href={CONSUMER_ROUTES.newVisit.root}>Back to Visit</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  const saved = ticket.status === "revealed";
  const cancelled = ticket.status === "cancelled";
  const placeName = ticket.place?.name ?? "Partner place";
  const photo = ticket.place?.photos?.[0] ?? null;
  const category = ticket.place?.category ?? null;

  // ── Money, read once (C4-6: the v4 readers key on the SUBTOTAL, and the
  //    payable number is the ONE formula — frozen at approval). ────────────
  const subtotalCents = ticket.bill_subtotal_cents ?? 0;
  const tipCents = ticket.tip_cents ?? 0;
  const tipPct = ticket.tip_pct ?? null;
  const discountCents = ticket.discount_cents ?? 0;
  const billedPct = ticket.discount_percent ?? 0;
  const billed = subtotalCents > 0;
  const amountDueCents =
    ticket.approved_amount_due_cents ??
    Math.max(0, subtotalCents - discountCents) + tipCents;

  const strategy = strategyForPlaceRow(ticket.place);
  const priced = strategy !== "zero";

  // ── Reward derivations (the engine is additive; earned actions keep
  //    paying whatever is picked next). ────────────────────────────────────
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const additive = quote?.additive ?? false;
  const welcomeBonus = quote?.bonuses.welcome ?? 0;
  const classBase = !quote
    ? 0
    : additive
      ? clamp(quote.base + welcomeBonus)
      : quote.base;

  const storyOnTicket =
    ticket.story_status != null && ticket.story_status !== "not_required";
  const reviewOnTicket =
    ticket.review_status != null && ticket.review_status !== "not_required";
  const persistedTask: ActionKind | null = storyOnTicket
    ? "story"
    : reviewOnTicket
      ? "google"
      : null;

  const localPick: RewardPick | null =
    storedPick === "review"
      ? "google"
      : storedPick === "base" ||
          storedPick === "story" ||
          storedPick === "google" ||
          storedPick === "mesita"
        ? storedPick
        : null;
  const pick: RewardPick | null = localPick ?? persistedTask;
  const chosenAction: ActionKind | null = pick === "base" ? null : pick;

  const storyVerified = taskStateFor(ticket.story_status) === "done";
  const googleVerified = taskStateFor(ticket.review_status) === "done";
  const mesitaVerified = reviewDone;
  const verifiedActions: ActionKind[] = [
    ...(storyVerified ? (["story"] as const) : []),
    ...(googleVerified ? (["google"] as const) : []),
    ...(mesitaVerified ? (["mesita"] as const) : []),
  ];
  const isVerified = (a: ActionKind): boolean =>
    a === "story"
      ? storyVerified
      : a === "google"
        ? googleVerified
        : mesitaVerified;

  const chosenState: TaskState =
    chosenAction === null
      ? "todo"
      : chosenAction === "mesita"
        ? reviewDone
          ? "done"
          : "todo"
        : taskStateFor(
            chosenAction === "story"
              ? ticket.story_status
              : ticket.review_status,
          );

  const actionBonus = (a: ActionKind | null): number =>
    !quote || a === null
      ? 0
      : a === "story"
        ? quote.bonuses.story
        : a === "google"
          ? quote.bonuses.google
          : quote.bonuses.mesita;
  const earnedExcept = (a: ActionKind | null): number =>
    !additive
      ? 0
      : verifiedActions
          .filter((v) => v !== a)
          .reduce((sum, v) => sum + actionBonus(v), 0);
  const base = !quote ? 0 : clamp(classBase + earnedExcept(null));
  const rateWith = (a: ActionKind): number =>
    !quote
      ? 0
      : additive
        ? clamp(classBase + earnedExcept(a) + actionBonus(a))
        : clamp(Math.max(classBase, actionBonus(a)));
  const selectedTotal = !quote
    ? 0
    : chosenAction
      ? rateWith(chosenAction)
      : base;
  const headlinePct = billed
    ? billedPct
    : chosenAction && chosenState !== "rejected"
      ? selectedTotal
      : base;

  const igConnected = Boolean(igHandle?.trim());
  const pickLocked =
    !live || ticket.status === "approved" || ticket.status === "paying";
  const storySelectable =
    Boolean(quote?.storyEligible) && igConnected && !pickLocked;
  const googleSelectable = (quote?.bonuses.google ?? 0) > 0 && !pickLocked;
  const mesitaSelectable =
    (quote?.bonuses.mesita ?? 0) > 0 && !reviewDone && !pickLocked;
  const selectableFor = (a: ActionKind): boolean =>
    a === "story"
      ? storySelectable
      : a === "google"
        ? googleSelectable
        : mesitaSelectable;

  const commitAction = (a: RewardPick) => {
    if (!pickLocked) setStoredPick(a);
  };
  const requestAction = (a: ActionKind) => {
    const next: RewardPick = pick === a ? "base" : a;
    const leavingRealWork =
      chosenAction !== null &&
      next !== chosenAction &&
      (chosenState === "done" || chosenState === "checking");
    if (leavingRealWork) {
      setPendingSwitch(a);
      return;
    }
    commitAction(next);
  };

  // ── The journey machine (pure, tested). ─────────────────────────────────
  const fix: TicketFix | null = isTicketFix(ticket.fix_requested)
    ? ticket.fix_requested
    : null;
  const journey: JourneyInput = {
    status: ticket.status,
    live,
    billed,
    priced,
    pickMade: pick !== null,
    hasAction: chosenAction !== null,
    actionDone: chosenState === "done",
    fix,
  };
  const step = resolveStep(journey, stepChoice);
  const goToStep = (id: TicketStepId) => setStepChoice(id);
  const amberStep = fix ? fixReturnStep(fix) : null;

  const capPesos = quote?.cap ?? null;
  const capApplied =
    quote != null &&
    billed &&
    discountCents > 0 &&
    subtotalCents > quote.cap * 100;

  const stubCode = ticket.check_code
    ? `#${ticket.check_code.slice(0, 4).toUpperCase()}`
    : "";

  return (
    <Shell>
      {/* Chrome row — place identity as chrome, the page's only title. */}
      <div className="flex shrink-0 items-center gap-2.5 px-0.5 pt-0.5 pb-1">
        <button
          type="button"
          onClick={() =>
            router.push(CONSUMER_ROUTES.newVisit.root, { scroll: false })
          }
          aria-label="Back to Visit"
          className="bg-muted text-foreground grid size-8 shrink-0 place-items-center rounded-full transition active:scale-95"
        >
          <ArrowLeft className="size-3.5" />
        </button>
        <div className="relative size-9 shrink-0 overflow-hidden rounded-xl">
          {photo ? (
            <Image src={photo} alt="" fill className="object-cover" />
          ) : (
            <div className="bg-pink-gradient grid h-full w-full place-items-center text-white/75">
              <Store className="size-4" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-foreground truncate text-lg leading-tight font-semibold tracking-tight">
            {placeName}
          </p>
          {category ? (
            <p className="text-muted-foreground type-meta truncate capitalize">
              {category.replaceAll("_", " ")}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            "type-meta shrink-0 rounded-full px-2 py-0.5 font-bold tracking-widest uppercase",
            saved
              ? "bg-emerald-500/10 text-emerald-700"
              : cancelled
                ? "bg-muted text-muted-foreground"
                : "bg-foreground/8 text-foreground/70",
          )}
        >
          {saved ? "Completed" : cancelled ? "Cancelled" : "Live"}
        </span>
      </div>

      {/* The seven-chip rail. An outstanding fix paints its step amber (D3). */}
      <div className="shrink-0 pt-0.5 pb-2">
        <JourneyRail
          currentId={step}
          amberId={amberStep}
          onSelect={goToStep}
          isReachable={(id) => stepReachable(journey, id)}
        />
      </div>

      {/* D3 — the send-back banner: amber, inline, names the FIX. The copy
          carries the whole message alone; colour is not the message. */}
      {fix ? (
        <div className="mb-2 shrink-0 rounded-xl bg-amber-500/12 px-3 py-2">
          <p className="text-xs leading-snug font-semibold text-amber-800">
            {placeName} sent it back — {FIX_COPY[fix].title.toLowerCase()}.
            {ticket.fix_note ? ` “${ticket.fix_note}”` : ""}
          </p>
        </div>
      ) : null}

      {/* THE one live region (T2). The elapsed clock never enters it. */}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {/* Step body — the only part that scrolls. */}
      <div
        ref={stepBodyRef}
        tabIndex={-1}
        className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pt-2 outline-none"
      >
        {step === "bill" ? (
          <StepBill
            key={`${subtotalCents}-${tipCents}`}
            initialSubtotalCents={billed ? subtotalCents : null}
            initialTipPct={billed ? tipPct : undefined}
            initialTipCents={billed ? tipCents : null}
            busy={billBusy}
            error={billError}
            fixActive={fix === "bill"}
            tipEnabled={visits?.tipEnabled ?? true}
            tipPresets={visits?.tipPresets ?? [10, 15, 20]}
            defaultTipPct={visits?.defaultTipPct ?? 15}
            onSave={saveBill}
          />
        ) : null}

        {step === "reward" ? (
          <RewardLanes
            quote={quote}
            quoteError={quoteError}
            onRetryQuote={() => setQuoteReload((k) => k + 1)}
            onShowQrAnyway={() => {
              if (!pickLocked) setStoredPick("base");
              goToStep("qr");
            }}
            classKey={classKey}
            igConnected={igConnected}
            pick={pick}
            chosenAction={chosenAction}
            isFirstVisit={quote?.isFirstVisit ?? false}
            verified={isVerified}
            selectableFor={selectableFor}
            onPick={requestAction}
            base={base}
            selectedTotal={selectedTotal}
            actionBonus={actionBonus}
            capPesos={capPesos}
          />
        ) : null}

        {step === "task" ? (
          chosenAction === null ? (
            <div className="border-border bg-card flex flex-col items-center gap-2 rounded-2xl border px-4 py-6 text-center">
              <p className="font-display text-foreground text-base leading-tight font-bold">
                No task on this ticket
              </p>
              <p className="text-muted-foreground max-w-[300px] text-xs leading-relaxed">
                You didn&apos;t pick a bonus, so there&apos;s nothing to do
                here. {placeName} still honours your {base}%.
              </p>
              <button
                type="button"
                onClick={() => goToStep("reward")}
                className="border-border text-foreground type-body mt-1 flex min-h-11 w-full items-center justify-center rounded-full border font-bold"
              >
                Pick a bonus
              </button>
            </div>
          ) : chosenAction === "mesita" ? (
            <div className="flex flex-col gap-3 pt-1">
              <div className="surface-card rounded-2xl px-4 py-4">
                <TicketReviewForm
                  draft={reviewDraft}
                  onChange={setReviewDraft}
                  onSubmit={() =>
                    void (async () => {
                      const ok = await submitMesitaReview();
                      if (ok) goToStep("qr");
                    })()
                  }
                  busy={reviewBusy}
                  placeName={placeName}
                  error={reviewError}
                />
              </div>
              <button
                type="button"
                onClick={() => goToStep("qr")}
                className="text-muted-foreground hover:text-foreground mx-auto flex min-h-11 items-center text-xs font-semibold transition"
              >
                I&apos;ll finish this in a bit — show my QR
              </button>
            </div>
          ) : (
            <TaskProof
              kind={chosenAction === "story" ? "story" : "review"}
              ticketId={ticketId}
              placeName={placeName}
              placeAddress={ticket.place?.address}
              rate={selectedTotal}
              rejected={chosenState === "rejected"}
              onConfirm={
                chosenAction === "story" ? confirmStory : confirmGoogle
              }
              onDone={() => goToStep("qr")}
              onSkip={() => goToStep("qr")}
            />
          )
        ) : null}

        {step === "qr" ? (
          <>
            {/* THE PASS — persists through every sub-state (F1): unscanned →
                waiting → fix. Removing it mid-wait reads as something being
                taken away, and a second waiter may re-scan. */}
            <TicketHero
              className={cn(
                "px-4 pt-3.5 pb-3.5",
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
                    <span className="block truncate text-xs leading-tight font-bold">
                      {guestName ?? "Mesita guest"}
                    </span>
                    {igHandle ? (
                      <span className="type-meta block truncate leading-tight text-white/75">
                        @{igHandle.replace(/^@/, "")}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="type-meta shrink-0 rounded-full bg-white/22 px-2 py-0.5 font-bold tracking-widest uppercase">
                  {classProperLabel(classKey)}
                </span>
              </div>

              <div className="mt-2 text-center">
                {priced && headlinePct > 0 ? (
                  <p className="font-display text-[clamp(30px,9vw,38px)] leading-none font-bold tracking-tight">
                    {headlinePct}% off
                  </p>
                ) : (
                  <p className="mx-auto max-w-[30ch] text-xs leading-snug font-semibold text-white/90">
                    Your discount is set by the place and applied at the table.
                  </p>
                )}
              </div>

              <div className="shadow-glow-sm mx-auto mt-2.5 w-full max-w-[min(170px,48vw)] rounded-2xl bg-white p-2.5">
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

              <p className="mx-auto mt-2 flex max-w-[34ch] items-center justify-center gap-1.5 text-center text-xs leading-snug text-white/90">
                {waiting ? (
                  <>
                    <BadgeCheck className="size-3.5 shrink-0" />
                    Scanned — it&apos;s open on their screen.
                  </>
                ) : fix ? (
                  <>Fix it below — their screen updates live, no new QR.</>
                ) : (
                  <>
                    Show this to your server. The scan just opens your ticket on
                    their side.
                  </>
                )}
              </p>
              {waiting ? (
                <ElapsedWaiting iso={ticket.first_scanned_at} />
              ) : capPesos && priced ? (
                <p className="mt-1 text-center text-xs text-white/75">
                  Capped at MX${capPesos.toLocaleString("en-US")} off.
                </p>
              ) : null}

              <div className="mt-3 border-t-2 border-dashed border-white/35 pt-2">
                <div className="type-meta flex items-center justify-between gap-3 font-semibold text-white/90">
                  <span>Ticket {stubCode}</span>
                  <span>
                    {chosenAction
                      ? chosenState === "done"
                        ? `${ACTION_SHORT[chosenAction]} ✓`
                        : `${ACTION_SHORT[chosenAction]} pending`
                      : "No task — base rate"}
                  </span>
                </div>
              </div>
            </TicketHero>

            {/* What staff see at a glance — the F3 receipt, the guest's last
                chance to catch a wrong bill while they wait. */}
            <div className="flex flex-col gap-1.5">
              <MoneyRow label="Bill" value={formatCurrency(subtotalCents)} />
              <MoneyRow
                label={tipPct === null ? "Tip" : `Tip · ${tipPct}%`}
                sub={
                  tipPct !== null
                    ? `${tipPct}% of ${formatCurrency(subtotalCents)}, before the discount`
                    : undefined
                }
                value={formatCurrency(tipCents)}
              />
              <MoneyRow
                label={`Discount · ${billedPct}%`}
                sub={
                  capApplied && capPesos
                    ? `Applies to your first MX$${capPesos.toLocaleString("en-US")}`
                    : undefined
                }
                value={`− ${formatCurrency(discountCents)}`}
              />
              <MoneyRow
                label="Estimated total"
                value={formatCurrency(amountDueCents)}
              />
              <MoneyRow
                label="Proof"
                value={
                  chosenAction
                    ? chosenState === "done"
                      ? "Uploaded"
                      : "Missing"
                    : "Not needed"
                }
              />
              <TipHonesty subtotalCents={subtotalCents} tipPct={tipPct} />
            </div>

            {waiting ? (
              <div className="border-border rounded-2xl border border-dashed p-3">
                <p className="text-muted-foreground type-meta font-bold tracking-[0.12em] uppercase">
                  Mesita Validate · staff side
                </p>
                <p className="text-muted-foreground mt-1 text-xs leading-snug">
                  {placeName} sees bill, tip, reward and proof at a glance —
                  they approve it or send back one specific fix. Two touches,
                  nothing to operate.
                </p>
              </div>
            ) : null}

            {pollMisses >= 3 && live ? (
              <p className="text-muted-foreground text-center text-xs">
                Can&apos;t reach Mesita right now — your ticket is still valid.
              </p>
            ) : null}

            {live &&
            (ticket.status === "open" || ticket.status === "scanned") ? (
              <button
                type="button"
                onClick={() => goToStep("bill")}
                className="text-muted-foreground hover:text-foreground mx-auto flex min-h-11 items-center text-xs font-semibold transition"
              >
                Need to change something?
              </button>
            ) : null}
          </>
        ) : null}

        {step === "pay" ? (
          <StepPay
            placeName={placeName}
            pct={billedPct}
            subtotalCents={subtotalCents}
            tipCents={tipCents}
            tipPct={tipPct}
            discountCents={ticket.approved_discount_cents ?? discountCents}
            amountDueCents={amountDueCents}
            busy={payBusy}
            error={payError}
            cardRailAvailable={settlement?.cardRail ?? false}
            onConfirmAtPlace={() => void confirmAtPlace()}
          />
        ) : null}

        {step === "validate" ? <StepValidate placeName={placeName} /> : null}

        {step === "results" ? (
          <>
            <StepResults
              passClassName={passGradient(classKey)}
              classLabel={classProperLabel(classKey)}
              placeName={placeName}
              cancelled={cancelled}
              revealed={saved}
              savedCents={discountCents}
              pct={billedPct}
              subtotalCents={subtotalCents}
              tipCents={tipCents}
              tipPct={tipPct}
              paidCents={amountDueCents}
              paidMethodLabel={
                ticket.paid_method && ticket.paid_method in PAY_METHOD_LABEL
                  ? PAY_METHOD_LABEL[
                      ticket.paid_method as keyof typeof PAY_METHOD_LABEL
                    ]
                  : null
              }
              capPesos={capPesos}
              capApplied={capApplied}
            />
            {!cancelled ? (
              <RateVisitRow
                done={reviewDone}
                onOpen={() => {
                  setReviewError(null);
                  setSheet("mesita");
                }}
              />
            ) : null}
          </>
        ) : null}
      </div>

      {/* Reward step's pinned commit — always visible, rows scroll under. */}
      {step === "reward" && quote !== null && !quoteError ? (
        <div className="shrink-0 pt-2">
          <Button
            type="button"
            size="lg"
            onClick={() => {
              if (!pickLocked) setStoredPick(pick ?? "base");
              goToStep(chosenAction && chosenState !== "done" ? "task" : "qr");
            }}
            className="shadow-glow w-full text-sm font-bold"
          >
            {chosenAction && chosenState !== "done"
              ? `Do the task · ${selectedTotal}%`
              : `Show my QR at ${selectedTotal || base}%`}
          </Button>
        </div>
      ) : null}

      {/* Utility row — housekeeping only, one quiet line. Guest self-cancel
          ends at approval (§12): after that, walking away is the place's
          call. */}
      <div className="flex shrink-0 items-center justify-center gap-2.5 pt-2">
        {ticket.status === "open" || ticket.status === "scanned" ? (
          <button
            type="button"
            onClick={() => void cancel()}
            disabled={cancelling}
            className="text-muted-foreground hover:text-foreground flex min-h-11 items-center gap-1.5 text-xs font-semibold transition"
          >
            {cancelling ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Cancel ticket
          </button>
        ) : null}
        {(ticket.status === "open" || ticket.status === "scanned") &&
        !cancelled ? (
          <span aria-hidden="true" className="text-muted-foreground/40 text-xs">
            ·
          </span>
        ) : null}
        {!cancelled && (visits?.reportEnabled ?? true) ? (
          reported ? (
            <p className="text-muted-foreground flex min-h-11 items-center text-xs font-semibold">
              Reported — Mesita is looking at it
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setSheet("report")}
              className="text-muted-foreground hover:text-foreground flex min-h-11 items-center text-xs font-semibold transition"
            >
              Report a problem
            </button>
          )
        ) : null}
      </div>

      {pendingSwitch && chosenAction ? (
        <ChangeBonusDialog
          from={ACTION_SHORT[chosenAction]}
          to={ACTION_SHORT[pendingSwitch]}
          earned={isVerified(chosenAction)}
          onCancel={() => setPendingSwitch(null)}
          onConfirm={() => {
            commitAction(pendingSwitch);
            setPendingSwitch(null);
          }}
        />
      ) : null}

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
            <p className="text-foreground text-sm font-bold tracking-tight">
              What went wrong at {placeName}?
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
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
                  <span className="text-foreground type-body block font-bold">
                    {r.label}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">
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
            className={cn(
              TEXTAREA_CLASS,
              "focus:border-foreground type-body rounded-2xl px-3.5 py-3",
            )}
          />

          {reportError ? (
            <p className={ERROR_BOX_CLASS}>{reportError}</p>
          ) : null}

          <Button
            type="button"
            size="lg"
            disabled={!reportReason || reportBusy}
            onClick={() => void submitReport()}
            className="shadow-glow w-full text-sm font-bold disabled:opacity-50"
          >
            {reportBusy ? <Loader2 className="size-4 animate-spin" /> : null}
            Send report
          </Button>
        </div>
      </LocalSheet>
    </Shell>
  );
}

// ── The Reward step — the lanes (mock design over REAL quote numbers). ─────
function RewardLanes({
  quote,
  quoteError,
  onRetryQuote,
  onShowQrAnyway,
  classKey,
  igConnected,
  pick,
  chosenAction,
  isFirstVisit,
  verified,
  selectableFor,
  onPick,
  base,
  selectedTotal,
  actionBonus,
  capPesos,
}: {
  quote: RewardQuote | null;
  quoteError: boolean;
  onRetryQuote: () => void;
  onShowQrAnyway: () => void;
  classKey: string;
  igConnected: boolean;
  pick: RewardPick | null;
  chosenAction: ActionKind | null;
  isFirstVisit: boolean;
  verified: (a: ActionKind) => boolean;
  selectableFor: (a: ActionKind) => boolean;
  onPick: (a: ActionKind) => void;
  base: number;
  selectedTotal: number;
  actionBonus: (a: ActionKind | null) => number;
  capPesos: number | null;
}) {
  void pick;
  if (quoteError) {
    return (
      <div className="flex flex-col items-center gap-2 pt-1">
        <p className={cn(ERROR_BOX_CLASS, "w-full text-center")}>
          Couldn&apos;t load your rates here.
        </p>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={onRetryQuote}
            className="text-primary flex min-h-11 items-center text-xs font-semibold"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={onShowQrAnyway}
            className="text-muted-foreground hover:text-foreground flex min-h-11 items-center text-xs font-semibold"
          >
            Show my QR anyway
          </button>
        </div>
      </div>
    );
  }
  if (!quote) {
    return (
      <div className="flex flex-col gap-2 pt-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="border-border bg-card h-[52px] animate-pulse rounded-2xl border"
          />
        ))}
      </div>
    );
  }

  const b = quote.breakdown ?? null;
  const welcome = quote.bonuses.welcome;
  const classGlyph = (k: "bronze" | "silver" | "gold" | "diamond") => {
    const Icon =
      k === "diamond"
        ? Gem
        : k === "gold"
          ? Crown
          : k === "silver"
            ? Medal
            : Award;
    return <Icon className="text-primary size-3.5" />;
  };
  const classLabel = (k: string) => classProperLabel(k);
  const myCls = b?.cls ?? null;
  const myPlan = b?.plan ?? "free";

  // Result line: earned terms only, in the mock's order.
  const parts: string[] = [];
  if (b) {
    if (myCls && b.classes[myCls] > 0) parts.push(`${b.classes[myCls]}% class`);
    if (b.automatic > 0) parts.push(`${b.automatic}% automatic`);
    if (myPlan === "premium" && b.planUplift > 0)
      parts.push(`${b.planUplift}% plan`);
  } else if (quote.base > 0) {
    parts.push(`${quote.base}% base`);
  }
  if (welcome > 0) parts.push(`${welcome}% welcome`);
  if (chosenAction && actionBonus(chosenAction) > 0)
    parts.push(`${actionBonus(chosenAction)}% sharing`);

  return (
    <div className="flex flex-col gap-1.5">
      {/* PAYOUT — how it lands. The Yums payout is STAGED: rendered so the
          shape is real, never selectable, never paid. */}
      <Lane title="Payout" note="how it lands">
        <LaneChip label="Discount" sub="off tonight's bill" value={null} on />
        <LaneChip label="Yums" sub="coming soon" value={null} faded />
      </Lane>

      {b ? (
        <>
          <Lane title="Base discount" note="always on">
            <LaneChip
              label="Automatic"
              sub="standing offer"
              value={b.automatic}
              on={b.automatic > 0}
              glyph={<Zap className="text-primary size-3.5" />}
            />
          </Lane>

          <Lane title="Visit" note="where you stand">
            <LaneChip
              label="Welcome"
              sub={
                welcome > 0
                  ? "your first visit here"
                  : isFirstVisit
                    ? "not offered here"
                    : "first visit only"
              }
              value={welcome}
              on={welcome > 0}
              faded={welcome === 0}
              glyph={<Sparkles className="text-primary size-3.5" />}
            />
            <LaneChip
              label="Return"
              sub={isFirstVisit ? "return visits" : "thanks for coming back"}
              value={null}
              on={!isFirstVisit}
              faded={isFirstVisit}
              glyph={<RefreshCw className="text-primary size-3.5" />}
            />
          </Lane>

          <Lane title="Class" note="earned, not bought">
            {(["bronze", "silver", "gold", "diamond"] as const).map((k) => (
              <LaneChip
                key={k}
                label={classLabel(k)}
                sub={k === myCls ? "you" : "locked"}
                value={b.classes[k]}
                on={k === myCls}
                faded={k !== myCls}
                glyph={classGlyph(k)}
              />
            ))}
          </Lane>

          <Lane title="Plan" note="visits and orders">
            <LaneChip
              label="Free"
              sub={myPlan === "free" ? "yours" : "not active"}
              value={0}
              on={myPlan === "free"}
              faded={myPlan !== "free"}
              glyph={<Star className="text-muted-foreground size-3.5" />}
            />
            <LaneChip
              label="Premium"
              sub={myPlan === "premium" ? "yours" : "not active"}
              value={b.planUplift}
              on={myPlan === "premium"}
              faded={myPlan !== "premium"}
              glyph={<Crown className="text-primary size-3.5" />}
            />
          </Lane>
        </>
      ) : (
        <Lane title="Base discount" note="always on">
          <LaneChip
            label={`Your ${classLabel(classKey)} base`}
            sub="standing offer"
            value={quote.base}
            on={quote.base > 0}
            glyph={<Zap className="text-primary size-3.5" />}
          />
          {welcome > 0 ? (
            <LaneChip
              label="Welcome"
              sub="your first visit here"
              value={welcome}
              on
              glyph={<Sparkles className="text-primary size-3.5" />}
            />
          ) : null}
        </Lane>
      )}

      <Lane title="Sharing" note="pick one">
        {(["story", "google", "mesita"] as const).map((a) => {
          const available =
            a === "story"
              ? Boolean(quote.storyEligible) && igConnected
              : actionBonus(a) > 0;
          return (
            <LaneChip
              key={a}
              label={ACTION_SHORT[a]}
              sub={
                !available
                  ? a === "story" && !igConnected && quote.storyEligible
                    ? "connect Instagram in Me"
                    : "unavailable"
                  : verified(a)
                    ? "done"
                    : chosenAction === a
                      ? "tap to drop"
                      : "tap to add"
              }
              value={available ? actionBonus(a) : 0}
              on={chosenAction === a}
              faded={!available}
              done={verified(a)}
              glyph={
                a === "story" ? (
                  <InstagramGlyph className="size-3.5" />
                ) : a === "google" ? (
                  <GoogleGlyph className="size-3.5" />
                ) : (
                  <MesitaGlyph className="size-3.5" />
                )
              }
              onClick={selectableFor(a) ? () => onPick(a) : undefined}
            />
          );
        })}
      </Lane>

      <div className="border-border bg-card overflow-hidden rounded-2xl border">
        <div className="bg-muted/40 flex items-baseline justify-between gap-2 px-3 py-1.5">
          <span className="text-muted-foreground type-meta font-bold tracking-[0.12em] uppercase">
            Result
          </span>
          <span className="text-muted-foreground type-meta font-semibold">
            live
          </span>
        </div>
        <div className="flex items-end justify-between gap-3 px-2.5 py-1.5">
          <span className="text-muted-foreground type-meta min-w-0 leading-snug font-semibold tabular-nums">
            {parts.length > 0
              ? parts.join(" + ")
              : "Nothing on this ticket yet"}
          </span>
          <span className="font-display text-primary shrink-0 text-2xl leading-none font-bold tabular-nums">
            {selectedTotal || base}%
          </span>
        </div>
        {capPesos ? (
          <div className="border-border border-t px-2.5 py-1.5">
            <div className="flex items-center gap-2 rounded-xl bg-amber-500/[0.08] px-2 py-1.5">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-700">
                !
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-xs leading-tight font-bold">
                  Capped at MX${capPesos.toLocaleString("en-US")} off your bill
                </p>
                <p className="text-muted-foreground type-meta mt-0.5 leading-snug">
                  This percentage is limited to this amount.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Switching away from work the guest actually did. The warning is TRUE, not
// scary: the engine is additive over every verified action, so an earned
// bonus keeps paying whatever they pick next.
function ChangeBonusDialog({
  from,
  to,
  earned,
  onCancel,
  onConfirm,
}: {
  from: string;
  to: string;
  earned: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <LocalDialog open onClose={onCancel} ariaLabel="Change your bonus">
      <div className="flex flex-col gap-3 px-5 pt-5 pb-5">
        <span className="bg-secondary/10 text-secondary grid size-10 place-items-center rounded-2xl">
          <AlertTriangle className="size-5" />
        </span>
        <div>
          <p className="text-foreground text-sm font-bold tracking-tight">
            Switch to the {to}?
          </p>
          <p className="text-muted-foreground mt-1 text-xs leading-snug">
            {earned ? (
              <>
                You already finished the {from} — that bonus stays on this
                ticket and still counts at the bill. Switching only changes what
                you do next.
              </>
            ) : (
              <>
                Your {from} is still in progress. Switching sets it aside and
                starts the {to} from scratch.
              </>
            )}
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          onClick={onConfirm}
          className="shadow-glow type-body min-h-11 w-full font-bold"
        >
          Switch to the {to}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground mx-auto flex min-h-11 items-center text-xs font-semibold transition"
        >
          Keep the {from}
        </button>
      </div>
    </LocalDialog>
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
              : "bg-muted/60 text-muted-foreground",
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
              "type-body block leading-tight font-bold",
              done ? "text-emerald-800" : "text-foreground",
            )}
          >
            {done ? "Thanks — visit rated" : "Rate your visit"}
          </span>
          <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
            {done
              ? "It feeds this place's Mesita rating."
              : "Food · service · ambience — feeds its rating"}
          </span>
        </span>
        {!done ? <Star className="text-foreground/60 size-4 shrink-0" /> : null}
      </button>
    </section>
  );
}

// The waiting clock (F1) — re-renders every 15s, aria-hidden throughout so
// VoiceOver never announces a ticking number for ten minutes. State updates
// happen only inside async callbacks (rAF + interval), which keeps the
// React Compiler's purity rules satisfied.
function ElapsedWaiting({ iso }: { iso: string | null | undefined }) {
  const [mins, setMins] = useState<number | null>(null);
  useEffect(() => {
    if (!iso) return;
    const compute = () =>
      setMins(
        Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)),
      );
    const raf = window.requestAnimationFrame(compute);
    const interval = window.setInterval(compute, WAITING_TICK_MS);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearInterval(interval);
    };
  }, [iso]);
  return (
    <p className="type-meta mt-1 text-center text-white/75">
      <span
        aria-hidden="true"
        className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-white/90 motion-reduce:animate-none"
      />
      <span aria-hidden="true">
        {mins == null || mins < 1 ? "just now" : `waiting ${mins} min`}
      </span>
      {mins != null && mins >= 5 ? (
        <span className="block">
          Taking a while? Ask them to scan it again — this code doesn&apos;t
          expire.
        </span>
      ) : null}
    </p>
  );
}

// THE TICKET is a FULL PAGE — a real route, bg-background ground; scroll
// lives in the STEP BODY so chrome, rail and footer stay put.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col px-4 pt-3 pb-3">
      {children}
    </div>
  );
}

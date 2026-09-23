// THE TICKET v4 (MESITA-1094) — mobile mirror of web's seven-step journey:
// Bill · Reward · Task · QR · Pay · Validate · Results. The guest does five,
// the restaurant does one. Product law: apps/web-consumer TicketScreen.tsx —
// this file carries the same machine (lib/ticket-journey.ts, byte-identical,
// drift-tested from web), the same money rules (tip pre-discount, ONE
// amount-due formula mirrored off approved_amount_due_cents), the same F1
// waiting states, the same D3 send-back, and the same staged Pay rows
// (card-through-Mesita + Credits render, never charge).
//
// Live sync = consumer-web-get-ticket polled at 10s while the app is active
// (AppState is native's visibilitychange). Realtime stays off tickets.

import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Check,
  CreditCard,
  Gem,
  Gift,
  PartyPopper,
  RefreshCw,
  Sparkles,
  Star,
  Store,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";

import {
  TicketReviewForm,
  type TicketReviewDraft,
} from "@/components/rewards/TicketReviewForm";
import { DefaultAvatar } from "@/components/ui/DefaultAvatar";
import { FullScreenSheet } from "@/components/ui/FullScreenSheet";
import { COLORS, GRADIENTS } from "@/constants/brand";
import { formatCurrency, submitTicketReview } from "@/lib/api/pay";
import {
  ACTIVE_TICKET_STATES,
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
  type ReportReason,
  type RewardQuote,
} from "@/lib/api/tickets";
import { diamondLabelForClass, isDiamond } from "@/lib/consumer-classes";
import {
  BASE_RATE_HINT,
  BASE_RATE_LABEL,
  DIAMOND,
} from "@/lib/consumer-identity";
import { identityRateRows } from "@/lib/reward-segments";
import { useConsumerTickets } from "@/lib/hooks/useConsumerTickets";
import { useStoredString } from "@/lib/local-store";
import { strategyForPlaceRow } from "@/lib/promo-rates";
import { pickProofScreenshot, uploadTicketProof } from "@/lib/ticket-proofs";
import {
  FIX_COPY,
  TICKET_STEPS,
  fixReturnStep,
  isTicketFix,
  resolveStep,
  stepIndex,
  stepReachable,
  type JourneyInput,
  type TicketFix,
  type TicketStepId,
} from "@/lib/ticket-journey";
import { useAuth } from "@/providers/auth";
import { cn } from "@/lib/utils";

// Pass gradients: Diamond or not (MESITA-2044). RESERVED
// (MESITA-1954): Diamond is something the product NAMES OUT LOUD to the
// guest — and the pass is the object a member holds up at the table — so its
// blue keeps its hue (web's pinned #0072a0, where GRADIENTS.influencer
// lands). Everyone else holds the bronze-stop pass it always had; the silver
// and gold passes went with the ladder.
const PASS_GRADIENTS: Record<string, readonly [string, string, string]> = {
  diamond: ["#2ab3e8", ...GRADIENTS.influencer],
  bronze: ["#c9834f", "#b4703f", "#954c28"],
};
function passColors(key: string): readonly [string, string, string] {
  return PASS_GRADIENTS[key] ?? PASS_GRADIENTS.bronze;
}

// Where "Open Google" lands: a Maps search on the place. Lifted from the
// retired GoogleReviewSheet when the task moved into the journey (v4).
function googleMapsSearchUrl(placeName: string, address?: string | null) {
  const q = [placeName, address].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    q || "restaurant",
  )}`;
}

type TaskState = "todo" | "busy" | "checking" | "done" | "rejected";
function taskStateFor(v: string | null | undefined): TaskState {
  if (v == null || v === "not_required" || v === "pending") return "todo";
  if (v === "submitted") return "checking";
  if (v === "ai_rejected" || v === "staff_rejected") return "rejected";
  return "done";
}

function pickStorageKey(ticketId: string): string {
  return `mesita.ticket.reward.${ticketId}`;
}

type ActionKind = "story" | "google" | "mesita";
type RewardPick = ActionKind | "base";

const ACTION_SHORT: Record<ActionKind, string> = {
  story: "Instagram story",
  google: "Google review",
  mesita: "Mesita review",
};

const PAY_METHOD_LABEL: Record<string, string> = {
  at_place: "Paid at the place",
  mesita: "Card through Mesita",
};

const TIP_PRESETS = [10, 15, 20] as const;
const DEFAULT_TIP_PCT = 15;
/** Mirror of the server's tip formula (C4) — preview only; the EF binds. */
function previewTipCents(subtotalCents: number, pct: number): number {
  return Math.round((subtotalCents * pct) / 10000) * 100;
}

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

export function TicketScreen({
  userId,
  ticketId,
}: {
  userId: string;
  ticketId: string;
}) {
  const router = useRouter();
  const tickets = useConsumerTickets(userId);
  const { consumerClass, profile } = useAuth();
  // Diamond or not — the only identity the pass shows. The
  // stored key is LEGACY after the auth provider's bridge; `listLabel` is
  // "Diamond" or null (no pill: there is no rung to print).
  const legacyKey = consumerClass?.class ?? "standard";
  const onList = isDiamond(legacyKey);
  const classKey = onList ? "diamond" : "bronze";
  const listLabel = diamondLabelForClass(legacyKey);
  const guestName =
    profile?.full_name?.trim() ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "Mesita guest";
  const igHandle = profile?.instagram_handle ?? null;
  const avatarUrl = profile?.avatar_url ?? null;

  const [polled, setPolled] = useState<ConsumerTicketRow | null>(null);
  const listTicket = useMemo(
    () =>
      tickets.active.find((t) => t.id === ticketId) ??
      tickets.history.find((t) => t.id === ticketId) ??
      null,
    [tickets.active, tickets.history, ticketId],
  );
  const ticket = useMemo(
    () => freshest(listTicket, polled),
    [listTicket, polled],
  );
  const live = ticket ? ACTIVE_TICKET_STATES.has(ticket.state) : false;

  // Declared before the poll effect below, which drives it on staff
  // transitions (approve → auto-advance, send-back → returned step).
  const [stepChoice, setStepChoice] = useState<TicketStepId | null>(null);
  const [announce, setAnnounce] = useState("");
  const lastSyncRef = useRef<{ state: string | null; fix: string | null }>({
    state: null,
    fix: null,
  });
  const [pollMisses, setPollMisses] = useState(0);

  // ── The guest side of the handshake: 10s poll while live + app active. ──
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    const tick = async () => {
      if (AppState.currentState !== "active") return;
      try {
        const { ticket: fresh } = await apiGetTicket(ticketId);
        if (cancelled) return;
        setPolled(fresh);
        setPollMisses(0);
        const prev = lastSyncRef.current;
        const freshFix = fresh.fix_requested ?? null;
        const placeName = fresh.place?.name ?? "the place";
        if (prev.state !== null) {
          if (fresh.state !== prev.state) {
            if (fresh.state === "scanned" && !freshFix) {
              setAnnounce(`Scanned. Waiting for ${placeName} to approve.`);
            } else if (fresh.state === "approved") {
              setAnnounce(`Approved by ${placeName}.`);
              setTimeout(() => {
                if (!cancelled) setStepChoice(null);
              }, 900);
            } else if (fresh.state === "revealed") {
              setAnnounce("Visit complete.");
              setStepChoice(null);
            }
          }
          if (freshFix && freshFix !== prev.fix && isTicketFix(freshFix)) {
            setAnnounce(
              `${placeName} sent it back — ${FIX_COPY[freshFix].title}.`,
            );
            setStepChoice(null);
          }
        }
        lastSyncRef.current = { state: fresh.state, fix: freshFix };
      } catch {
        if (!cancelled) setPollMisses((n) => n + 1);
      }
    };
    void tick();
    const interval = setInterval(() => void tick(), 10_000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void tick();
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
    };
  }, [ticketId, live]);

  // Quote — stamped with the place it describes.
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
        const { quote } = await apiGetRewardQuote(quotePlaceId);
        if (!cancelled) {
          setQuoteRes({ placeId: quotePlaceId, quote });
          setQuoteFail(null);
        }
      } catch {
        if (!cancelled) setQuoteFail(quotePlaceId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quotePlaceId, quoteReload]);
  const quote = quoteRes?.placeId === quotePlaceId ? quoteRes.quote : null;
  const quoteError = quoteFail === quotePlaceId && quote === null;

  const [storedPick, setStoredPick] = useStoredString(
    pickStorageKey(ticketId),
    "",
  );

  // Task/proof state.
  const [proofBusy, setProofBusy] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
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
  const [sheet, setSheet] = useState<"mesita" | "report" | null>(null);

  const [billBusy, setBillBusy] = useState(false);
  const [billError, setBillError] = useState<string | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason | null>(null);
  const [reportDetails, setReportDetails] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reported, setReported] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const goBack = useCallback(() => {
    router.push("/(tabs)/rewards");
  }, [router]);

  const submitMesitaReview = useCallback(async (): Promise<boolean> => {
    setReviewBusy(true);
    setReviewError(null);
    try {
      await submitTicketReview({ ticketId, ...reviewDraft });
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
  }, [ticketId, reviewDraft]);

  const saveBill = useCallback(
    async (bill: {
      subtotalCents: number;
      tipPct: number | null;
      tipCustomCents: number;
    }) => {
      setBillBusy(true);
      setBillError(null);
      try {
        const res = await apiSubmitTicketBill(ticketId, bill);
        setPolled((prev) =>
          prev ? { ...prev, ...res.ticket } : (res.ticket as ConsumerTicketRow),
        );
        void tickets.refresh();
        setStepChoice(null);
      } catch (err) {
        setBillError(
          err instanceof Error ? err.message : "Couldn't save the bill.",
        );
      } finally {
        setBillBusy(false);
      }
    },
    [ticketId, tickets, setStepChoice],
  );

  const confirmAtPlace = useCallback(async () => {
    setPayBusy(true);
    setPayError(null);
    try {
      await apiSelectTicketPayment(ticketId, "at_place");
      const { ticket: fresh } = await apiGetTicket(ticketId);
      setPolled(fresh);
      setStepChoice(null);
    } catch (err) {
      setPayError(
        err instanceof Error ? err.message : "Couldn't start the payment.",
      );
    } finally {
      setPayBusy(false);
    }
  }, [ticketId, setStepChoice]);

  const submitProof = useCallback(
    async (action: "story" | "google") => {
      setProofBusy(true);
      setProofError(null);
      try {
        const asset = await pickProofScreenshot();
        if (!asset) return;
        const url = await uploadTicketProof(userId, ticketId, asset);
        if (action === "story") await apiSubmitStory(ticketId, url);
        else await apiSubmitReview(ticketId, url);
        await tickets.refresh();
        setStepChoice("qr");
      } catch (err) {
        setProofError(
          err instanceof Error ? err.message : "Couldn't send the proof.",
        );
      } finally {
        setProofBusy(false);
      }
    },
    [userId, ticketId, tickets, setStepChoice],
  );

  const submitReport = useCallback(async () => {
    if (!reportReason) return;
    setReportBusy(true);
    try {
      await apiReportTicket(ticketId, reportReason, reportDetails);
      setReported(true);
      setSheet(null);
    } catch {
      // The sheet keeps its state; the guest can retry.
    } finally {
      setReportBusy(false);
    }
  }, [ticketId, reportReason, reportDetails]);

  const cancel = useCallback(async () => {
    setCancelling(true);
    try {
      await apiCancelTicket(ticketId);
      await tickets.refresh();
      goBack();
    } catch {
      setCancelling(false);
    }
  }, [ticketId, tickets, goBack]);

  if (tickets.state === "loading" && !ticket) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <XCircle size={28} color={COLORS.mutedForeground} />
        <Text
          className="mt-2 font-semibold text-foreground"
          style={{ fontSize: 15 }}
        >
          {tickets.state === "error"
            ? "Couldn't load your ticket"
            : "Ticket not found"}
        </Text>
        <Pressable
          onPress={tickets.state === "error" ? tickets.retry : goBack}
          className="mt-3 rounded-xl bg-primary px-5 py-2.5"
        >
          <Text className="font-semibold text-white" style={{ fontSize: 13 }}>
            {tickets.state === "error" ? "Retry" : "Back to Visit"}
          </Text>
        </Pressable>
      </View>
    );
  }

  const saved = ticket.state === "revealed";
  const cancelled = ticket.state === "cancelled";
  const placeName = ticket.place?.name ?? "Partner place";
  const photo = ticket.place?.photos?.[0] ?? null;

  // Money, read once (C4): v4 readers key on the SUBTOTAL; the payable
  // number is frozen at approval.
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

  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const additive = quote?.additive ?? false;
  const welcomeBonus = quote?.bonuses.welcome ?? 0;
  const classBase = !quote
    ? 0
    : additive
      ? clamp(quote.base + welcomeBonus)
      : quote.base;

  const storyOnTicket =
    ticket.story_state != null && ticket.story_state !== "not_required";
  const reviewOnTicket =
    ticket.review_state != null && ticket.review_state !== "not_required";
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

  const storyVerified = taskStateFor(ticket.story_state) === "done";
  const googleVerified = taskStateFor(ticket.review_state) === "done";
  const verified = (a: ActionKind): boolean =>
    a === "story"
      ? storyVerified
      : a === "google"
        ? googleVerified
        : reviewDone;
  const verifiedActions: ActionKind[] = (
    ["story", "google", "mesita"] as const
  ).filter(verified);

  const chosenState: TaskState =
    chosenAction === null
      ? "todo"
      : chosenAction === "mesita"
        ? reviewDone
          ? "done"
          : "todo"
        : taskStateFor(
            chosenAction === "story"
              ? ticket.story_state
              : ticket.review_state,
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
    !live || ticket.state === "approved" || ticket.state === "paying";
  const selectableFor = (a: ActionKind): boolean =>
    pickLocked
      ? false
      : a === "story"
        ? Boolean(quote?.storyEligible) && igConnected
        : a === "google"
          ? (quote?.bonuses.google ?? 0) > 0
          : (quote?.bonuses.mesita ?? 0) > 0 && !reviewDone;
  const onPick = (a: ActionKind) => {
    if (!pickLocked) setStoredPick(pick === a ? "base" : a);
  };

  const fix: TicketFix | null = isTicketFix(ticket.fix_requested)
    ? ticket.fix_requested
    : null;
  const journey: JourneyInput = {
    state: ticket.state,
    live,
    billed,
    priced,
    pickMade: pick !== null,
    hasAction: chosenAction !== null,
    actionDone: chosenState === "done",
    fix,
  };
  const step = resolveStep(journey, stepChoice);
  const amberStep = fix ? fixReturnStep(fix) : null;
  const capPesos = quote?.cap ?? null;
  const capApplied =
    quote != null &&
    billed &&
    discountCents > 0 &&
    subtotalCents > quote.cap * 100;
  const waiting = ticket.state === "scanned" && !fix;

  return (
    <View className="flex-1 px-4 pb-3 pt-1">
      {/* Chrome row */}
      <View className="flex-row items-center gap-2.5 pb-1">
        <Pressable
          onPress={goBack}
          accessibilityLabel="Back to Visit"
          className="size-8 items-center justify-center rounded-full bg-muted"
        >
          <ArrowLeft size={15} color={COLORS.foreground} />
        </Pressable>
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={{ width: 36, height: 36, borderRadius: 12 }}
            contentFit="cover"
          />
        ) : (
          <View className="size-9 items-center justify-center rounded-xl bg-primary">
            <Store size={16} color="#ffffff" />
          </View>
        )}
        <View className="min-w-0 flex-1">
          <Text
            numberOfLines={1}
            className="font-extrabold text-foreground"
            style={{ fontSize: 14 }}
          >
            {placeName}
          </Text>
          {ticket.place?.category ? (
            <Text
              numberOfLines={1}
              className="capitalize text-muted-foreground"
              style={{ fontSize: 10.5 }}
            >
              {ticket.place.category.replaceAll("_", " ")}
            </Text>
          ) : null}
        </View>
        {/* Three money states in one chip, and the ternary already read
            `cancelled ? "bg-muted" : "bg-muted"` — Cancelled and Live were one
            pill before this repaint ever touched it. They rank by SHAPE now:
            Live FILLS (a ticket is open right now), Completed is outlined and
            carries the Check, Cancelled is flat — no fill, no rule, and the
            muted tone on the label is the whole of its dimming. An extra
            opacity on top of that took a 9px uppercase label to 3.0:1 on the
            #efefef page, under AA, and muted-foreground alone already reads
            quieter than either of the other two. */}
        <View
          className={cn(
            "flex-row items-center gap-1 rounded-full px-2 py-0.5",
            saved
              ? "border border-foreground bg-card"
              : cancelled
                ? "bg-muted"
                : "bg-foreground",
          )}
        >
          {saved ? (
            <Check size={9} color={COLORS.foreground} strokeWidth={4} />
          ) : null}
          <Text
            className={cn(
              "font-extrabold uppercase",
              saved
                ? "text-foreground"
                : cancelled
                  ? "text-muted-foreground"
                  : "text-white",
            )}
            style={{ fontSize: 9, letterSpacing: 1 }}
          >
            {saved ? "Completed" : cancelled ? "Cancelled" : "Live"}
          </Text>
        </View>
      </View>

      {/* The seven-chip rail. The step a fix returned the guest to used to be
          amber; achromatic it INVERTS — one filled ink chip against six light
          ones — because "fix this" must not land in the same pale band as
          "current" and "not reached yet". */}
      <View className="flex-row gap-1 pb-2 pt-1">
        {TICKET_STEPS.map(({ id, label }) => {
          const done = stepIndex(id) <= stepIndex(step);
          const current = id === step;
          const amber = id === amberStep;
          const can = stepReachable(journey, id) && !current;
          return (
            <Pressable
              key={id}
              disabled={!can}
              onPress={() => setStepChoice(id)}
              className={cn(
                "min-h-[40px] flex-1 justify-center rounded-xl border px-1.5",
                amber
                  ? "border-foreground bg-foreground"
                  : current
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-card",
                !can && !current && "opacity-55",
              )}
            >
              <View
                className={cn(
                  "h-[3px] w-full rounded-full",
                  amber ? "bg-white" : done ? "bg-primary" : "bg-border",
                )}
              />
              <Text
                numberOfLines={1}
                className={cn(
                  "mt-1",
                  amber
                    ? "font-bold text-white"
                    : current
                      ? "font-bold text-foreground"
                      : done
                        ? "font-semibold text-primary"
                        : "font-medium text-muted-foreground",
                )}
                style={{ fontSize: 9 }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* D3 — the send-back banner: names the FIX, and it is the one thing on
          this screen the guest MUST act on. It INVERTS rather than greys — a
          pale box in a column of pale cards reads as a caption, not a
          rejection. Same ink mark as the rail step it points at. */}
      {fix ? (
        <View className="mb-2 rounded-xl bg-foreground px-3 py-2">
          <Text className="font-semibold text-white" style={{ fontSize: 11.5 }}>
            {placeName} sent it back — {FIX_COPY[fix].title.toLowerCase()}.
            {ticket.fix_note ? ` “${ticket.fix_note}”` : ""}
          </Text>
        </View>
      ) : null}

      {/* THE one live region — RN announces via accessibilityLiveRegion. */}
      <Text
        accessibilityLiveRegion="polite"
        className="absolute h-0 w-0 opacity-0"
      >
        {announce}
      </Text>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-2.5 pb-4 pt-1"
        showsVerticalScrollIndicator={false}
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
              setStepChoice("qr");
            }}
            onList={onList}
            igConnected={igConnected}
            chosenAction={chosenAction}
            isFirstVisit={quote?.isFirstVisit ?? false}
            verified={verified}
            selectableFor={selectableFor}
            onPick={onPick}
            base={base}
            selectedTotal={selectedTotal}
            actionBonus={actionBonus}
            capPesos={capPesos}
          />
        ) : null}

        {step === "task" ? (
          chosenAction === null ? (
            <Card center>
              <Text
                className="font-bold text-foreground"
                style={{ fontSize: 16 }}
              >
                No task on this ticket
              </Text>
              <Text
                className="mt-1 text-center text-muted-foreground"
                style={{ fontSize: 12.5 }}
              >
                You didn&apos;t pick a bonus, so there&apos;s nothing to do
                here. {placeName} still honours your {base}%.
              </Text>
              <Pressable
                onPress={() => setStepChoice("reward")}
                className="mt-3 min-h-11 w-full items-center justify-center rounded-full border border-border"
              >
                <Text
                  className="font-bold text-foreground"
                  style={{ fontSize: 13 }}
                >
                  Pick a bonus
                </Text>
              </Pressable>
            </Card>
          ) : chosenAction === "mesita" ? (
            <Card>
              <TicketReviewForm
                draft={reviewDraft}
                onChange={setReviewDraft}
                onSubmit={() =>
                  void (async () => {
                    const ok = await submitMesitaReview();
                    if (ok) setStepChoice("qr");
                  })()
                }
                busy={reviewBusy}
                error={reviewError}
              />
            </Card>
          ) : (
            <TaskStep
              action={chosenAction}
              placeName={placeName}
              placeAddress={ticket.place?.address}
              pct={selectedTotal}
              done={chosenState === "done"}
              busy={proofBusy}
              error={proofError}
              onSubmitProof={() => void submitProof(chosenAction)}
              onShowQr={() => setStepChoice("qr")}
            />
          )
        ) : null}

        {step === "qr" ? (
          <>
            {/* THE PASS — persists through unscanned → waiting → fix (F1). */}
            <LinearGradient
              colors={[...passColors(classKey)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 24, padding: 16 }}
            >
              <View className="flex-row items-center justify-between gap-3">
                <View className="min-w-0 flex-1 flex-row items-center gap-2">
                  {avatarUrl ? (
                    <Image
                      source={{ uri: avatarUrl }}
                      style={{ width: 24, height: 24, borderRadius: 12 }}
                    />
                  ) : (
                    <DefaultAvatar size={24} />
                  )}
                  <View className="min-w-0">
                    <Text
                      numberOfLines={1}
                      className="font-bold text-white"
                      style={{ fontSize: 11.5 }}
                    >
                      {guestName}
                    </Text>
                    {igHandle ? (
                      <Text
                        numberOfLines={1}
                        className="text-white/80"
                        style={{ fontSize: 9 }}
                      >
                        @{igHandle.replace(/^@/, "")}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {listLabel ? (
                  <View className="rounded-full bg-white/25 px-2 py-0.5">
                    <Text
                      className="font-extrabold uppercase text-white"
                      style={{ fontSize: 9, letterSpacing: 1 }}
                    >
                      {listLabel}
                    </Text>
                  </View>
                ) : null}
              </View>

              {priced && headlinePct > 0 ? (
                <Text
                  className="mt-2 text-center font-extrabold text-white"
                  style={{ fontSize: 34, lineHeight: 36 }}
                >
                  {headlinePct}% off
                </Text>
              ) : (
                <Text
                  className="mt-2 text-center font-semibold text-white/90"
                  style={{ fontSize: 12 }}
                >
                  Your discount is set by the place and applied at the table.
                </Text>
              )}

              <View className="mt-2.5 items-center">
                <View className="rounded-2xl bg-white p-2.5">
                  {/* SCAN TARGET, not a theme colour: a camera owns this
                      contrast. The pair is PINNED near-black on pure white and
                      does not follow the palette in either direction. #2b1233
                      was a drifted near-foreground matching no token. */}
                  <QRCode
                    value={checkUrlForCode(ticket.check_code ?? "")}
                    size={158}
                    backgroundColor="#ffffff"
                    color="#171717"
                  />
                </View>
              </View>

              <View className="mt-2 flex-row items-center justify-center gap-1.5">
                {waiting ? <BadgeCheck size={14} color="#ffffff" /> : null}
                <Text
                  className="text-center text-white/90"
                  style={{ fontSize: 11, maxWidth: 280 }}
                >
                  {waiting
                    ? "Scanned — it's open on their screen."
                    : fix
                      ? "Fix it below — their screen updates live, no new QR."
                      : "Show this to your server. The scan just opens your ticket on their side."}
                </Text>
              </View>
              {!waiting && capPesos && priced ? (
                <Text
                  className="mt-1 text-center text-white/80"
                  style={{ fontSize: 11 }}
                >
                  Capped at MX${capPesos.toLocaleString("en-US")} off.
                </Text>
              ) : null}
            </LinearGradient>

            {/* What staff see at a glance — the F3 receipt. */}
            <View className="gap-1.5">
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
            </View>

            {waiting ? (
              <View className="rounded-2xl border border-dashed border-border p-3">
                <Text
                  className="font-extrabold uppercase text-muted-foreground"
                  style={{ fontSize: 9.5, letterSpacing: 1 }}
                >
                  Mesita Check · staff side
                </Text>
                <Text
                  className="mt-1 text-muted-foreground"
                  style={{ fontSize: 11.5 }}
                >
                  {placeName} sees bill, tip, reward and proof at a glance —
                  they approve it or send back one specific fix. Two touches,
                  nothing to operate.
                </Text>
              </View>
            ) : null}

            {pollMisses >= 3 && live ? (
              <Text
                className="text-center text-muted-foreground"
                style={{ fontSize: 11 }}
              >
                Can&apos;t reach Mesita right now — your ticket is still valid.
              </Text>
            ) : null}

            {live &&
            (ticket.state === "open" || ticket.state === "scanned") ? (
              <Pressable
                onPress={() => setStepChoice("bill")}
                className="min-h-10 items-center justify-center"
              >
                <Text
                  className="font-semibold text-muted-foreground"
                  style={{ fontSize: 12 }}
                >
                  Need to change something?
                </Text>
              </Pressable>
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
            onConfirmAtPlace={() => void confirmAtPlace()}
          />
        ) : null}

        {step === "validate" ? (
          <Card center>
            <ActivityIndicator color={COLORS.primary} />
            <Text
              className="mt-2 font-bold text-foreground"
              style={{ fontSize: 16 }}
            >
              Waiting on {placeName}
            </Text>
            <Text
              className="mt-1 text-center text-muted-foreground"
              style={{ fontSize: 12, maxWidth: 300 }}
            >
              Hand over the payment — the moment they confirm it, the visit
              validates and closes on its own. Nothing left to do.
            </Text>
          </Card>
        ) : null}

        {step === "results" ? (
          <>
            <LinearGradient
              colors={[...passColors(classKey)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 24, padding: 16 }}
            >
              <View className="flex-row items-center justify-between">
                <Text
                  className="font-bold uppercase text-white/80"
                  style={{ fontSize: 9, letterSpacing: 1.5 }}
                >
                  Mesita Pass
                </Text>
                {listLabel ? (
                  <View className="rounded-full bg-white/25 px-2 py-0.5">
                    <Text
                      className="font-extrabold uppercase text-white"
                      style={{ fontSize: 9, letterSpacing: 1 }}
                    >
                      {listLabel}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View className="items-center gap-1.5 py-5">
                {saved ? (
                  <>
                    <PartyPopper size={26} color="#ffffff" />
                    <Text
                      className="font-extrabold text-white"
                      style={{ fontSize: 21 }}
                    >
                      {discountCents > 0
                        ? `You saved ${formatCurrency(discountCents)}`
                        : "Visit complete"}
                    </Text>
                    <Text className="text-white/85" style={{ fontSize: 11.5 }}>
                      {billedPct > 0
                        ? `${billedPct}% off at ${placeName}`
                        : placeName}
                    </Text>
                    {capApplied && capPesos ? (
                      <Text className="text-white/75" style={{ fontSize: 11 }}>
                        Capped at MX${capPesos.toLocaleString("en-US")} off.
                      </Text>
                    ) : null}
                  </>
                ) : cancelled ? (
                  <>
                    <Text
                      className="font-extrabold text-white"
                      style={{ fontSize: 15 }}
                    >
                      Ticket cancelled
                    </Text>
                    <Text className="text-white/85" style={{ fontSize: 11.5 }}>
                      Start a fresh one from Visit whenever you&apos;re back.
                    </Text>
                  </>
                ) : (
                  <>
                    <Text
                      className="font-extrabold text-white"
                      style={{ fontSize: 15 }}
                    >
                      Visit in progress
                    </Text>
                    <Text className="text-white/85" style={{ fontSize: 11.5 }}>
                      Your result lands here once {placeName} closes the visit.
                    </Text>
                  </>
                )}
              </View>
            </LinearGradient>

            {saved && subtotalCents > 0 ? (
              <View className="gap-1.5">
                <MoneyRow
                  label="Final bill"
                  value={formatCurrency(subtotalCents)}
                />
                {tipCents > 0 ? (
                  <MoneyRow
                    label="Tip (100% to the place)"
                    value={formatCurrency(tipCents)}
                  />
                ) : null}
                <MoneyRow
                  label="You paid"
                  value={formatCurrency(amountDueCents)}
                />
                {billedPct > 0 ? (
                  <MoneyRow label="Discount applied" value={`${billedPct}%`} />
                ) : null}
                {ticket.paid_method && PAY_METHOD_LABEL[ticket.paid_method] ? (
                  <MoneyRow
                    label="Settled"
                    value={PAY_METHOD_LABEL[ticket.paid_method]}
                  />
                ) : null}
                {tipCents > 0 ? (
                  <TipHonesty
                    subtotalCents={subtotalCents}
                    tipPct={tipPct}
                    past
                  />
                ) : null}
              </View>
            ) : null}

            {!cancelled && !reviewDone ? (
              <Pressable
                onPress={() => setSheet("mesita")}
                className="flex-row items-center gap-2.5 rounded-2xl border border-border bg-card px-3.5 py-3"
              >
                <Star size={16} color={COLORS.mutedForeground} />
                <View className="min-w-0 flex-1">
                  <Text
                    className="font-bold text-foreground"
                    style={{ fontSize: 13 }}
                  >
                    Rate your visit
                  </Text>
                  <Text
                    className="text-muted-foreground"
                    style={{ fontSize: 11 }}
                  >
                    Food · service · ambience — feeds its rating
                  </Text>
                </View>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {/* Reward step's pinned commit. */}
      {step === "reward" && quote !== null && !quoteError ? (
        <Pressable
          onPress={() => {
            if (!pickLocked) setStoredPick(pick ?? "base");
            setStepChoice(
              chosenAction && chosenState !== "done" ? "task" : "qr",
            );
          }}
          className="min-h-12 items-center justify-center rounded-2xl bg-primary"
        >
          <Text className="font-bold text-white" style={{ fontSize: 14 }}>
            {chosenAction && chosenState !== "done"
              ? `Do the task · ${selectedTotal}%`
              : `Show my QR at ${selectedTotal || base}%`}
          </Text>
        </Pressable>
      ) : null}

      {/* Utility row — guest self-cancel ends at approval (§12). */}
      <View className="flex-row items-center justify-center gap-2.5 pt-2">
        {ticket.state === "open" || ticket.state === "scanned" ? (
          <Pressable
            onPress={() => void cancel()}
            disabled={cancelling}
            className="min-h-9 flex-row items-center gap-1.5"
          >
            {cancelling ? (
              <ActivityIndicator size="small" color={COLORS.mutedForeground} />
            ) : null}
            <Text
              className="font-semibold text-muted-foreground"
              style={{ fontSize: 12 }}
            >
              Cancel ticket
            </Text>
          </Pressable>
        ) : null}
        {!cancelled ? (
          reported ? (
            <Text
              className="font-semibold text-muted-foreground"
              style={{ fontSize: 12 }}
            >
              Reported — Mesita is looking at it
            </Text>
          ) : (
            <Pressable
              onPress={() => setSheet("report")}
              className="min-h-9 items-center justify-center"
            >
              <Text
                className="font-semibold text-muted-foreground"
                style={{ fontSize: 12 }}
              >
                Report a problem
              </Text>
            </Pressable>
          )
        ) : null}
      </View>

      <FullScreenSheet
        visible={sheet === "mesita"}
        onClose={() => setSheet(null)}
        title={`Rate ${placeName}`}
      >
        <TicketReviewForm
          draft={reviewDraft}
          onChange={setReviewDraft}
          onSubmit={() => void submitMesitaReview()}
          busy={reviewBusy}
          error={reviewError}
        />
      </FullScreenSheet>

      <FullScreenSheet
        visible={sheet === "report"}
        onClose={() => setSheet(null)}
        title={`What went wrong at ${placeName}?`}
        subtitle="A real person at Mesita reads every report."
      >
        <View className="gap-1.5">
          {REPORT_REASONS.map((r) => {
            const active = reportReason === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => setReportReason(r.key)}
                className={cn(
                  "rounded-2xl px-3.5 py-3",
                  // A radio list rendered without a radio: bg-primary/10 over
                  // bg-muted is seven points of lightness, so the pick FILLS.
                  active ? "bg-foreground" : "bg-muted",
                )}
              >
                <Text
                  className={cn(
                    "font-bold",
                    active ? "text-white" : "text-foreground",
                  )}
                  style={{ fontSize: 13.5 }}
                >
                  {r.label}
                </Text>
                <Text
                  className={cn(
                    "mt-0.5",
                    active ? "text-white/70" : "text-muted-foreground",
                  )}
                  style={{ fontSize: 11.5 }}
                >
                  {r.hint}
                </Text>
              </Pressable>
            );
          })}
          <TextInput
            value={reportDetails}
            onChangeText={(t) => setReportDetails(t.slice(0, 1000))}
            placeholder="Anything else we should know? (optional)"
            placeholderTextColor={COLORS.mutedForeground}
            multiline
            className="min-h-20 rounded-2xl border border-border bg-card px-3.5 py-3 text-foreground"
            style={{ fontSize: 13, textAlignVertical: "top" }}
          />
          <Pressable
            disabled={!reportReason || reportBusy}
            onPress={() => void submitReport()}
            className={cn(
              "min-h-12 items-center justify-center rounded-2xl bg-primary",
              (!reportReason || reportBusy) && "opacity-50",
            )}
          >
            {reportBusy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="font-bold text-white" style={{ fontSize: 14 }}>
                Send report
              </Text>
            )}
          </Pressable>
        </View>
      </FullScreenSheet>
    </View>
  );
}

// ── Shared bits ────────────────────────────────────────────────────────────

function Card({
  children,
  center = false,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <View
      className={cn(
        "rounded-2xl border border-border bg-card p-4",
        center && "items-center",
      )}
    >
      {children}
    </View>
  );
}

function MoneyRow({
  label,
  sub,
  value,
}: {
  label: string;
  sub?: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
      <View className="min-w-0 flex-1">
        <Text
          numberOfLines={1}
          className="text-muted-foreground"
          style={{ fontSize: 12.5 }}
        >
          {label}
        </Text>
        {sub ? (
          <Text className="text-muted-foreground/80" style={{ fontSize: 10.5 }}>
            {sub}
          </Text>
        ) : null}
      </View>
      <Text className="font-bold text-foreground" style={{ fontSize: 13 }}>
        {value}
      </Text>
    </View>
  );
}

// F3 — the tip-honesty sentence, permanent, never a tooltip.
function TipHonesty({
  subtotalCents,
  tipPct,
  past = false,
}: {
  subtotalCents: number;
  tipPct: number | null;
  past?: boolean;
}) {
  if (subtotalCents <= 0) return null;
  const amount = formatCurrency(subtotalCents);
  return (
    <Text
      className="px-1 text-center text-muted-foreground"
      style={{ fontSize: 11 }}
    >
      {tipPct === null
        ? "Your discount never comes out of your server's tip."
        : past
          ? `Your server was tipped on the full ${amount}.`
          : `Your server is tipped on the full ${amount}, not the discounted total. Your discount never comes out of their tip.`}
    </Text>
  );
}

// ── Step 1 — Bill ─────────────────────────────────────────────────────────
function StepBill({
  initialSubtotalCents,
  initialTipPct,
  initialTipCents,
  busy,
  error,
  fixActive,
  onSave,
}: {
  initialSubtotalCents: number | null;
  initialTipPct: number | null | undefined;
  initialTipCents: number | null;
  busy: boolean;
  error: string | null;
  fixActive: boolean;
  onSave: (bill: {
    subtotalCents: number;
    tipPct: number | null;
    tipCustomCents: number;
  }) => void;
}) {
  const [billDraft, setBillDraft] = useState(
    initialSubtotalCents && initialSubtotalCents > 0
      ? String(Math.round(initialSubtotalCents / 100))
      : "",
  );
  const [pct, setPct] = useState<number | null>(
    initialTipPct === undefined ? DEFAULT_TIP_PCT : initialTipPct,
  );
  const [tipDraft, setTipDraft] = useState(
    initialTipPct === null && initialTipCents
      ? String(Math.round(initialTipCents / 100))
      : "",
  );

  const subtotalCents = useMemo(() => {
    const pesos = Number(billDraft.replace(/[,$\s]/g, ""));
    return Number.isFinite(pesos) && pesos > 0 ? Math.round(pesos * 100) : 0;
  }, [billDraft]);
  const customCents = useMemo(() => {
    const pesos = Number(tipDraft.replace(/[,$\s]/g, ""));
    return Number.isFinite(pesos) && pesos >= 0 ? Math.round(pesos * 100) : 0;
  }, [tipDraft]);
  const tipCents =
    pct === null ? customCents : previewTipCents(subtotalCents, pct);

  return (
    <View className="gap-3">
      <Card>
        <Text className="font-bold text-foreground" style={{ fontSize: 17 }}>
          What&apos;s the bill?
        </Text>
        <Text className="mt-1 text-muted-foreground" style={{ fontSize: 12 }}>
          The tip is taken on the bill, before anything else.
        </Text>

        <Text
          className="mt-3 font-bold uppercase text-muted-foreground"
          style={{ fontSize: 10, letterSpacing: 1.2 }}
        >
          Bill total
        </Text>
        <View className="mt-1 flex-row items-center gap-2">
          <Text
            className="font-bold text-muted-foreground"
            style={{ fontSize: 13 }}
          >
            MX$
          </Text>
          <TextInput
            inputMode="decimal"
            autoFocus
            value={billDraft}
            onChangeText={setBillDraft}
            placeholder="850"
            placeholderTextColor={COLORS.mutedForeground}
            className="min-h-11 flex-1 rounded-xl border border-border bg-background px-3 font-bold text-foreground"
            style={{ fontSize: 15 }}
          />
        </View>
        <Text
          className="mt-1 text-muted-foreground/80"
          style={{ fontSize: 10.5 }}
        >
          The printed total, before your discount.
        </Text>

        <Text
          className="mt-3 font-bold uppercase text-muted-foreground"
          style={{ fontSize: 10, letterSpacing: 1.2 }}
        >
          Tip
        </Text>
        <View className="mt-1 flex-row gap-1.5">
          {TIP_PRESETS.map((p) => {
            const on = pct === p;
            return (
              <Pressable
                key={p}
                onPress={() => setPct(p)}
                className={cn(
                  "min-h-[46px] flex-1 items-center justify-center rounded-xl border",
                  on ? "border-primary bg-primary/10" : "border-border bg-card",
                )}
              >
                <Text
                  className={cn(
                    "font-bold",
                    on ? "text-primary" : "text-foreground",
                  )}
                  style={{ fontSize: 12 }}
                >
                  {p}%
                </Text>
                <Text
                  className="font-semibold text-muted-foreground"
                  style={{ fontSize: 10 }}
                >
                  {formatCurrency(previewTipCents(subtotalCents, p))}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setPct(null)}
            className={cn(
              "min-h-[46px] flex-1 items-center justify-center rounded-xl border",
              pct === null
                ? "border-primary bg-primary/10"
                : "border-border bg-card",
            )}
          >
            <Text
              className={cn(
                "font-bold",
                pct === null ? "text-primary" : "text-foreground",
              )}
              style={{ fontSize: 12 }}
            >
              Custom
            </Text>
          </Pressable>
        </View>
        {pct === null ? (
          <View className="mt-2 flex-row items-center gap-2">
            <Text
              className="font-bold text-muted-foreground"
              style={{ fontSize: 13 }}
            >
              MX$
            </Text>
            <TextInput
              inputMode="decimal"
              value={tipDraft}
              onChangeText={setTipDraft}
              placeholder="0"
              placeholderTextColor={COLORS.mutedForeground}
              accessibilityLabel="Custom tip in pesos"
              className="min-h-11 flex-1 rounded-xl border border-border bg-background px-3 font-bold text-foreground"
              style={{ fontSize: 15 }}
            />
          </View>
        ) : null}
      </Card>

      {subtotalCents > 0 ? (
        <View className="gap-1.5">
          <MoneyRow label="Bill" value={formatCurrency(subtotalCents)} />
          <MoneyRow
            label={pct === null ? "Tip" : `Tip · ${pct}%`}
            sub={
              pct === null
                ? "Your amount"
                : `${pct}% of ${formatCurrency(subtotalCents)}, before the discount`
            }
            value={formatCurrency(tipCents)}
          />
          <MoneyRow
            label="Subtotal"
            value={formatCurrency(subtotalCents + tipCents)}
          />
        </View>
      ) : null}

      {error ? (
        <Text
          className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive"
          style={{ fontSize: 12 }}
        >
          {error}
        </Text>
      ) : null}

      <Pressable
        disabled={subtotalCents <= 0 || busy}
        onPress={() =>
          onSave({ subtotalCents, tipPct: pct, tipCustomCents: customCents })
        }
        className={cn(
          "min-h-12 items-center justify-center rounded-2xl bg-primary",
          (subtotalCents <= 0 || busy) && "opacity-45",
        )}
      >
        {busy ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="font-bold text-white" style={{ fontSize: 14 }}>
            {subtotalCents <= 0
              ? "Enter the bill to continue"
              : fixActive
                ? "Send the corrected bill"
                : "Save the bill"}
          </Text>
        )}
      </Pressable>

      <TipHonesty subtotalCents={subtotalCents} tipPct={pct} />
    </View>
  );
}

// ── Step 2 — Reward lanes ─────────────────────────────────────────────────
function Lane({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-card">
      <View className="flex-row items-baseline justify-between border-b border-border bg-muted/60 px-3 py-1.5">
        <Text
          className="font-extrabold uppercase text-muted-foreground"
          style={{ fontSize: 9, letterSpacing: 1.2 }}
        >
          {title}
        </Text>
        <Text
          className="font-semibold text-muted-foreground"
          style={{ fontSize: 10 }}
        >
          {note}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="flex-row gap-1 px-2 py-1.5"
      >
        {children}
      </ScrollView>
    </View>
  );
}

function LaneChip({
  label,
  sub,
  value,
  on = false,
  faded = false,
  done = false,
  you = false,
  glyph,
  onPress,
}: {
  label: string;
  sub?: string;
  value: number | null;
  on?: boolean;
  faded?: boolean;
  done?: boolean;
  /** The guest's own identity row (Base or Diamond). */
  you?: boolean;
  glyph?: React.ReactNode;
  onPress?: () => void;
}) {
  const body = (
    <>
      {glyph}
      <View className="min-w-0">
        <View className="flex-row items-center gap-1">
          <Text
            numberOfLines={1}
            className="font-bold text-foreground"
            style={{ fontSize: 9 }}
          >
            {label}
          </Text>
          {done ? (
            <Check size={10} color={COLORS.foreground} strokeWidth={4} />
          ) : null}
          {you ? (
            <Text
              className="font-extrabold uppercase text-primary"
              style={{ fontSize: 7, letterSpacing: 0.8 }}
            >
              You
            </Text>
          ) : null}
        </View>
        {sub ? (
          <Text
            numberOfLines={1}
            className="text-muted-foreground"
            style={{ fontSize: 8 }}
          >
            {sub}
          </Text>
        ) : null}
        {value !== null ? (
          <Text
            className={cn(
              "font-extrabold",
              on ? "text-primary" : "text-foreground",
            )}
            style={{ fontSize: 12 }}
          >
            {value > 0 ? `+${value}%` : "0%"}
          </Text>
        ) : null}
      </View>
    </>
  );
  const shell = cn(
    "min-w-[68px] flex-row items-center gap-1.5 rounded-lg border px-2 py-1.5",
    on ? "border-primary bg-primary/10" : "border-border bg-background",
    faded && !on && "opacity-45",
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} className={shell}>
        {body}
      </Pressable>
    );
  }
  return <View className={shell}>{body}</View>;
}

function RewardLanes({
  quote,
  quoteError,
  onRetryQuote,
  onShowQrAnyway,
  onList,
  igConnected,
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
  onList: boolean;
  igConnected: boolean;
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
  if (quoteError) {
    return (
      <Card center>
        <Text className="text-destructive" style={{ fontSize: 12 }}>
          Couldn&apos;t load your rates here.
        </Text>
        <View className="mt-2 flex-row gap-5">
          <Pressable onPress={onRetryQuote}>
            <Text
              className="font-semibold text-primary"
              style={{ fontSize: 12.5 }}
            >
              Retry
            </Text>
          </Pressable>
          <Pressable onPress={onShowQrAnyway}>
            <Text
              className="font-semibold text-muted-foreground"
              style={{ fontSize: 12.5 }}
            >
              Show my QR anyway
            </Text>
          </Pressable>
        </View>
      </Card>
    );
  }
  if (!quote) {
    return (
      <View className="items-center py-8">
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  const b = quote.breakdown ?? null;
  const welcome = quote.bonuses.welcome;
  // WHO THE GUEST IS = TWO ROWS (MESITA-2044). The EF's breakdown is the
  // engine's own decomposition: the Base is the bronze floor every guest
  // gets (`automatic` + `classes.bronze`), and the Diamond adder is the
  // diamond row over bronze — same arithmetic as web's twin. Whether the guest
  // is Diamond comes from the quote when it has one, else from the profile.
  const listed = b ? b.cls === "diamond" : onList;
  const baseValue = b ? b.automatic + b.classes.bronze : quote.base;
  const listAdder = b ? Math.max(0, b.classes.diamond - b.classes.bronze) : 0;
  const identity = b ? identityRateRows(baseValue, listAdder, listed) : null;

  const parts: string[] = [];
  if (b) {
    if (baseValue > 0) parts.push(`${baseValue}% base`);
    if (listed && listAdder > 0) parts.push(`${listAdder}% ${DIAMOND}`);
  } else if (quote.base > 0) {
    parts.push(`${quote.base}% base`);
  }
  if (welcome > 0) parts.push(`${welcome}% welcome`);
  if (chosenAction && actionBonus(chosenAction) > 0)
    parts.push(`${actionBonus(chosenAction)}% sharing`);

  return (
    <View className="gap-1.5">
      <Lane title="Payout" note="how it lands">
        <LaneChip label="Discount" sub="off tonight's bill" value={null} on />
        <LaneChip
          label="Credits"
          sub="coming soon"
          value={null}
          faded
        />
      </Lane>

      {b ? (
        <>
          {/* Base + Diamond, and nothing else. Base is paid to every
              guest, so it is always lit; "You" marks the guest's own row. */}
          <Lane title="Your rate" note="always on">
            {identity!.map((r) => (
              <LaneChip
                key={r.key}
                label={r.label}
                sub={r.hint}
                value={r.value}
                on={r.key === "base" ? r.value > 0 : r.mine}
                faded={r.key === "diamond" && !r.mine}
                you={r.mine}
                glyph={
                  r.key === "diamond" ? (
                    <Gem size={14} color={COLORS.primary} />
                  ) : (
                    <Zap size={14} color={COLORS.primary} />
                  )
                }
              />
            ))}
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
              glyph={<Sparkles size={14} color={COLORS.primary} />}
            />
            <LaneChip
              label="Return"
              sub={isFirstVisit ? "return visits" : "thanks for coming back"}
              value={null}
              on={!isFirstVisit}
              faded={isFirstVisit}
              glyph={<RefreshCw size={14} color={COLORS.primary} />}
            />
          </Lane>
          {/* A "Plan" lane (Free / Premium) sat here until MESITA-1705 — same as
              web TicketScreen. The plan does not price a reward any more. */}
        </>
      ) : (
        <Lane title="Your rate" note="always on">
          {/* A legacy config sends no decomposition, so the adder cannot be
              split out: this is the guest's whole standing rate. */}
          <LaneChip
            label={BASE_RATE_LABEL}
            sub={onList ? `with ${DIAMOND}` : BASE_RATE_HINT}
            value={quote.base}
            on={quote.base > 0}
            glyph={<Zap size={14} color={COLORS.primary} />}
          />
          {welcome > 0 ? (
            <LaneChip
              label="Welcome"
              sub="your first visit here"
              value={welcome}
              on
              glyph={<Sparkles size={14} color={COLORS.primary} />}
            />
          ) : null}
        </Lane>
      )}

      <Lane title="Sharing" note="pick one">
        {(["google", "story", "mesita"] as const).map((a) => {
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
              onPress={selectableFor(a) ? () => onPick(a) : undefined}
            />
          );
        })}
      </Lane>

      <View className="overflow-hidden rounded-2xl border border-border bg-card">
        <View className="flex-row items-baseline justify-between bg-muted/60 px-3 py-1.5">
          <Text
            className="font-extrabold uppercase text-muted-foreground"
            style={{ fontSize: 9, letterSpacing: 1.2 }}
          >
            Result
          </Text>
          <Text
            className="font-semibold text-muted-foreground"
            style={{ fontSize: 10 }}
          >
            live
          </Text>
        </View>
        <View className="flex-row items-end justify-between gap-3 px-2.5 py-1.5">
          <Text
            className="min-w-0 flex-1 font-semibold text-muted-foreground"
            style={{ fontSize: 10.5 }}
          >
            {parts.length > 0
              ? parts.join(" + ")
              : "Nothing on this ticket yet"}
          </Text>
          <Text
            className="font-extrabold text-primary"
            style={{ fontSize: 26, lineHeight: 28 }}
          >
            {selectedTotal || base}%
          </Text>
        </View>
        {capPesos ? (
          <View className="border-t border-border px-2.5 py-1.5">
            {/* The ceiling on the 26px number directly above. Nobody can act
                on a cap, so it OUTLINES: the filled ink on this screen belongs
                to the send-back and to the approval. An ink hairline still
                reads heavier than the border-border rows around it. */}
            <View className="flex-row items-center gap-2 rounded-xl border border-foreground bg-card px-2 py-1.5">
              <Text
                className="font-extrabold text-foreground"
                style={{ fontSize: 12 }}
              >
                !
              </Text>
              <View className="min-w-0 flex-1">
                <Text
                  className="font-bold text-foreground"
                  style={{ fontSize: 11 }}
                >
                  Capped at MX${capPesos.toLocaleString("en-US")} off your bill
                </Text>
                <Text
                  className="text-muted-foreground"
                  style={{ fontSize: 10 }}
                >
                  This percentage is limited to this amount.
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ── Step 3 — Task (story / google): do it, upload the proof here. ─────────
function TaskStep({
  action,
  placeName,
  placeAddress,
  pct,
  done,
  busy,
  error,
  onSubmitProof,
  onShowQr,
}: {
  action: "story" | "google";
  placeName: string;
  placeAddress?: string | null;
  pct: number;
  done: boolean;
  busy: boolean;
  error: string | null;
  onSubmitProof: () => void;
  onShowQr: () => void;
}) {
  const isGoogle = action === "google";
  const openApp = async () => {
    if (isGoogle) {
      await Linking.openURL(googleMapsSearchUrl(placeName, placeAddress));
    } else {
      const app = "instagram://camera";
      const can = await Linking.canOpenURL(app).catch(() => false);
      await Linking.openURL(can ? app : "https://www.instagram.com/");
    }
  };

  return (
    <View className="gap-3">
      <View className="flex-row items-baseline justify-between px-0.5">
        <Text className="font-bold text-foreground" style={{ fontSize: 17 }}>
          {done ? "Task done" : "Your task"}
        </Text>
        <View
          className={cn(
            "flex-row items-center gap-1 rounded-full px-2 py-0.5",
            done ? "bg-foreground" : "bg-muted",
          )}
        >
          {done ? (
            <Check size={9} color={COLORS.primaryForeground} strokeWidth={4} />
          ) : null}
          <Text
            className={cn(
              "font-extrabold uppercase",
              done ? "text-white" : "text-muted-foreground",
            )}
            style={{ fontSize: 9.5, letterSpacing: 0.8 }}
          >
            {done ? "Proof saved" : "One step"}
          </Text>
        </View>
      </View>

      <Card center>
        <Text
          className="font-extrabold text-foreground"
          style={{ fontSize: 14.5 }}
        >
          {isGoogle ? "Leave a Google review" : "Post an Instagram story"}
        </Text>
        <Text
          className="mt-1 text-center text-muted-foreground"
          style={{ fontSize: 12 }}
        >
          {isGoogle
            ? "Any rating, any length. Screenshot it when it's live."
            : "Tag the place in your story, then screenshot it."}
        </Text>
        <Text className="mt-2 font-bold text-primary" style={{ fontSize: 12 }}>
          Unlocks {pct}% off
        </Text>
      </Card>

      <Pressable
        onPress={() => void openApp()}
        className="min-h-11 items-center justify-center rounded-2xl bg-foreground"
      >
        <Text className="font-bold text-white" style={{ fontSize: 13 }}>
          {isGoogle ? "Open Google" : "Open Instagram"}
        </Text>
      </Pressable>

      <Pressable
        disabled={busy}
        onPress={onSubmitProof}
        className={cn(
          "min-h-14 flex-row items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5",
          busy && "opacity-60",
        )}
      >
        {busy ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : (
          <Camera size={16} color={COLORS.primary} />
        )}
        <Text className="font-bold text-primary" style={{ fontSize: 13 }}>
          {done ? "Replace your screenshot" : "Add your screenshot"}
        </Text>
      </Pressable>

      {error ? (
        <Text
          className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive"
          style={{ fontSize: 12 }}
        >
          {error}
        </Text>
      ) : null}

      <Pressable
        onPress={onShowQr}
        className="min-h-11 items-center justify-center rounded-2xl border border-border"
      >
        <Text className="font-bold text-foreground" style={{ fontSize: 13 }}>
          {done ? `Show my QR at ${pct}%` : "I'll do it in a bit — show my QR"}
        </Text>
      </Pressable>
      {!done ? (
        <Text
          className="text-center text-muted-foreground"
          style={{ fontSize: 11 }}
        >
          You can show the QR now — the bonus lands when the proof does.
        </Text>
      ) : null}
    </View>
  );
}

// ── Step 5 — Pay (C2: one live path; card + Credits staged). ─────────────────
function StepPay({
  placeName,
  pct,
  subtotalCents,
  tipCents,
  tipPct,
  discountCents,
  amountDueCents,
  busy,
  error,
  onConfirmAtPlace,
}: {
  placeName: string;
  pct: number;
  subtotalCents: number;
  tipCents: number;
  tipPct: number | null;
  discountCents: number;
  amountDueCents: number;
  busy: boolean;
  error: string | null;
  onConfirmAtPlace: () => void;
}) {
  return (
    <View className="gap-3">
      {/* The one affirmative moment in the pay flow: the bill is accepted and
          the discount is locked. It INVERTS — greyed in place it became the
          same white card as "Waiting on {placeName}" two steps earlier and as
          the settle list immediately below it. */}
      <View className="rounded-2xl border border-foreground bg-foreground p-3.5">
        <Text className="font-bold text-white" style={{ fontSize: 17 }}>
          {placeName} approved it
        </Text>
        <Text className="mt-1 text-white/80" style={{ fontSize: 12 }}>
          {pct > 0 ? `${pct}% off is locked. ` : ""}Pay at the table like always
          — the ticket closes the moment they confirm.
        </Text>
      </View>

      <View className="overflow-hidden rounded-2xl border border-border bg-card">
        <View className="border-b border-border bg-muted/60 px-3.5 py-2">
          <Text
            className="font-extrabold uppercase text-muted-foreground"
            style={{ fontSize: 9.5, letterSpacing: 1.2 }}
          >
            How you settle
          </Text>
        </View>
        <PayRow
          icon={<Wallet size={16} color={COLORS.primaryForeground} />}
          label="At the register"
          sub="Cash or card, straight to the place"
          selected
        />
        <PayRow
          icon={<CreditCard size={16} color={COLORS.mutedForeground} />}
          label="Card through Mesita"
          sub="Charged to your saved card"
          soon
        />
        <View className="border-y border-border bg-muted/60 px-3.5 py-2">
          <Text
            className="font-extrabold uppercase text-muted-foreground"
            style={{ fontSize: 9.5, letterSpacing: 1.2 }}
          >
            Your Credits
          </Text>
        </View>
        <PayRow
          icon={<Gift size={16} color={COLORS.mutedForeground} />}
          label="Spend my Credits on this"
          sub="Coming soon · covers the bill, never the tip"
          soon
        />
      </View>

      <View className="gap-1.5">
        <MoneyRow label="Bill" value={formatCurrency(subtotalCents)} />
        <MoneyRow
          label={`Discount · ${pct}%`}
          value={`− ${formatCurrency(discountCents)}`}
        />
        <MoneyRow
          label="Tip (100% to the place)"
          value={formatCurrency(tipCents)}
        />
        <MoneyRow
          label="You pay at the table"
          value={formatCurrency(amountDueCents)}
        />
      </View>

      {error ? (
        <Text
          className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive"
          style={{ fontSize: 12 }}
        >
          {error}
        </Text>
      ) : null}

      <Pressable
        disabled={busy}
        onPress={onConfirmAtPlace}
        className={cn(
          "min-h-12 items-center justify-center rounded-2xl bg-primary",
          busy && "opacity-45",
        )}
      >
        {busy ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="font-bold text-white" style={{ fontSize: 14 }}>
            I&apos;m paying {formatCurrency(amountDueCents)} at the register
          </Text>
        )}
      </Pressable>

      <TipHonesty subtotalCents={subtotalCents} tipPct={tipPct} />
    </View>
  );
}

function PayRow({
  icon,
  label,
  sub,
  selected = false,
  soon = false,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  selected?: boolean;
  soon?: boolean;
}) {
  return (
    <View
      className={cn(
        "min-h-[56px] flex-row items-center gap-3 px-3.5 py-2.5",
        selected && "bg-primary/5",
        soon && "opacity-50",
      )}
    >
      <View
        className={cn(
          "size-8 items-center justify-center rounded-xl",
          // The live path's tile FILLS: bg-primary/10 over bg-muted was seven
          // points of lightness, and the two staged rows are left holding only
          // opacity-50 and the "Soon" pill. A `selected` row therefore hands in
          // a LIGHT icon — see the "At the register" call site.
          selected ? "bg-primary" : "bg-muted",
        )}
      >
        {icon}
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text
            className="font-bold text-foreground"
            style={{ fontSize: 12.5 }}
          >
            {label}
          </Text>
          {soon ? (
            <View className="rounded-full bg-muted px-1.5 py-0.5">
              <Text
                className="font-extrabold uppercase text-muted-foreground"
                style={{ fontSize: 8.5, letterSpacing: 0.8 }}
              >
                Soon
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          numberOfLines={1}
          className="mt-0.5 font-semibold text-muted-foreground"
          style={{ fontSize: 10.5 }}
        >
          {sub}
        </Text>
      </View>
      <View
        className={cn(
          "size-5 items-center justify-center rounded-full border-2",
          selected
            ? "border-primary bg-primary"
            : "border-border bg-background",
        )}
      >
        {selected ? <View className="size-2 rounded-full bg-white" /> : null}
      </View>
    </View>
  );
}

"use client";

// THE TICKET (MESITA-857 · MESITA-908) — one full-screen object for the whole
// lifecycle. Locked block order (rewards-chrome-20260805):
//   Place → Consumer → Reward → Tasks → QR (scannable only) → Results
//   (closed only) → Report. Task sheets are LocalSheets on this route.

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
  PartyPopper,
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
import {
  GoogleReviewSheet,
  googleMapsSearchUrl,
} from "@/components/consumer/rewards/GoogleReviewSheet";
import { InstagramStorySheet } from "@/components/consumer/rewards/InstagramStorySheet";
import { submitTicketReview } from "@/lib/api/pay";
import { formatCurrency } from "@/lib/api/profile";
import {
  ACTIVE_TICKET_STATUSES,
  REPORT_REASONS,
  apiCancelTicket,
  apiReportTicket,
  apiSubmitReview,
  apiSubmitStory,
  apiSubmitTicketTotal,
  checkUrlForCode,
  type ConsumerTicketRow,
  type ReportReason,
} from "@/lib/api/tickets";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useConsumerClass } from "@/lib/class-context";
import {
  classBadgeClass,
  classProperLabel,
} from "@/lib/consumer-data";
import { strategyForPlaceRow } from "@/lib/promo-rates";
import { peakRateForClass, rateForSegment } from "@/lib/reward-segments";
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
      return "All set — pay the discounted total at the table.";
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

function TaskRow({
  icon,
  title,
  hint,
  reward,
  state,
  onDo,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  reward: string;
  state: TaskState;
  onDo?: () => void;
}) {
  const done = state === "done";
  const actionable = (state === "todo" || state === "rejected") && onDo;
  return (
    <button
      type="button"
      disabled={!actionable}
      onClick={onDo}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition",
        done
          ? "bg-emerald-500/8"
          : state === "checking"
            ? "bg-muted/50"
            : "bg-muted/40 active:scale-[0.99]",
      )}
    >
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-full border-2 transition",
          done
            ? "border-emerald-500 bg-emerald-500 text-white"
            : state === "checking" || state === "busy"
              ? "border-border text-muted-foreground"
              : "border-border",
        )}
      >
        {state === "busy" ? (
          <Loader2 className="size-3 animate-spin" />
        ) : done ? (
          <Check className="size-3" strokeWidth={3} />
        ) : state === "checking" ? (
          <Loader2 className="size-2.5 animate-spin opacity-60" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "flex items-center gap-1.5 text-[12.5px] leading-tight font-bold",
            done ? "text-emerald-800" : "text-foreground",
          )}
        >
          {icon}
          <span className="truncate">{title}</span>
        </span>
        <span className="text-muted-foreground mt-0.5 block truncate text-[10.5px]">
          {state === "checking"
            ? "Sent — being checked"
            : state === "rejected"
              ? "Not accepted — try again"
              : done
                ? "Done"
                : hint}
        </span>
      </span>
      <span
        className={cn(
          "font-display shrink-0 text-[14px] leading-none font-extrabold tabular-nums",
          done ? "text-emerald-700" : "text-foreground/80",
        )}
      >
        {reward}
      </span>
    </button>
  );
}

type TaskSheet = "mesita" | "google" | "instagram" | "report" | null;

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
        <div className="bg-muted h-14 animate-pulse rounded-[18px]" />
        <div className="bg-muted h-12 animate-pulse rounded-[18px]" />
        <div className="bg-muted h-12 animate-pulse rounded-[18px]" />
        <div className="bg-muted h-36 animate-pulse rounded-2xl" />
        <div className="bg-muted h-52 animate-pulse rounded-[28px]" />
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
  const storyOnTicket =
    ticket.story_status != null && ticket.story_status !== "not_required";

  const strategy = strategyForPlaceRow(ticket.place);
  const priced = strategy !== "zero";
  const rate = (key: "story" | "review") =>
    rateForSegment(key, classKey, strategy);
  const pct = (v: number) => (priced && v > 0 ? `${v}%` : "—");
  const ceiling = peakRateForClass(classKey, strategy);
  const firstVisit = !billed && ticket.first_scanned_at == null;
  const firstVisitHint = firstVisit
    ? "Unlocks your Welcome Bonus — the biggest one"
    : "At the table, once per place";

  // QR only when scannable (MESITA-908).
  const scannable =
    live &&
    Boolean(ticket.check_code) &&
    (ticket.status === "open" || ticket.status === "awaiting_payment_confirm");

  const showIgHandle =
    (classKey === "influencer" || storyOnTicket) && Boolean(igHandle);

  const mapsUrl = googleMapsSearchUrl(placeName, ticket.place?.address);

  return (
    <Shell>
      {/* 1 · Place Info */}
      <section className="border-border bg-card flex shrink-0 items-center gap-2.5 rounded-[18px] border py-2 pr-3 pl-2">
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
        <div className="relative size-10 shrink-0 overflow-hidden rounded-xl">
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
            <p className="text-muted-foreground mt-0.5 truncate text-[10.5px] capitalize">
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
      </section>

      {/* 2 · Consumer Info — class label only, no ladder % (MESITA-908). */}
      <section className="border-border bg-card flex shrink-0 items-center gap-2.5 rounded-[18px] border px-3 py-2">
        <div className="size-9 shrink-0 overflow-hidden rounded-full">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              width={36}
              height={36}
              className="size-9 object-cover"
            />
          ) : (
            <DefaultAvatar className="size-9" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-[13px] leading-tight font-bold">
            {guestName ?? "Mesita guest"}
          </p>
          {showIgHandle ? (
            <p className="text-muted-foreground mt-0.5 truncate text-[10.5px]">
              @{igHandle!.replace(/^@/, "")}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-widest uppercase",
            classBadgeClass(classKey),
          )}
        >
          {classProperLabel(classKey)}
        </span>
      </section>

      {/* 3 · Reward Info — promise while open; utility when custom/zero. */}
      <section className="border-border bg-card shrink-0 rounded-[18px] border px-3 py-2">
        {cancelled ? (
          <p className="text-muted-foreground text-[12px] leading-snug">
            No reward on this visit — the ticket was cancelled.
          </p>
        ) : live && billed ? (
          <p className="text-[12px] leading-snug">
            <span className="text-foreground font-bold">
              {ticket.discount_percent ?? 0}% off applied
            </span>
            <span className="text-muted-foreground">
              {" "}
              — amount to pay shows under the QR.
            </span>
          </p>
        ) : closed ? (
          <p className="text-muted-foreground text-[12px] leading-snug">
            Visit closed — applied rate lives in Results below.
          </p>
        ) : priced && ceiling > 0 ? (
          <p className="text-[12px] leading-snug">
            <span className="text-foreground font-bold">
              Up to {ceiling}% — Discount for You.
            </span>{" "}
            <span className="text-muted-foreground/80">
              You always keep your single best reward — never added together.
            </span>
          </p>
        ) : (
          <p className="text-muted-foreground text-[12px] leading-snug">
            Your discount is set by the place and applied at the table.
          </p>
        )}
      </section>

      {/* 4 · Tasks Todo */}
      {!cancelled ? (
        <section className="border-border bg-card shrink-0 overflow-hidden rounded-2xl border">
          <div className="flex items-baseline justify-between gap-2 px-3 pt-2.5 pb-1">
            <h2 className="text-foreground text-[12.5px] font-bold tracking-tight">
              Your tasks
            </h2>
            <span className="text-muted-foreground text-[10px]">
              {priced ? "Optional — each one pays" : "Optional"}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 px-2 pb-2">
            {storyOnTicket ? (
              <TaskRow
                icon={<Instagram className="size-3.5 shrink-0" />}
                title="Post an Instagram story"
                hint="Tag the place — then confirm here"
                reward={pct(rate("story"))}
                state={taskStateFor(ticket.story_status)}
                onDo={
                  live
                    ? () => {
                        const st = taskStateFor(ticket.story_status);
                        if (st === "todo" || st === "rejected")
                          openSheet("instagram");
                      }
                    : undefined
                }
              />
            ) : null}
            <TaskRow
              icon={<Star className="size-3.5 shrink-0" />}
              title="Leave a Google review"
              hint={firstVisitHint}
              reward={pct(rate("review"))}
              state={taskStateFor(ticket.review_status)}
              onDo={
                live
                  ? () => {
                      const st = taskStateFor(ticket.review_status);
                      if (st === "todo" || st === "rejected")
                        openSheet("google");
                    }
                  : undefined
              }
            />
            <TaskRow
              icon={<UtensilsCrossed className="size-3.5 shrink-0" />}
              title="Rate it on Mesita"
              hint="Food · service · ambiance — feeds its rating"
              reward="★"
              state={reviewDone ? "done" : "todo"}
              onDo={
                reviewDone
                  ? undefined
                  : () => {
                      setReviewError(null);
                      openSheet("mesita");
                    }
              }
            />
          </div>
          {actionError ? (
            <p className="bg-destructive/10 text-destructive mx-3 mb-2.5 rounded-lg px-3 py-2 text-[12px]">
              {actionError}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* 5 · QR for waiter — scannable only */}
      {scannable ? (
        <section
          className={cn(
            "shrink-0 overflow-hidden rounded-[24px] px-4 pt-3 pb-3.5 text-white shadow-[0_16px_36px_-20px_rgba(255,77,109,0.55)]",
            passGradient(classKey),
            pulse && "animate-verified-pulse",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[9px] font-bold tracking-[0.14em] text-white/80 uppercase">
              Show to waiter
            </p>
            <span className="rounded-full bg-white/22 px-2 py-0.5 text-[9px] font-extrabold tracking-widest uppercase">
              QR
            </span>
          </div>
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
                <BadgeCheck className="size-3.5 shrink-0" /> Verified by{" "}
                {placeName}
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
                    (ticket.total_cents ?? 0) - (ticket.discount_cents ?? 0),
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
        </section>
      ) : null}

      {/* 6 · Results — closed only */}
      {closed ? (
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
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <p className="text-[15px] font-extrabold">Ticket cancelled</p>
                <p className="text-[11.5px] text-white/85">
                  Start a fresh one from Rewards whenever you&apos;re back.
                </p>
              </>
            )}
          </div>
        </section>
      ) : null}

      {/* 7 · Report (+ cancel housekeeping) */}
      <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
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
            <p className="border-border bg-muted/40 text-muted-foreground flex min-h-10 items-center gap-2 rounded-full border px-4 text-[12px] font-semibold">
              <Flag className="size-3.5" />
              Reported — Mesita is looking at it
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => openSheet("report")}
                className="border-border bg-card text-foreground hover:bg-muted/50 flex min-h-10 items-center gap-2 rounded-full border px-4 text-[12.5px] font-bold transition active:scale-[0.99]"
              >
                <Flag className="text-destructive size-3.5" />
                Report a problem
              </button>
              <p className="text-muted-foreground/80 max-w-[19rem] text-center text-[10px] leading-snug">
                Discount not honored, wrong total, anything off — a real person
                at Mesita reads it.
              </p>
            </>
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

      <GoogleReviewSheet
        open={sheet === "google"}
        onClose={() => setSheet(null)}
        placeName={placeName}
        mapsUrl={mapsUrl}
        onConfirm={confirmGoogle}
      />

      <InstagramStorySheet
        open={sheet === "instagram"}
        onClose={() => setSheet(null)}
        placeName={placeName}
        onConfirm={confirmStory}
      />

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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 pt-2.5 pb-5">
      {children}
    </div>
  );
}

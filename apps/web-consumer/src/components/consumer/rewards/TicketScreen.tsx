"use client";

// THE TICKET (MESITA-857) — one full-screen object for the whole lifecycle,
// per Notion Main §4.4: the passport, the place summary, the reward summary
// and the task checklist, on ONE screen whose sections change with state
// instead of three surfaces (modal / list card / detail) drifting apart.
//
//   hero   — place photo, name, category. WHERE this ticket is bound.
//   pass   — class-tinted gradient, white QR plate, live caption. Open →
//            scanned ✓ (pulse) → billed (amount block) → saved / cancelled.
//   tasks  — lifecycle step 3 as checkboxes, each row carrying its reward:
//            Instagram Story (only when the ticket carries the rung) ·
//            Google Review · Mesita Review (★ — pays nothing by design,
//            §4.2; it feeds the place's Mesita rating).
//   strip  — your discount now + the best-of rule, one line each.
//
// Welcome Visit is NOT a task row: it's detected server-side at billing, so
// showing it as something to "do" would be a lie. It lives in the strip.
//
// Data: the same polled list the wallet uses (one source, live updates ride
// the existing cadence). Proof screenshots remain DEMO_SCREENSHOT_URL
// (MESITA-824); the Mesita-review done-state is session-local until a read
// API for ticket_reviews exists; the report button waits for MESITA-843.

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
  PartyPopper,
  Star,
  Store,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  TicketReviewForm,
  type TicketReviewDraft,
} from "@/components/consumer/TicketReviewForm";
import { submitTicketReview } from "@/lib/api/pay";
import { formatCurrency } from "@/lib/api/profile";
import {
  ACTIVE_TICKET_STATUSES,
  apiCancelTicket,
  apiSubmitReview,
  apiSubmitStory,
  apiSubmitTicketTotal,
  checkUrlForCode,
  type ConsumerTicketRow,
} from "@/lib/api/tickets";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useConsumerClass } from "@/lib/class-context";
import { classProperLabel } from "@/lib/consumer-data";
import {
  PEAK_STRATEGY,
  REWARD_SEGMENT_BY_KEY,
  baseRateForClass,
} from "@/lib/reward-segments";
import { useConsumerTickets } from "@/lib/hooks/useConsumerTickets";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

// Class-tinted pass gradients — the passport identity (#548 lineage).
function passGradient(key: string): string {
  if (key === "aura")
    return "bg-[linear-gradient(150deg,#ff7a45_0%,#ffb03d_55%,#e0982e_100%)]";
  if (key === "influencer")
    return "bg-[linear-gradient(150deg,#ff7a45_0%,#4aa8ff_55%,#2f7fd6_100%)]";
  if (key === "premium")
    return "bg-[linear-gradient(150deg,#ff7a45_0%,#ff3d73_45%,#a13cf0_100%)]";
  return "bg-[linear-gradient(150deg,#ff7a45_0%,#ff4d6d_55%,#ff2d78_100%)]";
}

// awaiting_story is GONE (MESITA-849/#591): tasks are self-attested before
// the scan, so a ticket is only ever open or awaiting payment while live.
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

// One task row: checkbox → doing → done. The checkbox is REAL affordance —
// a circle that becomes a filled check — because "checklisted tasks" is the
// spec, not decorated buttons.
type TaskState = "todo" | "busy" | "checking" | "done" | "rejected";

function taskStateFor(v: string | null | undefined): TaskState {
  if (v == null || v === "not_required" || v === "pending") return "todo";
  if (v === "submitted") return "checking";
  if (v === "ai_rejected" || v === "staff_rejected") return "rejected";
  return "done"; // ai_verified / staff_verified / waiter_verified
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
        "flex min-h-14 w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition",
        done
          ? "bg-emerald-500/8"
          : state === "checking"
            ? "bg-muted/50"
            : "bg-muted/40 active:scale-[0.99]",
      )}
    >
      {/* The checkbox */}
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full border-2 transition",
          done
            ? "border-emerald-500 bg-emerald-500 text-white"
            : state === "checking" || state === "busy"
              ? "border-border text-muted-foreground"
              : "border-border",
        )}
      >
        {state === "busy" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : done ? (
          <Check className="size-3.5" strokeWidth={3} />
        ) : state === "checking" ? (
          <Loader2 className="size-3 animate-spin opacity-60" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "flex items-center gap-2 text-[13.5px] leading-tight font-bold",
            done ? "text-emerald-800" : "text-foreground",
          )}
        >
          {icon}
          <span className="truncate">{title}</span>
        </span>
        <span className="text-muted-foreground mt-0.5 block truncate text-[11.5px]">
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
          "font-display shrink-0 text-[15px] leading-none font-extrabold tabular-nums",
          done ? "text-emerald-700" : "text-foreground/80",
        )}
      >
        {reward}
      </span>
    </button>
  );
}

export function TicketScreen({
  userId,
  ticketId,
}: {
  userId: string;
  ticketId: string;
}) {
  const supabase = useBrowserSupabase();
  const router = useRouter();
  const tickets = useConsumerTickets(userId);
  const { key: classKey } = useConsumerClass();

  const ticket = useMemo(
    () =>
      tickets.active.find((t) => t.id === ticketId) ??
      tickets.history.find((t) => t.id === ticketId) ??
      null,
    [tickets.active, tickets.history, ticketId],
  );

  // The handshake pulse: fire once when polling flips first_scanned_at.
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

  // Task actions — real EFs, placeholder screenshot (MESITA-824).
  const [acting, setActing] = useState<"story" | "review" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const runProof = useCallback(
    async (kind: "story" | "review") => {
      setActing(kind);
      setActionError(null);
      try {
        if (kind === "story") await apiSubmitStory(supabase, ticketId);
        else await apiSubmitReview(supabase, ticketId);
        await tickets.refresh();
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Couldn't send that just yet.",
        );
      } finally {
        setActing(null);
      }
    },
    [supabase, ticketId, tickets],
  );

  // Mesita review — the real form; done-state session-local (no read API yet).
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);
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
    setActionError(null);
    try {
      await submitTicketReview(supabase, { ticketId, ...reviewDraft });
      setReviewDone(true);
      setReviewOpen(false);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Couldn't save your review.",
      );
    } finally {
      setReviewBusy(false);
    }
  }, [supabase, ticketId, reviewDraft]);

  // v3b amount fallback (MESITA-850): the staff bill is optional, so a
  // closed ticket may carry no amount. Ask the guest once — a record for
  // their savings history, never a money movement.
  const [totalDraft, setTotalDraft] = useState("");
  const [totalBusy, setTotalBusy] = useState(false);
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

  // ── Render states ──────────────────────────────────────────────────

  if (tickets.status === "loading" && !ticket) {
    return (
      <Shell>
        <div className="bg-muted h-40 animate-pulse rounded-[28px]" />
        <div className="bg-muted h-72 animate-pulse rounded-[28px]" />
        <div className="bg-muted h-40 animate-pulse rounded-2xl" />
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
  const base = baseRateForClass(classKey);
  const storyPeak = REWARD_SEGMENT_BY_KEY.story.rates[PEAK_STRATEGY];
  const reviewPeak = REWARD_SEGMENT_BY_KEY.review.rates[PEAK_STRATEGY];
  const welcomePeak = REWARD_SEGMENT_BY_KEY.welcome.rates[PEAK_STRATEGY];

  return (
    <Shell>
      {/* ── Hero: the place this ticket is bound to ── */}
      <section className="border-border bg-card overflow-hidden rounded-[28px] border">
        <div className="relative h-32 w-full">
          {photo ? (
            <Image src={photo} alt="" fill className="object-cover" />
          ) : (
            <div className="bg-pink-gradient grid h-full w-full place-items-center text-white/80">
              <Store className="size-8" />
            </div>
          )}
          <button
            type="button"
            onClick={() =>
              router.push(CONSUMER_ROUTES.rewards.root, { scroll: false })
            }
            aria-label="Back to Rewards"
            className="absolute top-3 left-3 grid size-9 place-items-center rounded-full bg-black/35 text-white backdrop-blur-sm transition active:scale-95"
          >
            <ArrowLeft className="size-4" />
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-foreground truncate text-[16px] leading-tight font-extrabold tracking-tight">
              {placeName}
            </p>
            {category ? (
              <p className="text-muted-foreground mt-0.5 truncate text-[11.5px] capitalize">
                {category.replaceAll("_", " ")}
              </p>
            ) : null}
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-widest uppercase",
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
      </section>

      {/* ── The pass ── */}
      <section
        className={cn(
          "overflow-hidden rounded-[28px] px-5 pt-5 pb-5 text-white shadow-[0_20px_44px_-22px_rgba(255,77,109,0.6)]",
          passGradient(classKey),
          pulse && "animate-verified-pulse",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold tracking-[0.14em] text-white/80 uppercase">
            Mesita Pass
          </p>
          <span className="rounded-full bg-white/22 px-2.5 py-1 text-[10px] font-extrabold tracking-widest uppercase">
            {classProperLabel(classKey)}
          </span>
        </div>

        {closed ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            {saved ? (
              <>
                <PartyPopper className="size-8" />
                <p className="text-[16px] font-extrabold">
                  {ticket.discount_cents
                    ? `You saved ${formatCurrency(ticket.discount_cents)}`
                    : "Visit complete"}
                </p>
                <p className="text-[12px] text-white/85">
                  {ticket.discount_percent
                    ? `${ticket.discount_percent}% off at ${placeName}`
                    : placeName}
                </p>
                {!billed ? (
                  <div className="mt-3 w-full max-w-[260px] rounded-xl bg-white/18 p-3 text-left">
                    <p className="text-[11px] font-bold tracking-wide uppercase opacity-90">
                      How much was the bill?
                    </p>
                    <p className="mt-0.5 text-[10.5px] leading-snug opacity-80">
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
                <p className="text-[16px] font-extrabold">Ticket cancelled</p>
                <p className="text-[12px] text-white/85">
                  Start a fresh one from Rewards whenever you&apos;re back.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            {ticket.check_code ? (
              <div className="mx-auto mt-4 w-full max-w-[min(230px,62vw)] rounded-[20px] bg-white p-3.5 shadow-[0_12px_30px_-12px_rgba(120,20,40,0.5)]">
                <QRCodeSVG
                  value={checkUrlForCode(ticket.check_code)}
                  size={230}
                  className="h-auto w-full"
                  bgColor="#ffffff"
                  fgColor="#2b1233"
                  level="M"
                  marginSize={0}
                />
              </div>
            ) : null}
            <p
              aria-live="polite"
              className="mx-auto mt-3 flex max-w-[32ch] items-center justify-center gap-1.5 text-center text-[12px] leading-snug text-white/90"
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
              <div className="mt-4 rounded-xl bg-white/18 p-3.5 text-center">
                <p className="text-[10px] font-bold tracking-[0.14em] uppercase opacity-90">
                  {ticket.discount_percent ?? 0}% off applied
                </p>
                <p className="font-display mt-0.5 text-2xl leading-none font-bold">
                  {formatCurrency(
                    Math.max(
                      0,
                      (ticket.total_cents ?? 0) - (ticket.discount_cents ?? 0),
                    ),
                  )}
                </p>
                <p className="mt-1 text-[11px] opacity-90">
                  to pay at the table
                  {ticket.discount_cents
                    ? ` — you save ${formatCurrency(ticket.discount_cents)}`
                    : ""}
                </p>
              </div>
            ) : null}
          </>
        )}
      </section>

      {/* ── Tasks checklist (lifecycle step 3) ── */}
      {!cancelled ? (
        <section className="border-border bg-card overflow-hidden rounded-2xl border">
          <div className="flex items-baseline justify-between gap-2 px-3.5 pt-3.5 pb-1.5">
            <h2 className="text-foreground text-[13px] font-bold tracking-tight">
              Your tasks
            </h2>
            <span className="text-muted-foreground text-[10.5px]">
              Optional — each one pays
            </span>
          </div>
          <div className="flex flex-col gap-1.5 px-2.5 pb-3">
            {storyOnTicket ? (
              <TaskRow
                icon={<Instagram className="size-4 shrink-0" />}
                title="Post an Instagram story"
                hint="Tag the place — then check it here"
                reward={`${storyPeak}%`}
                state={
                  acting === "story" ? "busy" : taskStateFor(ticket.story_status)
                }
                onDo={live ? () => void runProof("story") : undefined}
              />
            ) : null}
            <TaskRow
              icon={<Star className="size-4 shrink-0" />}
              title="Leave a Google review"
              hint="At the table, once per place"
              reward={`${reviewPeak}%`}
              state={
                acting === "review" ? "busy" : taskStateFor(ticket.review_status)
              }
              onDo={live ? () => void runProof("review") : undefined}
            />
            <TaskRow
              icon={<UtensilsCrossed className="size-4 shrink-0" />}
              title="Rate it on Mesita"
              hint="Food · service · ambiance — feeds its rating"
              reward="★"
              state={reviewDone ? "done" : "todo"}
              onDo={() => setReviewOpen(true)}
            />
          </div>
          {actionError ? (
            <p className="bg-destructive/10 text-destructive mx-3.5 mb-3 rounded-lg px-3 py-2 text-[12px]">
              {actionError}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* ── Reward strip ── */}
      {live ? (
        <section className="border-border bg-card rounded-2xl border px-3.5 py-3">
          <p className="text-foreground text-[12.5px] leading-snug font-semibold">
            Your discount: up to {base}% as {classProperLabel(classKey)} —
            first visit here pays {welcomePeak}% automatically.
          </p>
          <p className="text-muted-foreground/80 mt-1 text-[11px] leading-snug">
            You always keep your single best reward — never added together.
            The exact % is set by the place.
          </p>
        </section>
      ) : null}

      {/* ── Housekeeping ── */}
      {ticket.status === "open" ? (
        <button
          type="button"
          onClick={() => void cancel()}
          disabled={cancelling}
          className="text-muted-foreground hover:text-foreground mx-auto flex min-h-11 items-center gap-1.5 text-[12.5px] font-semibold transition"
        >
          {cancelling ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Cancel this ticket
        </button>
      ) : null}

      {/* Mesita review sheet — the real form, real ratings. */}
      <LocalSheet
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        ariaLabel={`Rate ${placeName} on Mesita`}
      >
        <div className="px-5 pt-4 pb-8">
          <TicketReviewForm
            draft={reviewDraft}
            onChange={setReviewDraft}
            onSubmit={() => void submitMesitaReview()}
            busy={reviewBusy}
            placeName={placeName}
          />
        </div>
      </LocalSheet>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 pt-4 pb-6">
      {children}
    </div>
  );
}

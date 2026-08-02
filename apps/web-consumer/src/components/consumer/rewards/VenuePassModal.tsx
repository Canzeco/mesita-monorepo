"use client";

// The venue pass (Wallet v3, MESITA-811): tap a place in New and this modal
// IS your Mesita pass for that venue — class-tinted card, the ticket QR,
// live status. Zero extra taps for most guests: it reuses the venue's open
// ticket when one exists (the EF guarantees one open ticket per guest×place)
// and otherwise creates it on open. Influencers get one interstitial tap —
// the Story opt-in is create-time only (wantsStory), so it can't be offered
// after an auto-create.
//
// The member code lives in the footer, not the page header: the moment you
// need the typed fallback (QR won't scan, WhatsApp staff bot) is exactly the
// moment you're staring at this modal.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  BadgeCheck,
  Check,
  Copy,
  Instagram,
  Loader2,
  PartyPopper,
  Sparkles,
} from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { formatCurrency } from "@/lib/api/profile";
import { EFError } from "@/lib/api/_invoke";
import type { Place } from "@/lib/api/places";
import {
  ACTIVE_TICKET_STATUSES,
  apiCancelTicket,
  apiCreateTicket,
  apiListConsumerTickets,
  checkUrlForCode,
  type ConsumerTicketRow,
} from "@/lib/api/tickets";
import { displayConsumerCode } from "@/lib/consumer-code";
import { useConsumerClass } from "@/lib/class-context";
import { classProperLabel } from "@/lib/consumer-data";
import type { ConsumerTicketsState } from "@/lib/hooks/useConsumerTickets";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

// Class-tinted pass gradients — ported from the retired passport card (#548):
// Standard coral · Premium violet · Influencer sky · Aura gold.
function passGradient(key: string, isElevated: boolean): string {
  if (key === "aura")
    return "bg-[linear-gradient(150deg,#ff7a45_0%,#ffb03d_55%,#e0982e_100%)]";
  if (key === "influencer")
    return "bg-[linear-gradient(150deg,#ff7a45_0%,#4aa8ff_55%,#2f7fd6_100%)]";
  if (isElevated)
    return "bg-[linear-gradient(150deg,#ff7a45_0%,#ff3d73_45%,#a13cf0_100%)]";
  return "bg-[linear-gradient(150deg,#ff7a45_0%,#ff4d6d_55%,#ff2d78_100%)]";
}

const STORY_LINE: Record<string, string> = {
  pending: "Bill is in. Post your tagged story so the place can approve it.",
  submitted: "Story sent — the place is checking it.",
  ai_rejected: "Story wasn't accepted — ask the staff to review it.",
  staff_rejected: "Story wasn't accepted — ask the staff to review it.",
};

function statusLine(t: ConsumerTicketRow): string {
  switch (t.status) {
    case "open":
      return "Show this QR — staff scan it to verify and start your visit.";
    case "awaiting_story":
      return STORY_LINE[t.story_status ?? ""] ?? STORY_LINE.pending;
    case "awaiting_payment_confirm":
      return "All set — pay the discounted total at the table.";
    default:
      return t.status;
  }
}

export function VenuePassModal({
  place,
  code,
  tickets,
  onClose,
  onTicketStarted,
}: {
  /** The venue this pass is for; null = closed. Parent remounts per place. */
  place: Place | null;
  /** Member code — the typed fallback in the footer. */
  code: string;
  tickets: ConsumerTicketsState;
  onClose: () => void;
  /** Fired once a live ticket exists, so the page can land on Pending. */
  onTicketStarted: () => void;
}) {
  const supabase = useBrowserSupabase();
  const { key: classKey } = useConsumerClass();
  const { isElevated, isInfluencer } = useMemo(
    () => ({
      isElevated: classKey !== "standard",
      isInfluencer: classKey === "influencer",
    }),
    [classKey],
  );

  // Adopt the venue's open ticket at mount (remount-per-place keys this).
  const [ticketId, setTicketId] = useState<string | null>(() =>
    place
      ? (tickets.active.find((t) => t.project_id === place.id)?.id ?? null)
      : null,
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wantsStory, setWantsStory] = useState(false);
  // Snapshot from the create response so the QR renders before refresh lands.
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const ticket = useMemo(() => {
    if (!ticketId) return null;
    return (
      tickets.active.find((t) => t.id === ticketId) ??
      tickets.history.find((t) => t.id === ticketId) ??
      null
    );
  }, [ticketId, tickets.active, tickets.history]);

  const create = useCallback(
    async (withStory: boolean) => {
      if (!place) return;
      setCreating(true);
      setError(null);
      try {
        const res = await apiCreateTicket(supabase, place.id, withStory);
        setTicketId(res.ticket.id);
        setCreatedCode(res.ticket.check_code);
        onTicketStarted();
        void tickets.refresh();
      } catch (err) {
        if (err instanceof EFError && err.code === "already_open") {
          // Race with another device/tab — adopt the existing ticket. The
          // friendly 409 carries its id; the unique-index race arm doesn't,
          // so fall back to a fresh list (never the stale closure state).
          const fromBody = err.body?.ticketId;
          let existingId = typeof fromBody === "string" ? fromBody : null;
          if (!existingId) {
            try {
              const rows = await apiListConsumerTickets(supabase);
              existingId =
                rows.find(
                  (t) =>
                    t.project_id === place.id &&
                    ACTIVE_TICKET_STATUSES.has(t.status),
                )?.id ?? null;
            } catch {
              // fall through to the error box
            }
          }
          if (existingId) {
            setTicketId(existingId);
            onTicketStarted();
            void tickets.refresh();
            setCreating(false);
            return;
          }
        }
        setError(
          err instanceof Error ? err.message : "Couldn't start your ticket.",
        );
      } finally {
        setCreating(false);
      }
    },
    [place, supabase, tickets, onTicketStarted],
  );

  // Auto-create on open for everyone but Influencers (their Story choice is
  // create-time only). One shot — the ref survives error → Retry is manual.
  const bootRef = useRef(false);
  useEffect(() => {
    if (!place || ticketId || isInfluencer || bootRef.current) return;
    bootRef.current = true;
    void create(false);
  }, [place, ticketId, isInfluencer, create]);

  const [cancelling, setCancelling] = useState(false);
  const cancel = useCallback(async () => {
    if (!ticketId) return;
    setCancelling(true);
    try {
      await apiCancelTicket(supabase, ticketId);
      await tickets.refresh();
      onClose();
    } catch {
      setCancelling(false);
    }
  }, [ticketId, supabase, tickets, onClose]);

  const displayCode = displayConsumerCode(code);
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard unavailable — ignore
    }
  };

  const placeName = place?.name ?? "the place";
  const live = ticket ? ACTIVE_TICKET_STATUSES.has(ticket.status) : false;
  const scanned = ticket?.first_scanned_at != null;
  const billed = (ticket?.total_cents ?? 0) > 0;
  const qrCode = ticket?.check_code ?? createdCode;

  return (
    <LocalSheet
      open={place !== null}
      onClose={onClose}
      ariaLabel={`Mesita pass for ${placeName}`}
    >
      <div className="flex flex-col gap-4 px-5 pt-4 pb-8">
        {/* The pass card */}
        <section
          className={cn(
            "overflow-hidden rounded-[24px] px-5 pt-5 pb-5 text-white shadow-[0_20px_44px_-22px_rgba(255,77,109,0.6)]",
            passGradient(classKey, isElevated),
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold tracking-[0.14em] text-white/80 uppercase">
                Mesita Pass
              </p>
              <p className="mt-0.5 truncate text-[17px] leading-tight font-extrabold tracking-tight">
                {placeName}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white/22 px-2.5 py-1 text-[10px] font-extrabold tracking-widest uppercase">
              {classProperLabel(classKey)}
            </span>
          </div>

          {/* Body by phase */}
          {ticket && !live ? (
            ticket.status === "revealed" ? (
              <div className="mt-5 flex flex-col items-center gap-2 pb-2 text-center">
                <PartyPopper className="size-8" />
                <p className="text-[15px] font-extrabold">
                  Visit complete
                  {ticket.discount_cents
                    ? ` — you saved ${formatCurrency(ticket.discount_cents)}`
                    : ""}
                </p>
                <p className="text-[12px] text-white/85">
                  It&apos;s in your History now.
                </p>
              </div>
            ) : (
              <div className="mt-5 flex flex-col items-center gap-2 pb-2 text-center">
                <p className="text-[15px] font-extrabold">Ticket closed</p>
                <p className="text-[12px] text-white/85">
                  Start a fresh one from New whenever you&apos;re back.
                </p>
              </div>
            )
          ) : qrCode ? (
            <>
              <div className="mx-auto mt-4 w-full max-w-[min(220px,60vw)] rounded-[20px] bg-white p-3.5 shadow-[0_12px_30px_-12px_rgba(120,20,40,0.5)]">
                <QRCodeSVG
                  value={checkUrlForCode(qrCode)}
                  size={220}
                  className="h-auto w-full"
                  bgColor="#ffffff"
                  fgColor="#2b1233"
                  level="M"
                  marginSize={0}
                />
              </div>
              <p
                aria-live="polite"
                className="mx-auto mt-3 flex max-w-[32ch] items-center justify-center gap-1.5 text-center text-[12px] leading-snug text-white/90"
              >
                {scanned ? (
                  <>
                    <BadgeCheck className="size-3.5 shrink-0" /> Verified by{" "}
                    {placeName}
                  </>
                ) : ticket ? (
                  statusLine(ticket)
                ) : (
                  "Show this QR — staff scan it to verify and start your visit."
                )}
              </p>
              {billed && ticket ? (
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
          ) : creating ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="size-6 animate-spin" />
              <p className="text-[12px] text-white/85">
                Getting your QR for {placeName}…
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 px-2 py-8 text-center">
              <p className="text-[12.5px] leading-snug text-white/95">{error}</p>
              <button
                type="button"
                onClick={() => void create(wantsStory)}
                className="rounded-xl bg-white/22 px-4 py-2 text-[12.5px] font-bold transition active:scale-[0.99]"
              >
                Try again
              </button>
            </div>
          ) : isInfluencer ? (
            // Influencer interstitial — the one create-time choice.
            <div className="mt-4 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setWantsStory((v) => !v)}
                aria-pressed={wantsStory}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border border-white/25 px-3.5 py-3 text-left transition",
                  wantsStory ? "bg-white/22" : "bg-white/10",
                )}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/20">
                  <Instagram className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold">
                    Add the Story bonus — yours alone
                  </span>
                  <span className="block text-[11.5px] leading-snug text-white/85">
                    Post a tagged story at the table for a bigger reward.
                  </span>
                </span>
                <span
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-white/60 text-[10px] font-bold",
                    wantsStory ? "bg-white text-[#ff2d78]" : "text-transparent",
                  )}
                >
                  ✓
                </span>
              </button>
              <button
                type="button"
                onClick={() => void create(wantsStory)}
                className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#ff2d78] transition active:scale-[0.99]"
              >
                <Sparkles className="size-4" />
                Get my QR
              </button>
            </div>
          ) : null}
        </section>

        {/* Live-ticket housekeeping */}
        {ticket?.status === "open" ? (
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

        {/* Member-code fallback — the typed backup when the QR won't scan. */}
        <div className="border-border bg-muted/40 flex items-center gap-3 rounded-2xl border px-3.5 py-3">
          <p className="text-muted-foreground min-w-0 flex-1 text-[11.5px] leading-snug">
            QR won&apos;t scan? Staff can type your member code instead.
          </p>
          <button
            type="button"
            onClick={() => void onCopy()}
            aria-label={copied ? "Code copied" : "Copy member code"}
            className="text-foreground flex min-h-11 shrink-0 items-center gap-1.5 font-mono text-[13px] font-semibold tracking-[0.14em]"
          >
            {displayCode}
            {copied ? (
              <Check className="size-3.5 text-emerald-600" />
            ) : (
              <Copy className="text-muted-foreground size-3.5" />
            )}
          </button>
        </div>
      </div>
    </LocalSheet>
  );
}

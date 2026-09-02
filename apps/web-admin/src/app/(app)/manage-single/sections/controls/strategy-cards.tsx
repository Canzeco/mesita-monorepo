"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Check, Loader2, X } from "lucide-react";
import { type Strategy, type StrategyId } from "@/lib/business/strategies";
import {
  giveWord,
  placementWord,
  RUNG_WORDS,
  type CardState,
  type RungWord,
} from "../promo-state";
import {
  cx,
  formatMoney,
  MEMBERSHIP_PRICE_MXN,
  ZERO_STRATEGY_ID,
} from "./shared";

// Strategy cards + the product modal. Moved verbatim out of PromosSection.tsx
// on 2026-09-02 (file split, no behaviour change).

// Per-strategy visual identity. Art = generated 1:1 abstract waves (no text
// in pixels — copy stays HTML); the gradient paints behind the image so a
// slow or missing asset still renders a branded band. `accent` colours the
// Give / Placement words.
const CARD_ART: Record<
  StrategyId,
  { src: string; fallback: string; cta: string; accent: string }
> = {
  zero: {
    src: "/promos/strategy-zero.jpg",
    fallback: "from-slate-800 to-slate-500",
    cta: "",
    accent: "text-slate-500",
  },
  conservative: {
    src: "/promos/strategy-conservative.jpg",
    fallback: "from-emerald-900 to-teal-500",
    cta: "from-emerald-600 to-teal-500",
    accent: "text-emerald-600",
  },
  aggressive: {
    src: "/promos/strategy-aggressive.jpg",
    fallback: "from-red-800 to-orange-500",
    cta: "from-red-600 to-orange-500",
    accent: "text-orange-600",
  },
  // No art file yet — the gradient IS the fallback, which is why it exists.
  // Violet reads as the rung above orange without colliding with any other
  // strategy on the rail.
  dominant: {
    src: "/promos/strategy-dominant.jpg",
    fallback: "from-violet-900 to-fuchsia-500",
    cta: "from-violet-600 to-fuchsia-500",
    accent: "text-violet-600",
  },
};


// ─── Box 3 · Strategy card — Give and Placement as Low · Mid · High ────────
//
// The face answers two questions — how much do I give, what do I get — in
// words. Every rate behind them is one tap away in the modal.

export function StrategyCard({
  strategy,
  state,
  pending,
  onOpen,
}: {
  strategy: Strategy;
  state: CardState;
  pending: boolean;
  onOpen: () => void;
}) {
  const art = CARD_ART[strategy.id];
  const paid = strategy.id !== ZERO_STRATEGY_ID;
  const { selected, cta } = state;
  const give = giveWord(strategy.id);
  const placement = placementWord(strategy.visibility);
  const ariaState = selected
    ? " (current)"
    : cta === "locked"
      ? " (join partnership first)"
      : "";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`${strategy.name} — details${ariaState}`}
      className={cx(
        "bg-card group relative flex flex-col overflow-hidden rounded-2xl border text-left transition",
        selected
          ? "border-foreground/70 ring-foreground/70 ring-2"
          : "border-border/60 motion-safe:hover:-translate-y-0.5 hover:shadow-card",
      )}
    >
      <ArtBand strategy={strategy} art={art} height="h-24">
        {selected && (
          <span className="text-foreground absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 type-meta font-bold tracking-wide uppercase shadow-card">
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Current
          </span>
        )}
      </ArtBand>

      <div className="flex w-full flex-1 flex-col gap-3.5 p-4">
        <RungStat
          label="Give"
          value={give}
          valueClass={paid ? art.accent : "text-muted-foreground"}
        />
        <RungStat
          label="Placement"
          value={placement}
          valueClass={paid ? art.accent : "text-muted-foreground"}
        />

        {/* Presentational CTA — the whole card is the button; the modal
            carries the real action. Join lives on Partnership, not here. */}
        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          {cta === "current" ? (
            <span className="border-border text-muted-foreground inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full border text-xs font-bold">
              <Check className="h-3.5 w-3.5" />
              Current
            </span>
          ) : (
            <span
              className={cx(
                "inline-flex h-11 w-full items-center justify-center rounded-full text-xs font-bold",
                cta === "locked"
                  ? "border-border text-muted-foreground border"
                  : paid
                    ? cx("bg-gradient-to-r text-white", art.cta)
                    : "border-border text-foreground/75 border",
              )}
            >
              {cta === "locked"
                ? "Join partnership first"
                : paid
                  ? "Switch"
                  : "Switch to Zero"}
            </span>
          )}
          <span className="text-muted-foreground group-hover:text-foreground text-center type-label font-medium transition">
            Details
          </span>
        </div>
      </div>
    </button>
  );
}

/** The strategy's art header — shared by the card and its modal. */
export function ArtBand({
  strategy,
  art,
  height,
  sizes = "(min-width:640px) 50vw, 100vw",
  titleId,
  children,
}: {
  strategy: Strategy;
  art: (typeof CARD_ART)[StrategyId];
  height: string;
  sizes?: string;
  titleId?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cx(
        "relative w-full shrink-0 bg-gradient-to-br",
        height,
        art.fallback,
      )}
    >
      {/* Gradient behind the image is the loading/404 fallback; the scrim
          keeps the white name legible. */}
      <Image src={art.src} alt="" fill sizes={sizes} className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
      {children}
      <p
        id={titleId}
        className="font-display absolute inset-x-4 bottom-2.5 truncate text-sm font-bold tracking-wide text-white uppercase drop-shadow-card"
      >
        <span className="mr-1" aria-hidden>
          {strategy.emoji}
        </span>
        {strategy.name}
      </p>
    </div>
  );
}

/** Give / Placement as a Low · Mid · High word ladder. No meters, no percents. */
export function RungStat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: RungWord;
  valueClass: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground type-meta font-bold tracking-[0.14em] uppercase">
        {label}
      </span>
      <p
        className="flex items-baseline gap-2.5"
        aria-label={`${label} ${value}`}
      >
        {RUNG_WORDS.map((rung) => (
          <span
            key={rung}
            className={cx(
              "font-display text-base leading-none font-bold tracking-tight",
              rung === value ? valueClass : "text-muted-foreground/35",
            )}
          >
            {rung}
          </span>
        ))}
      </p>
    </div>
  );
}


// ─── Product modal — full detail + the action ───────────────────────────────

export function ProductModal({
  strategy,
  currency,
  state,
  member,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  strategy: Strategy;
  currency: string | null;
  state: CardState;
  member: boolean;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  // Native <dialog> (WCAG 2.4.3): showModal() renders the page behind inert
  // and handles Escape natively — Escape fires `cancel`, blocked while a
  // pessimistic write is in flight. React unmounts this component on close,
  // which skips the `close` event, so focus-restore to the opening card runs
  // in the effect cleanup instead.
  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    return () => opener?.focus();
  }, []);

  const art = CARD_ART[strategy.id];
  const paid = strategy.id !== ZERO_STRATEGY_ID;
  const kind = state.cta;
  const isCurrent = kind === "current";
  const price = formatMoney(MEMBERSHIP_PRICE_MXN, currency);
  const give = giveWord(strategy.id);
  const placement = placementWord(strategy.visibility);

  const primaryLabel =
    kind === "current"
      ? "Current strategy"
      : kind === "locked"
        ? "Join partnership first"
        : kind === "switch"
          ? `Switch to ${strategy.name}`
          : "Switch to Zero";

  const footerNote =
    kind === "current"
      ? ""
      : kind === "locked"
        ? `The subscription is Partnership at ${price}/month. Join there, then switch strategies free.`
        : kind === "switch_zero"
          ? "Partnership stays active; discounts pause. Promo lane closes until you pick a paid strategy again."
          : "Applies to new tickets only — open tickets keep the rates they were created with.";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="product-modal-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
      onClose={onClose}
      onClick={(e) => {
        // p-0 + inner content wrapper: a click whose target is the <dialog>
        // itself can only be the ::backdrop.
        if (!busy && e.target === e.currentTarget) onClose();
      }}
      className="border-border bg-card m-auto hidden max-h-[88vh] w-[min(28rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border p-0 shadow-elev backdrop:bg-black/45 backdrop:backdrop-blur-sm open:flex max-sm:mt-auto max-sm:mb-4"
    >
      <ArtBand
        strategy={strategy}
        art={art}
        height="h-28"
        sizes="28rem"
        titleId="product-modal-title"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close"
          className="absolute top-2.5 right-2.5 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white transition hover:bg-black/50 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
        {isCurrent && (
          <span className="text-foreground absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 type-meta font-bold tracking-wide uppercase shadow-card">
            <Check className="h-3 w-3" />
            Current
          </span>
        )}
      </ArtBand>

      {/* Detail — everything the card abstracts away. */}
      <div className="flex flex-col gap-4 overflow-y-auto p-5">
        <p className="text-muted-foreground type-body leading-snug">
          {strategy.tagline}
        </p>

        <div className="grid grid-cols-2 gap-4">
          <RungStat
            label="Give"
            value={give}
            valueClass={paid ? art.accent : "text-muted-foreground"}
          />
          <RungStat
            label="Placement"
            value={placement}
            valueClass={paid ? art.accent : "text-muted-foreground"}
          />
        </div>

        {paid ? (
          <div className="flex flex-col gap-3">
              {/* Canonical step titles — mirror Tutorial and the Partnership
                  lifecycle rail. Never fork the wording. */}
              <ModalLabel>How it works</ModalLabel>
              <Step n={1} title="Join the partnership">
                {price}/month — one subscription, then switch strategies free.
              </Step>
              <Step n={2} title="Pick a strategy">
                Confirming makes {strategy.name} your posture — switch free
                anytime.
              </Step>
              <Step n={3} title="Honor guest checks">
                Staff scan the guest&apos;s QR on Mesita Validate — honoring the
                first check at the bill makes you live.
              </Step>
              <p className="text-muted-foreground type-meta leading-snug">Refusing a guest is a strike: 1 warning · 2 paused 30 days · 3 removed.</p>
            </div>
        ) : (
          <div className="flex flex-col gap-2">
            <ModalLabel>How it works</ModalLabel>
            <p className="text-muted-foreground text-xs leading-snug">
              {member
                ? "Zero pauses discounts — partnership stays active. Drop the partnership separately if you want to leave."
                : "Non-partners stay at Zero — no discounts. Join the partnership to unlock the paid strategies."}
            </p>
          </div>
        )}
      </div>

      {/* Action footer — pessimistic membership writes keep the dialog
            open with a busy primary; failures render here as an alert. */}
      <div className="border-border flex flex-col gap-2 border-t p-4">
        {error && (
          <p role="alert" className="text-destructive type-label font-medium">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={isCurrent || busy || kind === "locked"}
            onClick={onConfirm}
            className={cx(
              "inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-5 type-body font-bold transition disabled:opacity-70",
              isCurrent || kind === "locked"
                ? "border-border text-muted-foreground border"
                : !member || paid
                  ? cx(
                      "bg-gradient-to-r text-white hover:brightness-105 active:scale-[0.99]",
                      art.cta || "from-slate-600 to-slate-500",
                    )
                  : "border-border text-foreground hover:bg-muted border",
            )}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              isCurrent && <Check className="mr-1.5 h-3.5 w-3.5" />
            )}
            {primaryLabel}
          </button>
        </div>
        {footerNote && (
          <p className="text-muted-foreground type-meta leading-snug">
            {footerNote}
          </p>
        )}
      </div>
    </dialog>
  );
}

function ModalLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground type-meta font-bold tracking-[0.14em] uppercase">
      {children}
    </span>
  );
}

// One numbered step in the modal's "How it works" flow.
function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="bg-foreground text-background mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full type-label font-bold tabular-nums">
        {n}
      </span>
      <div className="flex flex-col">
        <p className="text-foreground/90 type-body leading-snug font-semibold">
          {title}
        </p>
        {children && (
          <p className="text-muted-foreground type-label leading-snug">
            {children}
          </p>
        )}
      </div>
    </div>
  );
}


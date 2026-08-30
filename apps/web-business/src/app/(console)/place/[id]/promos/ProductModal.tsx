import { useEffect } from "react";
import Image from "next/image";
import { Check, Loader2, X } from "lucide-react";
import {
  DEFAULT_DISCOUNT_CAP_MXN,
  DISCOUNT_CAPS_MXN,
  type Strategy,
} from "@/lib/business/strategies";
import type { PromosConfig, StrategyKey } from "@/lib/business/promos";
import { cn, formatMoney } from "@/lib/utils";
import { CARD_ART } from "./promoConstants";
import { ModalLabel, RateMatrix, Step, StrategyMeters } from "./promoShared";

export function ProductModal({
  strategy,
  cfg,
  currency,
  capMxn,
  isCurrent,
  billingBusy,
  onCommit,
  onClose,
}: {
  strategy: Strategy;
  cfg: PromosConfig;
  currency: string;
  capMxn?: number;
  isCurrent: boolean;
  billingBusy: boolean;
  onCommit: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const art = CARD_ART[strategy.id];
  const paid = strategy.id !== "zero";
  const isZeroSwitch = strategy.id === "zero";
  const capLabel = capMxn ?? DEFAULT_DISCOUNT_CAP_MXN;
  const capOptionsLabel = DISCOUNT_CAPS_MXN.map((n) =>
    formatMoney(n, currency),
  ).join(" / ");

  const primaryLabel = isCurrent
    ? "Current Strategy"
    : paid
      ? `Switch to ${strategy.name}`
      : "Switch to Zero";

  const footerNote = isCurrent
    ? ""
    : isZeroSwitch
      ? "Partnership stays active; discounts pause. The reward lane closes until you pick a paid strategy again."
      : "Applies to new tickets only — open tickets keep the rates they were created with.";

  const onPrimary = () => {
    if (isCurrent || billingBusy) return;
    onCommit();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
        className="border-border bg-card relative z-10 flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border shadow-xl"
      >
        <div
          className={cn(
            "relative h-32 shrink-0 bg-gradient-to-br",
            art.fallback,
          )}
        >
          <Image
            src={art.src}
            alt=""
            fill
            sizes="28rem"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-2.5 right-2.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white transition hover:bg-black/50"
          >
            <X className="h-4 w-4" />
          </button>
          {isCurrent && (
            <span className="text-foreground absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase shadow-sm">
              <Check className="h-3 w-3" />
              Current
            </span>
          )}
          <div className="absolute inset-x-4 bottom-3">
            <p
              id="product-modal-title"
              className="font-display text-lg font-bold tracking-wide text-white uppercase drop-shadow-sm"
            >
              <span className="mr-1.5" aria-hidden>
                {strategy.emoji}
              </span>
              {strategy.name}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          <p className="text-muted-foreground text-[13px] leading-snug">
            {strategy.tagline}
          </p>

          {/* The card's two meters, then everything they abstract away. */}
          <div className="grid grid-cols-2 gap-4">
            <StrategyMeters strategy={strategy} art={art} cfg={cfg} compact />
          </div>

          {paid && (
            <div className="flex flex-col gap-2">
              <ModalLabel>Every rate</ModalLabel>
              <RateMatrix cfg={cfg} strategy={strategy.id as StrategyKey} />
              <p className="text-muted-foreground text-[11px] leading-snug">
                {capMxn != null
                  ? `Every discount applies to the first ${formatMoney(capLabel, currency)} of the bill — your chosen discount cap, shown to guests.`
                  : `Every discount applies to the first portion of the bill, capped at your chosen discount cap (${capOptionsLabel}) — shown to guests.`}
              </p>
            </div>
          )}

          {paid ? (
            <div className="flex flex-col gap-3">
              <ModalLabel>How it works</ModalLabel>
              <Step n={1} title="Staff scan the guest's QR">
                Nothing to install: any phone camera opens Mesita Validate.
              </Step>
              <Step n={2} title="Honor the first check">
                The first honored ticket at the bill makes you live.
              </Step>
              <p className="text-muted-foreground text-[10px] leading-snug">
                Turn a guest away and it&apos;s a strike — 1 warning · 2
                discounts paused 30 days · 3 removed.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <ModalLabel>How it works</ModalLabel>
              <p className="text-muted-foreground text-[12px] leading-snug">
                Zero pauses discounts — Partnership stays. Drop Partnership
                separately if you want to leave.
              </p>
            </div>
          )}
        </div>

        <div className="border-border flex flex-col gap-2 border-t p-4">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={isCurrent || billingBusy}
              onClick={onPrimary}
              className={cn(
                "inline-flex h-11 items-center justify-center rounded-full px-5 text-[13px] font-bold transition",
                isCurrent
                  ? "border-border text-muted-foreground border"
                  : paid
                    ? cn(
                        "bg-gradient-to-r text-white hover:brightness-105 active:scale-[0.99]",
                        art.cta || "from-slate-600 to-slate-500",
                      )
                    : "border-border text-foreground hover:bg-muted border",
                billingBusy && "opacity-70",
              )}
            >
              {billingBusy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : isCurrent ? (
                <Check className="mr-1.5 h-3.5 w-3.5" />
              ) : null}
              {billingBusy ? "Working…" : primaryLabel}
            </button>
          </div>
          {footerNote && (
            <p className="text-muted-foreground text-[10px] leading-snug">
              {footerNote}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

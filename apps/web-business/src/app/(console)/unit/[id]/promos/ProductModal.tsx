import { useEffect } from "react";
import Image from "next/image";
import { Check, Loader2, X } from "lucide-react";
import { UNIVERSAL_CAP_MXN, type Strategy } from "@/lib/business/strategies";
import { cn, formatMoney } from "@/lib/utils";
import { CARD_ART, PRODUCT_PRICE_MXN } from "./promoConstants";
import {
  isPaidStrategy,
  ModalLabel,
  PlacementReward,
  RateMatrix,
  Step,
} from "./promoShared";

export function ProductModal({
  strategy,
  currency,
  isCurrent,
  subscribed,
  billingBusy,
  onCommit,
  onClose,
}: {
  strategy: Strategy;
  currency: string;
  isCurrent: boolean;
  subscribed: boolean;
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
  const paid = isPaidStrategy(strategy.id);
  const r = strategy.rates;
  const needsJoin = paid && !subscribed;
  const priceLabel = formatMoney(PRODUCT_PRICE_MXN, currency);

  const primaryLabel = isCurrent
    ? "Current Strategy"
    : paid
      ? subscribed
        ? `Switch to ${strategy.name}`
        : `Join — ${priceLabel}/year`
      : "Drop to Zero";

  const onPrimary = () => {
    if (isCurrent || billingBusy) return;
    onCommit();
  };

  const footerNote = (): string => {
    if (needsJoin)
      return "Starts Verified membership billing, then Mesita activates staff WhatsApp.";
    if (subscribed && paid && !isCurrent)
      return "Rates change now — Mesita follows up on the billing.";
    if (subscribed && !paid)
      return "Cancels Verified membership (keeps listing on Mesita).";
    return "";
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
        {/* Art header */}
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
            <p className="text-[12px] font-semibold text-white/90 drop-shadow-sm">
              {paid ? (
                <>
                  {priceLabel}{" "}
                  <span className="font-normal text-white/80">/ year</span>
                </>
              ) : (
                "Free"
              )}
            </p>
          </div>
        </div>

        {/* Detail */}
        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          <p className="text-muted-foreground text-[13px] leading-snug">
            {strategy.tagline}
          </p>

          <div className="flex flex-col gap-2">
            <ModalLabel>You give</ModalLabel>
            {paid ? (
              <>
                <RateMatrix rates={r} />
                <p className="text-muted-foreground text-[11px] leading-snug">
                  Every discount applies to the first{" "}
                  {formatMoney(strategy.cap ?? UNIVERSAL_CAP_MXN, currency)} of
                  the bill — a platform-wide cap, always shown to guests.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-[12px] leading-snug">
                Nothing — Zero is free. No discounts.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <ModalLabel>You receive</ModalLabel>
            <PlacementReward strategy={strategy} art={art} />
          </div>

          {paid ? (
            <div className="flex flex-col gap-3">
              <ModalLabel>How it works</ModalLabel>
              <Step n={1} title="Pay the membership">
                {priceLabel}/year Verified membership — one Strategy at a
                time; switching later is a new membership.
              </Step>
              <Step n={2} title="Set up your staff on WhatsApp">
                We send a test ping so your team can receive guest tickets.
              </Step>
              <Step n={3} title="Redeem your first guest reward">
                Honor the first ticket at the bill and you&apos;re live.
              </Step>
              <p className="text-muted-foreground text-[10px] leading-snug">
                Turn a guest away and it&apos;s a strike — 1 warning · 2
                discounts paused 30 days · 3 removed. Strikes decay after 6
                months clean.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <ModalLabel>How it works</ModalLabel>
              <p className="text-muted-foreground text-[12px] leading-snug">
                No membership, nothing to set up — Zero is free and you stay
                listed on Mesita. Join a Strategy any time.
              </p>
            </div>
          )}
        </div>

        {/* Action footer */}
        <div className="border-border flex flex-col gap-2 border-t p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold">
              {paid ? (
                <>
                  {priceLabel}
                  <span className="text-muted-foreground text-[11px] font-normal">
                    {" "}
                    / year
                  </span>
                </>
              ) : (
                "Free"
              )}
            </span>
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
                        art.cta,
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
          <p className="text-muted-foreground text-[10px] leading-snug">
            {footerNote()}
          </p>
        </div>
      </div>
    </div>
  );
}

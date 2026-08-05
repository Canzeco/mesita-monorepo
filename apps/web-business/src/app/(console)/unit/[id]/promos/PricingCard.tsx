import Image from "next/image";
import { Check, Loader2 } from "lucide-react";
import { UNIVERSAL_CAP_MXN, type Strategy } from "@/lib/business/strategies";
import { cn, formatMoney } from "@/lib/utils";
import { CARD_ART, PRODUCT_PRICE_MXN } from "./promoConstants";
import { ModalLabel, PlacementReward, RateMatrix } from "./promoShared";

// Whole card opens the product modal.
export function PricingCard({
  strategy,
  currency,
  selected,
  pending,
  subscribed,
  joinDisabled,
  onOpen,
}: {
  strategy: Strategy;
  currency: string;
  selected: boolean;
  pending: boolean;
  subscribed: boolean;
  joinDisabled?: boolean;
  onOpen: () => void;
}) {
  const art = CARD_ART[strategy.id];
  const paid = strategy.id !== "zero";
  const r = strategy.rates;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`${strategy.name} — details${selected ? " (current)" : ""}${!subscribed ? " (locked)" : ""}`}
      className={cn(
        "bg-card relative flex flex-col overflow-hidden rounded-2xl border text-left transition",
        selected
          ? "border-foreground/70 ring-foreground/70 ring-2"
          : "border-border hover:shadow-[0_18px_32px_-20px_rgba(236,72,153,0.35)] motion-safe:hover:-translate-y-0.5",
        !subscribed && !selected && "opacity-75",
        joinDisabled && "pointer-events-none opacity-50",
      )}
    >
      {/* Art band — gradient behind the image is the loading/404 fallback;
          the scrim keeps the white name/price legible. */}
      <div
        className={cn(
          "relative h-28 w-full shrink-0 bg-gradient-to-br",
          art.fallback,
        )}
      >
        <Image
          src={art.src}
          alt=""
          fill
          sizes="(min-width:480px) 50vw, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
        {selected && (
          <span className="text-foreground absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase shadow-sm">
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Current
          </span>
        )}
        <div className="absolute inset-x-3.5 bottom-2.5">
          <p className="font-display truncate text-sm font-bold tracking-wide text-white uppercase drop-shadow-sm">
            <span className="mr-1" aria-hidden>
              {strategy.emoji}
            </span>
            {strategy.name}
          </p>
        </div>
      </div>

      {/* Give → receive → join (MESITA-590). No hero — the matrix IS the
          pitch, Welcome-first, capped, super simple. */}
      <div className="flex w-full flex-1 flex-col gap-3 p-3.5">
        <div className="flex flex-col gap-1.5">
          <ModalLabel>You give</ModalLabel>
          {paid ? (
            <>
              <p className="text-muted-foreground text-[11px] leading-snug">
                These discounts, capped at{" "}
                {formatMoney(strategy.cap ?? UNIVERSAL_CAP_MXN, currency)} per
                bill:
              </p>
              <RateMatrix rates={r} />
            </>
          ) : (
            <p className="text-muted-foreground text-[12px] leading-snug">
              Nothing — Zero is free. No discounts.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <ModalLabel>You receive</ModalLabel>
          <PlacementReward strategy={strategy} art={art} />
        </div>

        <div className="mt-auto pt-1">
          {/* Presentational CTA — the whole card is the button; the modal
              carries the real action. */}
          {selected ? (
            <span className="border-border text-muted-foreground inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full border text-[12px] font-bold">
              <Check className="h-3.5 w-3.5" />
              Current
            </span>
          ) : !subscribed ? (
            <span
              className={cn(
                "inline-flex h-11 w-full items-center justify-center rounded-full text-[12px] font-bold text-white",
                paid ? cn("bg-gradient-to-r", art.cta) : "border-border border bg-transparent text-foreground/75",
              )}
            >
              Join
            </span>
          ) : (
            <span
              className={cn(
                "inline-flex h-11 w-full items-center justify-center rounded-full text-[12px] font-bold",
                paid
                  ? cn("bg-gradient-to-r text-white", art.cta)
                  : "border-border text-foreground/75 border",
              )}
            >
              {paid ? "Switch" : "Switch to Zero"}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

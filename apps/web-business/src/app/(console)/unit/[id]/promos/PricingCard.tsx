import Image from "next/image";
import { Check, Loader2 } from "lucide-react";
import { type Strategy } from "@/lib/business/strategies";
import type { PromosConfig } from "@/lib/business/promos-v10";
import { cn } from "@/lib/utils";
import { CARD_ART } from "./promoConstants";
import { StrategyMeters } from "./promoShared";

// Whole card opens the product modal.
//
// MESITA-1001: the face used to carry the 2×2 rate table on every card, which
// made the grid a spreadsheet you had to read before you could choose. It now
// answers the only two questions a posture has — how much do I give, what do I
// get — on one shared three-segment rail, with the expected cost per bill as
// the number. Every rate behind them is one tap away in the modal.
export function PricingCard({
  strategy,
  cfg,
  selected,
  pending,
  subscribed,
  joinDisabled,
  onOpen,
}: {
  strategy: Strategy;
  cfg: PromosConfig;
  selected: boolean;
  pending: boolean;
  subscribed: boolean;
  joinDisabled?: boolean;
  onOpen: () => void;
}) {
  const art = CARD_ART[strategy.id];
  const paid = strategy.id !== "zero";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`${strategy.name} — details${selected ? " (current)" : ""}${joinDisabled ? " (unavailable — membership forfeited)" : ""}`}
      className={cn(
        "bg-card group relative flex flex-col overflow-hidden rounded-2xl border text-left transition",
        selected
          ? "border-foreground/70 ring-foreground/70 ring-2"
          : "border-border hover:shadow-[0_18px_32px_-20px_rgba(236,72,153,0.35)] motion-safe:hover:-translate-y-0.5",
        joinDisabled && "pointer-events-none opacity-50",
      )}
    >
      {/* Art band — gradient behind the image is the loading/404 fallback;
          the scrim keeps the white name legible. */}
      <div
        className={cn(
          "relative h-24 w-full shrink-0 bg-gradient-to-br",
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
        <p className="font-display absolute inset-x-4 bottom-2.5 truncate text-sm font-bold tracking-wide text-white uppercase drop-shadow-sm">
          <span className="mr-1" aria-hidden>
            {strategy.emoji}
          </span>
          {strategy.name}
        </p>
      </div>

      <div className="flex w-full flex-1 flex-col gap-3.5 p-4">
        <StrategyMeters strategy={strategy} art={art} cfg={cfg} />

        {/* Presentational CTA — the whole card is the button; the modal
            carries the real action. */}
        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          {selected ? (
            <span className="border-border text-muted-foreground inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full border text-[12px] font-bold">
              <Check className="h-3.5 w-3.5" />
              Current
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
              {!subscribed ? "Join" : paid ? "Switch" : "Switch to Zero"}
            </span>
          )}
          <span className="text-muted-foreground group-hover:text-foreground text-center text-[10.5px] font-medium transition">
            See full rates &amp; rules
          </span>
        </div>
      </div>
    </button>
  );
}

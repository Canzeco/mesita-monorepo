import { Loader2 } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { PRODUCT_PRICE_MXN } from "./promoConstants";
import { PerksTable } from "./PerksTable";

export function PartnershipOffer({
  currency,
  forfeited,
  billingBusy,
  error,
  onJoin,
}: {
  currency: string;
  forfeited: boolean;
  billingBusy: boolean;
  error: string | null;
  onJoin: () => void;
}) {
  const price = formatMoney(PRODUCT_PRICE_MXN, currency);
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
          Partnership
        </p>
        <p className="font-display text-[2.25rem] leading-none font-semibold tracking-tight">
          {price}
          <span className="text-muted-foreground ml-1.5 text-base font-normal tracking-normal">
            / year
          </span>
        </p>
        <p className="text-muted-foreground mt-1 text-[13px] leading-snug">
          Run guest rewards. Guests see you as a Mesita Partner once you give.
        </p>
      </header>

      <PerksTable />

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={billingBusy}
          onClick={onJoin}
          className="bg-pink-gradient inline-flex min-h-11 w-full items-center justify-center rounded-full px-5 text-[14px] font-semibold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99] disabled:opacity-70"
        >
          {billingBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : forfeited ? (
            `Re-join Partnership · ${price}/year`
          ) : (
            `Join Partnership · ${price}/year`
          )}
        </button>
        <p className="text-muted-foreground text-[11px] leading-snug">
          After you join, pick Zero, Conservative, or Aggressive. Switch free
          anytime.
        </p>
        {error ? <p className={ERROR_BOX_CLASS}>{error}</p> : null}
      </div>
    </div>
  );
}

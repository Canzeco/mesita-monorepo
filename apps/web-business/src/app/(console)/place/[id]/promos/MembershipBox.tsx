import { formatMoney } from "@/lib/utils";
import { PRODUCT_PRICE_MXN } from "./promoConstants";
import { MembershipStatusPill, type MembershipPillState } from "./promoShared";

export function MembershipBox({
  currency,
  pillState,
  billingBusy,
  onDrop,
}: {
  currency: string;
  pillState: MembershipPillState;
  billingBusy: boolean;
  onDrop: () => void;
}) {
  const price = formatMoney(PRODUCT_PRICE_MXN, currency);
  const canDrop = pillState !== "not_member" && pillState !== "forfeited";

  return (
    <div className="flex min-h-11 items-center gap-2">
      <MembershipStatusPill state={pillState} />
      <p className="text-muted-foreground min-w-0 flex-1 truncate text-[12px] leading-none">
        {price}/year
      </p>
      {canDrop ? (
        <button
          type="button"
          disabled={billingBusy}
          onClick={onDrop}
          className="text-muted-foreground hover:text-destructive shrink-0 text-[12px] font-semibold underline underline-offset-4 transition disabled:opacity-60"
        >
          Drop Partnership
        </button>
      ) : null}
    </div>
  );
}

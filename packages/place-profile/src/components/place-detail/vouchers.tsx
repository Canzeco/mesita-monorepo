"use client";

import { useEffect } from "react";
import { Coins, Ticket } from "lucide-react";

import type { PlaceActions } from "../../actions";
import { inertButtonProps } from "../../actions";
import { cn } from "../../lib/format";
import { PLACE_BUTTON_CLASS } from "../../lib/ui";
import type { VoucherReason } from "../../money-state";
import type { PlaceDetail, VoucherKey } from "../../place-detail";
import { TestBand } from "../TestBand";
import { Box } from "./box";
import { NO_VOUCHERS, PlaceEmptyScreen } from "./empty-screen";

// The Vouchers tab (MESITA-3299; selling since MESITA-3303): what the place
// has switched on in Business › Payments, one objective line each (Pato: "be
// super objective"), and Buy on the ones for sale. Every number is the
// server's (`place.money.catalog`): this file formats cents and never adds.
// A voucher that is switched on but not for sale says why in one muted line
// instead of a button. The guest's credit here leads the card when they
// have any.
//
// A place with nothing on, or whose Stripe account cannot charge yet, shows
// the one empty screen: a switch the guest cannot act on is not an offer.

const VOUCHER_NAME: Record<VoucherKey, string> = {
  voucher_200: "MX$200 voucher",
  voucher_1000: "MX$1,000 voucher",
  voucher_5000: "MX$5,000 voucher",
  voucher_welcome: "Welcome voucher",
  voucher_story: "Story voucher",
  voucher_vip: "VIP voucher",
};

/** The condition on a special voucher, after the price line. */
const VOUCHER_CONDITION: Partial<Record<VoucherKey, string>> = {
  voucher_welcome: "Once, on your first visit.",
  voucher_story: "After posting an Instagram story here.",
  voucher_vip: "VIP guests only.",
};

/** Why a switched-on voucher cannot be bought right now, for the guest. */
const UNAVAILABLE_LINE: Partial<Record<VoucherReason, string>> = {
  not_yet: "Not on sale yet.",
  needs_card_payments: "Arrives with card payments.",
  needs_instagram: "Arrives with the Instagram connection.",
  paused: "Sales are paused for a moment.",
  used: "You already had yours here.",
};

const VOUCHER_ORDER: VoucherKey[] = ["voucher_200", "voucher_1000", "voucher_5000", "voucher_welcome", "voucher_story", "voucher_vip"];

/** "MX$1,200" from cents. Formatting only, never arithmetic. */
export function pesos(cents: number, currency: string): string {
  const code = currency.toUpperCase();
  const whole = cents % 100 === 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(cents / 100).replace(/^\$/, code === "MXN" ? "MX$" : "$");
  } catch {
    return `${(cents / 100).toFixed(whole ? 0 : 2)} ${code}`;
  }
}

const buyButton = cn(PLACE_BUTTON_CLASS, "bg-foreground text-paper shrink-0 px-4 hover:opacity-90 disabled:opacity-60");

export function VouchersPane({ place, actions }: { place: PlaceDetail; actions?: PlaceActions }) {
  const onLoad = actions?.onLoadVouchers;
  useEffect(() => {
    onLoad?.();
  }, [onLoad]);

  const money = place.money;
  const on = money?.charges_enabled ? VOUCHER_ORDER.filter((k) => money.vouchers[k]) : [];
  const cashback = money?.charges_enabled === true && money.cashback;
  const balance = money?.balance ?? null;
  const hasCredit = !!balance && balance.available_cents + balance.pending_cents + balance.held_cents > 0;
  if (!money || (on.length === 0 && !cashback && !hasCredit)) return <PlaceEmptyScreen {...NO_VOUCHERS} />;

  const currency = money.currency;
  const live = Boolean(actions?.onBuyVoucher);
  return (
    <div className="flex flex-col gap-3">
      {money.test_mode ? <TestBand /> : null}
      <Box title="Vouchers">
        {hasCredit && balance ? (
          <p className="text-muted-foreground mb-1 text-sm" data-place-credit>
            Your credit here: <span className="text-foreground font-semibold tabular-nums">{pesos(balance.available_cents, currency)}</span> available
            {balance.pending_cents > 0 ? (
              <>
                {" · "}
                <span className="text-foreground font-semibold tabular-nums">{pesos(balance.pending_cents, currency)}</span> pending
              </>
            ) : null}
          </p>
        ) : null}
        <ul className="divide-border divide-y">
          {on.map((k) => {
            const line = money.catalog[k];
            const forSale = money.sell.includes(k);
            const reason = money.unavailable[k];
            const buying = actions?.buyingVoucher === k;
            return (
              <li key={k} className="flex min-h-14 items-center gap-3 py-3" data-voucher={k}>
                <span className="bg-muted text-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                  <Ticket className="h-5 w-5" strokeWidth={2} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground text-sm font-medium">{VOUCHER_NAME[k]}</p>
                  <p className="text-muted-foreground text-sm">
                    {line ? `Pay ${pesos(line.price_cents, currency)}, get ${pesos(line.credit_cents, currency)} of credit.` : "Credit at this place."}
                    {VOUCHER_CONDITION[k] ? ` ${VOUCHER_CONDITION[k]}` : ""}
                  </p>
                  {!forSale && reason && UNAVAILABLE_LINE[reason] ? (
                    <p className="text-muted-foreground text-xs">{UNAVAILABLE_LINE[reason]}</p>
                  ) : null}
                </div>
                {forSale ? (
                  <button
                    type="button"
                    {...inertButtonProps(live)}
                    onClick={live ? () => actions?.onBuyVoucher?.(k) : undefined}
                    disabled={buying || (actions?.buyingVoucher != null && !buying)}
                    aria-label={`Buy the ${VOUCHER_NAME[k]}`}
                    className={buyButton}
                  >
                    {buying ? "Opening…" : "Buy"}
                  </button>
                ) : null}
              </li>
            );
          })}
          {cashback ? (
            <li className="flex min-h-14 items-center gap-3 py-3">
              <span className="bg-muted text-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                <Coins className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-foreground text-sm font-medium">Cashback</p>
                <p className="text-muted-foreground text-sm">Pay by card, get 5% back as credit here.</p>
              </div>
            </li>
          ) : null}
        </ul>
      </Box>
    </div>
  );
}

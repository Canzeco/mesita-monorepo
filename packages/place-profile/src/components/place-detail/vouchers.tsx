"use client";

import { Coins, Ticket } from "lucide-react";

import type { PlaceDetail, VoucherKey } from "../../place-detail";
import { Box } from "./box";
import { NO_VOUCHERS, PlaceEmptyScreen } from "./empty-screen";

// The Vouchers tab (MESITA-3299): what the place has switched on in Business ›
// Payments, as one objective line each (Pato: "be super objective"). Read
// only: buying and paying arrive with MESITA-3272. The amounts are the plan's
// (MESITA-3272) and are copy here; the server never sells from this list.
//
// A place with nothing on, or whose Stripe account cannot charge yet, shows
// the one empty screen: a switch the guest cannot act on is not an offer.

const VOUCHER_COPY: Record<VoucherKey, { name: string; line: string }> = {
  voucher_200: { name: "MX$200 voucher", line: "Pay MX$200, get MX$220 of credit." },
  voucher_1000: { name: "MX$1,000 voucher", line: "Pay MX$1,000, get MX$1,200 of credit." },
  voucher_5000: { name: "MX$5,000 voucher", line: "Pay MX$5,000, get MX$6,500 of credit." },
  voucher_welcome: { name: "Welcome voucher", line: "Pay MX$100, get MX$130 of credit. Once, on your first visit." },
  voucher_story: { name: "Story voucher", line: "Pay MX$100, get MX$130 of credit after posting an Instagram story here." },
  voucher_vip: { name: "VIP voucher", line: "Pay MX$100, get MX$130 of credit. VIP guests only." },
};

const VOUCHER_ORDER: VoucherKey[] = ["voucher_200", "voucher_1000", "voucher_5000", "voucher_welcome", "voucher_story", "voucher_vip"];

export function VouchersPane({ place }: { place: PlaceDetail }) {
  const money = place.money;
  const on = money?.charges_enabled ? VOUCHER_ORDER.filter((k) => money.vouchers[k]) : [];
  const cashback = money?.charges_enabled === true && money.cashback;
  if (on.length === 0 && !cashback) return <PlaceEmptyScreen {...NO_VOUCHERS} />;
  return (
    <Box title="Vouchers">
      <ul className="divide-border divide-y">
        {on.map((k) => (
          <li key={k} className="flex min-h-14 items-center gap-3 py-3">
            <span className="bg-muted text-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              <Ticket className="h-5 w-5" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-foreground text-sm font-medium">{VOUCHER_COPY[k].name}</p>
              <p className="text-muted-foreground text-sm">{VOUCHER_COPY[k].line}</p>
            </div>
          </li>
        ))}
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
  );
}

// A Monitor page whose capability is off (MESITA-4732, Pato's design review
// 2026-11-23): the list's empty frame, ONE centred line and ONE button,
// "Turn on in Offers", to that box on Offers. No pitch, no fake rows. When the
// page still has past rows, they show with one quiet line above instead.
//
// What counts as off is read from business-web-get-payments, the same answer
// the Offers page draws; a failed read never blocks a page (no line shows).

import Link from "next/link";
import { TagIcon } from "@phosphor-icons/react/dist/ssr";
import type { PlacePayments } from "@/lib/business-api";
import { stripeTakesCards, vouchersLive } from "@/lib/offers-state";
import { placeTabHref } from "@/lib/routes";
import { MonitorCard } from "./MonitorList";

/** The Offers boxes a Monitor page can point at (ids on /places/<id>/payments). */
export type OffersAnchor = "credits-account" | "stripe-account" | "visit-checkout" | "prepaid-vouchers" | "instagram-stories" | "credit-limit";

export type CapabilityOffState = { line: string; anchor: OffersAnchor };

/** Why a Monitor page has nothing new to show, or null when it is on. */
export function monitorCapabilityOff(kind: "vouchers" | "stories" | "payouts", p: PlacePayments): CapabilityOffState | null {
  const s = p.settings;
  if (kind === "payouts") {
    return stripeTakesCards(p) ? null : { line: "Stripe isn't connected", anchor: "stripe-account" };
  }
  if (kind === "vouchers") {
    // The same rule Offers draws (offers-state): Accept Prepayments on, the
    // Stripe Account taking cards, no fee hold, and Small, Medium or Big on.
    if (vouchersLive(p)) return null;
    return p.fee.hold && s.prepayments
      ? { line: "Prepaid vouchers are off until Mesita's invoice is paid", anchor: "prepaid-vouchers" }
      : { line: "Prepaid vouchers are off", anchor: "prepaid-vouchers" };
  }
  // A story pays only where the Credits Account is on and the reward is not Off.
  if (!s.loyalty_cards) return { line: "Credits Account is off", anchor: "credits-account" };
  return (p.cashback?.story_reward_cents ?? 0) > 0 ? null : { line: "Story rewards are off", anchor: "instagram-stories" };
}

function offersHref(placeId: string, anchor: OffersAnchor): string {
  return `${placeTabHref(placeId, "payments")}#${anchor}`;
}

/** The empty frame: the table's header row (when it is a table), the line and the button. */
export function CapabilityOff({ placeId, off, columns }: { placeId: string; off: CapabilityOffState; columns?: string[] }) {
  return (
    <MonitorCard>
      {columns?.length ? (
        <div className="overflow-hidden">
          <table className="w-full border-collapse" aria-hidden>
            <thead>
              <tr className="border-border border-b">
                {columns.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className="text-muted-foreground px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>
      ) : null}
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <p className="text-sm font-medium">{off.line}</p>
        <Link
          href={offersHref(placeId, off.anchor)}
          className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold hover:opacity-90"
        >
          <TagIcon size={16} weight="bold" aria-hidden />
          Turn on in Offers
        </Link>
      </div>
    </MonitorCard>
  );
}

/** Past rows still show; this one quiet line sits above them. */
export function CapabilityNote({ placeId, off }: { placeId: string; off: CapabilityOffState }) {
  return (
    <p className="text-muted-foreground text-sm">
      {off.line}.{" "}
      <Link href={offersHref(placeId, off.anchor)} className="text-foreground font-medium underline underline-offset-2">
        Turn on in Offers
      </Link>
    </p>
  );
}

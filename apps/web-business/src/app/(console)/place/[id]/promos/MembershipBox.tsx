import { ChevronDown } from "lucide-react";
import { Section } from "@/components/shared";
import type { MyPlace } from "@/lib/api/places";
import { cn, formatMoney } from "@/lib/utils";
import { PRODUCT_PRICE_MXN } from "./promoConstants";
import { MembershipStatusPill, type MembershipPillState } from "./promoShared";
import { effectiveStrikeCount } from "./promo-state";

const STRIKES: { n: string; consequence: string }[] = [
  { n: "1", consequence: "A warning — your discounts keep running." },
  { n: "2", consequence: "Your discounts are paused for 30 days." },
  {
    n: "3",
    consequence:
      "Partnership forfeited — promos off, place stays listed on Mesita.",
  },
];

export function MembershipBox({
  currency,
  place,
  pillState,
  billingBusy,
  onDrop,
}: {
  currency: string;
  place: MyPlace;
  pillState: MembershipPillState;
  billingBusy: boolean;
  onDrop: () => void;
}) {
  const statusNote = describePartnershipStatus(place, pillState);
  const price = formatMoney(PRODUCT_PRICE_MXN, currency);
  const canDrop = pillState !== "not_member" && pillState !== "forfeited";
  const rulesOpen =
    pillState === "paused" ||
    pillState === "forfeited" ||
    (effectiveStrikeCount(place) > 0 && pillState === "live");

  return (
    <Section
      title="Partnership"
      right={<MembershipStatusPill state={pillState} />}
    >
      {statusNote && (
        <p
          className={cn(
            "rounded-xl px-3 py-2 text-[12px] leading-snug",
            statusNote.tone === "live" && "bg-emerald-50 text-emerald-800",
            statusNote.tone === "warn" && "bg-amber-50 text-amber-900",
            statusNote.tone === "blocked" &&
              "bg-destructive/10 text-destructive",
          )}
        >
          {statusNote.label}
        </p>
      )}

      <p className="text-muted-foreground text-[13px] leading-snug">
        {price}/month · pick a strategy below. Switching to Zero pauses
        discounts without ending Partnership.
      </p>

      <details open={rulesOpen} className="border-border group border-t">
        <summary className="text-muted-foreground hover:text-foreground flex min-h-10 cursor-pointer list-none items-center gap-1.5 text-[12px] font-semibold transition [&::-webkit-details-marker]:hidden">
          If a guest is turned away
          <ChevronDown className="h-3.5 w-3.5 shrink-0 transition group-open:rotate-180" />
        </summary>
        <div className="text-muted-foreground flex flex-col gap-2.5 pb-3 text-[12px] leading-snug">
          <ol className="flex flex-col gap-1">
            {STRIKES.map((s) => (
              <li key={s.n} className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-px inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    s.n === "3"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-amber-500/15 text-amber-700",
                  )}
                >
                  {s.n}
                </span>
                <span className="text-foreground/80">{s.consequence}</span>
              </li>
            ))}
          </ol>
        </div>
      </details>

      {canDrop && (
        <button
          type="button"
          disabled={billingBusy}
          onClick={onDrop}
          className="text-muted-foreground hover:text-destructive self-start text-[12px] font-semibold underline underline-offset-4 transition disabled:opacity-60"
        >
          Drop Partnership
        </button>
      )}
    </Section>
  );
}

function describePartnershipStatus(
  place: MyPlace,
  pillState: MembershipPillState,
): { label: string; tone: "live" | "warn" | "blocked" } | null {
  if (pillState === "forfeited") {
    return {
      label:
        "Partnership forfeited after 3 strikes — re-join from the offer above.",
      tone: "blocked",
    };
  }
  if (pillState === "not_member") return null;
  if (pillState === "paused") {
    return {
      label: `Promo lane paused until ${place.promo_paused_until!.slice(0, 10)} (strike 2 of 3).`,
      tone: "warn",
    };
  }
  if (pillState === "live") {
    const strikes = effectiveStrikeCount(place);
    return {
      label:
        strikes > 0
          ? `Partnership live · ${strikes} active strike${strikes === 1 ? "" : "s"} (of 3).`
          : "Partnership live — promo lane open.",
      tone: strikes > 0 ? "warn" : "live",
    };
  }
  return {
    label:
      "Partner — pending activation. Honor your first guest check to go live.",
    tone: "warn",
  };
}

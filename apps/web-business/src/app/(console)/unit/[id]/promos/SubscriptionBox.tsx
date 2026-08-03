import { AlertTriangle, QrCode, ShieldCheck, Ticket } from "lucide-react";
import { Section } from "@/components/shared";
import type { MyPlace } from "@/lib/api/places";
import { cn, formatMoney } from "@/lib/utils";
import { PRODUCT_PRICE_MXN } from "./promoConstants";
import { ActivationStep, SubHeading } from "./promoShared";

const STRIKES: { n: string; consequence: string }[] = [
  { n: "1", consequence: "A warning — your discounts keep running." },
  { n: "2", consequence: "Your discounts are paused for 30 days." },
  {
    n: "3",
    consequence:
      "Removed from the paid Strategies and the fee is forfeited — the place stays listed on Mesita.",
  },
];

export function SubscriptionBox({
  currency,
  place,
}: {
  currency: string;
  place: MyPlace;
}) {
  const membershipStatus = describeMembershipStatus(place);
  return (
    <Section
      title="The membership"
      description="What the fee is, how activation works, and what a strike costs."
    >
      {membershipStatus && (
        <p
          className={cn(
            "rounded-xl p-3 text-[12px] leading-snug",
            membershipStatus.tone === "live" &&
              "bg-emerald-50 text-emerald-800",
            membershipStatus.tone === "warn" && "bg-amber-50 text-amber-900",
            membershipStatus.tone === "blocked" &&
              "bg-destructive/10 text-destructive",
          )}
        >
          {membershipStatus.label}
        </p>
      )}
      <div className="border-border bg-muted/25 flex items-start gap-3 rounded-xl border p-3">
        <ShieldCheck className="text-primary mt-0.5 h-5 w-5 shrink-0" />
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold">
            {formatMoney(PRODUCT_PRICE_MXN, currency)}{" "}
            <span className="text-muted-foreground text-[11px] font-normal">
              / year · per Strategy
            </span>
          </p>
          <p className="text-muted-foreground text-[11px] leading-snug">
            A commitment filter, not a feature tier — it keeps half-hearted
            restaurants out of the rewards program and guests away from dead
            coupons. It buys commitment, never placement: rank is not for sale.
          </p>
        </div>
      </div>

      <SubHeading icon={Ticket}>Activation</SubHeading>
      <div className="flex flex-col gap-1.5">
        <ActivationStep icon={QrCode}>
          Your staff scan a guest&apos;s QR on Mesita Check — no app, no
          account, no setup.
        </ActivationStep>
        <ActivationStep icon={Ticket}>
          The first guest ticket is honored at the bill. That&apos;s it —
          you&apos;re live.
        </ActivationStep>
      </div>

      <SubHeading icon={AlertTriangle}>If you turn a guest away</SubHeading>
      <div className="border-border overflow-hidden rounded-xl border">
        {STRIKES.map((s, i) => (
          <div
            key={s.n}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5",
              i > 0 && "border-border border-t",
            )}
          >
            <span
              className={cn(
                "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                s.n === "3"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-amber-500/15 text-amber-700",
              )}
            >
              {s.n}
            </span>
            <span className="text-foreground/80 text-[11px] leading-snug">
              {s.consequence}
            </span>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-[11px] leading-snug">
        A refused or ignored QR is a strike. Strikes decay after 6 months clean,
        and a guest who&apos;s turned away is compensated instantly.
      </p>
    </Section>
  );
}

function describeMembershipStatus(
  place: MyPlace,
): { label: string; tone: "live" | "warn" | "blocked" } | null {
  if (place.plan === "free") {
    if (place.membership_forfeited_at) {
      return {
        label:
          "Membership forfeited after 3 strikes — place stays listed, promos are off.",
        tone: "blocked",
      };
    }
    return null;
  }
  if (place.membership_forfeited_at) {
    return {
      label: "Membership forfeited after 3 strikes — promos are off.",
      tone: "blocked",
    };
  }
  if (
    place.promo_paused_until &&
    new Date(place.promo_paused_until).getTime() > Date.now()
  ) {
    return {
      label: `Promo lane paused until ${place.promo_paused_until.slice(0, 10)} (strike 2).`,
      tone: "blocked",
    };
  }
  if (place.membership_live_at) {
    const strikes = place.strike_count ?? 0;
    return {
      label:
        strikes > 0
          ? `Membership live · ${strikes} active strike${strikes === 1 ? "" : "s"}.`
          : "Membership live — promo lane open.",
      tone: strikes > 0 ? "warn" : "live",
    };
  }
  return {
    label:
      "Activating — honor your first guest check and the promo lane opens.",
    tone: "warn",
  };
}

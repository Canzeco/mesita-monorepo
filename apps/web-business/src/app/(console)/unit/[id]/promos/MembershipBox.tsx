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
      "Membership forfeited — promos off, place stays listed on Mesita.",
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
  const statusNote = describeMembershipStatus(place, pillState);
  const price = formatMoney(PRODUCT_PRICE_MXN, currency);
  const notMember = pillState === "not_member";
  const canDrop = pillState !== "not_member" && pillState !== "forfeited";
  // Surface the honor rules when something is wrong; otherwise keep them
  // tucked. Decay-aware: raw strike_count keeps stale values until the EF
  // lazily rewrites it — never auto-open over phantom strikes.
  const rulesOpen =
    pillState === "paused" ||
    pillState === "forfeited" ||
    (effectiveStrikeCount(place) > 0 && pillState === "live");

  // One contextual line — the price and what it unlocks are stated once above
  // it; this only says what to do next.
  const nextLine = notMember
    ? "Choose a strategy below to join. Rank is never for sale — visibility rises with what you give."
    : "Switching to Zero pauses discounts without ending the membership. Dropping is separate.";

  return (
    <Section
      title="Mesita Membership"
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

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-display text-2xl leading-none font-semibold tracking-tight">
          {price}
          <span className="text-muted-foreground text-[12px] font-normal">
            {" "}
            / year
          </span>
        </p>
        <p className="text-muted-foreground text-[12.5px] leading-snug">
          Unlocks{" "}
          <span className="text-foreground font-semibold">Conservative</span>{" "}
          and <span className="text-foreground font-semibold">Aggressive</span>{" "}
          — switch free anytime. Zero stays free.
        </p>
      </div>

      <p className="text-muted-foreground text-[12px] leading-snug">
        {nextLine}
      </p>

      <details open={rulesOpen} className="border-border group border-t">
        <summary className="text-muted-foreground hover:text-foreground flex min-h-10 cursor-pointer list-none items-center gap-1.5 text-[12px] font-semibold transition [&::-webkit-details-marker]:hidden">
          How it works
          <ChevronDown className="h-3.5 w-3.5 shrink-0 transition group-open:rotate-180" />
        </summary>
        {/* Activation lives in the lifecycle banner above — only the strikes
            ladder is unique to this disclosure. */}
        <div className="text-muted-foreground flex flex-col gap-2.5 pb-3 text-[12px] leading-snug">
          <p className="text-[10px] font-bold tracking-[0.16em] uppercase">
            If you turn a guest away
          </p>
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
          <p>
            Strikes decay after 6 months clean, and a guest who&apos;s turned
            away is compensated instantly.
          </p>
        </div>
      </details>

      {canDrop && (
        <button
          type="button"
          disabled={billingBusy}
          onClick={onDrop}
          className="text-muted-foreground hover:text-destructive self-start text-[12px] font-semibold underline underline-offset-4 transition disabled:opacity-60"
        >
          Drop membership
        </button>
      )}
    </Section>
  );
}

function describeMembershipStatus(
  place: MyPlace,
  pillState: MembershipPillState,
): { label: string; tone: "live" | "warn" | "blocked" } | null {
  if (pillState === "forfeited") {
    return {
      label:
        "Membership forfeited after 3 strikes — contact Mesita to re-join.",
      tone: "blocked",
    };
  }
  if (pillState === "not_member") return null;
  // Paused is a recoverable 30-day state → warn (amber), matching its pill;
  // destructive red is reserved for forfeited.
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
          ? `Membership live · ${strikes} active strike${strikes === 1 ? "" : "s"} (of 3).`
          : "Membership live — promo lane open.",
      tone: strikes > 0 ? "warn" : "live",
    };
  }
  return {
    label:
      "Member — pending activation. Honor your first guest check to go live.",
    tone: "warn",
  };
}

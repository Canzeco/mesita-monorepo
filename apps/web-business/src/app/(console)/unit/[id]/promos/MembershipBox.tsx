import { ChevronDown } from "lucide-react";
import { Section } from "@/components/shared";
import type { MyPlace } from "@/lib/api/places";
import { cn, formatMoney } from "@/lib/utils";
import { PRODUCT_PRICE_MXN } from "./promoConstants";
import {
  MembershipStatusPill,
  type MembershipPillState,
} from "./promoShared";

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
  // Surface the honor rules when something is wrong; otherwise keep them tucked.
  const rulesOpen =
    pillState === "paused" ||
    pillState === "forfeited" ||
    ((place.strike_count ?? 0) > 0 && pillState === "live");

  return (
    <Section
      title="Mesita Membership"
      description={`${price}/year unlocks paid strategies. Zero stays free.`}
      right={<MembershipStatusPill state={pillState} />}
    >
      {statusNote && (
        <p
          className={cn(
            "rounded-xl p-3 text-[12px] leading-snug",
            statusNote.tone === "live" && "bg-emerald-50 text-emerald-800",
            statusNote.tone === "warn" && "bg-amber-50 text-amber-900",
            statusNote.tone === "blocked" && "bg-destructive/10 text-destructive",
          )}
        >
          {statusNote.label}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <p className="font-display text-2xl font-semibold tracking-tight">
          {price}{" "}
          <span className="text-muted-foreground text-[12px] font-normal">
            / year
          </span>
        </p>
        <p className="text-foreground/85 text-[13px] leading-snug">
          Unlocks <span className="font-semibold">Conservative</span>,{" "}
          <span className="font-semibold">Aggressive</span>, and{" "}
          <span className="font-semibold">Dominant</span>. Zero stays free.
          Switch strategies anytime while membership is active.
        </p>
        {notMember ? (
          <p className="text-muted-foreground text-[12px] leading-snug">
            <span className="text-foreground font-semibold">
              Choose a paid strategy below to join.
            </span>{" "}
            Rank is never for sale — visibility rises with what you give.
          </p>
        ) : (
          <p className="text-muted-foreground text-[12px] leading-snug">
            Membership stays on while you switch strategies, including Zero
            (pauses discounts). Drop membership separately if you want out.
          </p>
        )}
      </div>

      {canDrop && (
        <button
          type="button"
          disabled={billingBusy}
          onClick={onDrop}
          className="border-border text-foreground/75 hover:bg-muted inline-flex h-10 items-center justify-center self-start rounded-full border px-4 text-[12px] font-bold transition disabled:opacity-60"
        >
          Drop membership
        </button>
      )}

      <details
        open={rulesOpen}
        className="border-border group border-t pt-2"
      >
        <summary className="text-foreground flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 text-[12px] font-semibold [&::-webkit-details-marker]:hidden">
          How it works
          <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0 transition group-open:rotate-180" />
        </summary>
        <div className="text-muted-foreground flex flex-col gap-3 pb-1 pt-1 text-[12px] leading-snug">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-bold tracking-[0.16em] uppercase">
              Activation
            </p>
            <p>
              Staff scan a guest&apos;s QR on Mesita Check — no app, no account.
              The first guest ticket honored at the bill makes you live.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-bold tracking-[0.16em] uppercase">
              If you turn a guest away
            </p>
            <ol className="flex flex-col gap-1">
              {STRIKES.map((s) => (
                <li key={s.n} className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
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
          <p>
            Strikes decay after 6 months clean, and a guest who&apos;s turned
            away is compensated instantly.
          </p>
        </div>
      </details>
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
  if (pillState === "paused") {
    return {
      label: `Promo lane paused until ${place.promo_paused_until!.slice(0, 10)} (strike 2).`,
      tone: "blocked",
    };
  }
  if (pillState === "live") {
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
      "Member — pending activation. Honor your first guest check to go live.",
    tone: "warn",
  };
}

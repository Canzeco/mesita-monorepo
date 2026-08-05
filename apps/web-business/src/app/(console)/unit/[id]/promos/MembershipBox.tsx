import { AlertTriangle, QrCode, ShieldCheck, Ticket } from "lucide-react";
import { Section } from "@/components/shared";
import type { MyPlace } from "@/lib/api/places";
import { cn, formatMoney } from "@/lib/utils";
import { PRODUCT_PRICE_MXN } from "./promoConstants";
import {
  ActivationStep,
  MembershipStatusPill,
  SubHeading,
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

  return (
    <Section
      title="Mesita Membership"
      description="One annual fee — the commitment filter. Strategy switching is free."
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

      <div className="border-border bg-muted/25 flex items-start gap-3 rounded-xl border p-3">
        <ShieldCheck className="text-primary mt-0.5 h-5 w-5 shrink-0" />
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold">
            {formatMoney(PRODUCT_PRICE_MXN, currency)}{" "}
            <span className="text-muted-foreground text-[11px] font-normal">
              / year
            </span>
          </p>
          <p className="text-muted-foreground text-[11px] leading-snug">
            A commitment filter, not a feature tier — it keeps half-hearted
            restaurants out of the rewards program. Rank is never for sale;
            strategy switching is free once you&apos;re a member.
          </p>
        </div>
      </div>

      {pillState !== "not_member" &&
        pillState !== "forfeited" && (
          <button
            type="button"
            disabled={billingBusy}
            onClick={onDrop}
            className="border-border text-foreground/75 hover:bg-muted inline-flex h-10 items-center justify-center self-start rounded-full border px-4 text-[12px] font-bold transition disabled:opacity-60"
          >
            Drop membership
          </button>
        )}

      <SubHeading icon={Ticket}>Activation</SubHeading>
      <div className="flex flex-col gap-1.5">
        <ActivationStep icon={QrCode}>
          Your staff scan a guest&apos;s QR on Mesita Check — no app, no account.
        </ActivationStep>
        <ActivationStep icon={Ticket}>
          The first guest ticket is honored at the bill — then you&apos;re live.
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
        Strikes decay after 6 months clean, and a guest who&apos;s turned away is
        compensated instantly.
      </p>
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

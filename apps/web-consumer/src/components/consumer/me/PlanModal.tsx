"use client";

// Plan — the subscription, Free or Pro (MESITA-2134, MESITA-2167, MESITA-2553).
// Opened from the Me › Plan tile and from the Plan chip on Me's card.
//
// PLAN IS NOT CLASS (Pato, MESITA-2553). Plan is what a guest pays for; Class
// (Regular or VIP) comes through a partner and lives in its own sheet. This
// page never names Class or VIP, and the Class sheet never names a plan.
//
// READ-ONLY. There is no checkout yet, so nothing is bought here. The guest's
// own row says "Your plan."; while the plan is unknown (loading, or the read
// failed) neither row claims it, and nothing assumes Free.
//
// NO PRICE. Each plan states the monthly reservation cap the server enforces
// for it (FREE_/PRO_RESERVATIONS_PER_MONTH, MESITA-2555). Pro opens with
// "Everything in Free", then its cap, then its unbuilt perks, each tagged
// Soon. There is no checkout, so no price is shown. The words live in
// plan-words.ts, which /me/plan's fallback reads too (MESITA-2701).

import { CreditCard, Sparkles } from "lucide-react";

import { MeScreen } from "@/components/consumer/me/MeScreen";
import { PerkList } from "@/components/consumer/me/perk-list";
import { PLAN_ROWS, type PlanRowWords } from "@/components/consumer/me/plan-words";
import type { GuestPlan } from "@/lib/guest-standing";
import { IconCircle, RowDivider, SettingsGroup } from "./settings-rows";

function PlanRow({
  title,
  subtitle,
  icon,
  tint,
  label,
  items,
  mine,
}: PlanRowWords & {
  icon: React.ReactNode;
  tint: "primary" | "muted";
  mine: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3" data-plan-row={title}>
      <IconCircle tint={tint}>{icon}</IconCircle>
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span
          className="text-muted-foreground type-label block"
          data-plan-mine={mine ? "" : undefined}
        >
          {mine ? "Your plan." : subtitle}
        </span>
        <PerkList label={label} items={items} />
      </div>
    </div>
  );
}

export function PlanModal({ plan }: { plan: GuestPlan | null }) {
  return (
    <MeScreen title="Plan">
      <SettingsGroup>
        <PlanRow
          {...PLAN_ROWS.free}
          icon={<CreditCard className="h-[18px] w-[18px]" />}
          tint={plan === "free" ? "primary" : "muted"}
          mine={plan === "free"}
        />
        <RowDivider />
        <PlanRow
          {...PLAN_ROWS.premium}
          icon={<Sparkles className="h-[18px] w-[18px]" />}
          tint={plan === "premium" ? "primary" : "muted"}
          mine={plan === "premium"}
        />
      </SettingsGroup>
    </MeScreen>
  );
}

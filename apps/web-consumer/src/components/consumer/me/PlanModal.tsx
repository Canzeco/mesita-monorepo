"use client";

// Me › Plan (/me/plan). PLAN IS SOON ON SCREEN (Pato, 2026-11-13,
// MESITA-3835: "don't remove plan, but don't explain what it does, when you
// open shit, you mention soon"): one line, then Free and Pro by name, each
// tagged Soon. No perks, no Current pill, no price, no button. The stored plan
// and the reservation caps it sets (Free 10, Pro 30, MESITA-2555) are
// unchanged; only the page stopped explaining them. The perk words still live
// in plan-words.ts for the way back. Class's page reads the same way
// (MESITA-3099).
//
// Plan copy never names Class, and Class copy never names a plan (MESITA-2553).

import { CreditCard, Sparkles } from "lucide-react";

import { MeScreen } from "@/components/consumer/me/MeScreen";
import { PLAN_ROWS } from "@/components/consumer/me/plan-words";
import { IconChip, MeLead, RowDivider, SettingsGroup } from "./settings-rows";

function PlanRow({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3" data-plan-row={title}>
      <IconChip>{icon}</IconChip>
      <span className="text-sm font-semibold">
        {title}
        <span
          className="bg-muted text-muted-foreground type-meta ml-1.5 rounded-full px-1.5 py-0.5 align-middle font-semibold"
          data-plan-soon=""
        >
          Soon
        </span>
      </span>
    </div>
  );
}

export function PlanModal() {
  return (
    <MeScreen title="Plan">
      <MeLead>Coming soon.</MeLead>
      <SettingsGroup>
        <PlanRow
          title={PLAN_ROWS.free.title}
          icon={<CreditCard className="h-[18px] w-[18px]" />}
        />
        <RowDivider />
        <PlanRow
          title={PLAN_ROWS.premium.title}
          icon={<Sparkles className="h-[18px] w-[18px]" />}
        />
      </SettingsGroup>
    </MeScreen>
  );
}

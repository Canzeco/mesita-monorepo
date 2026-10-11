"use client";

// Plan — the plan you are on (MESITA-2134). Opened from the Me › Plan tile.
//
// READ-ONLY BY DESIGN. The Premium checkout left with the subscription Edge
// Functions in the First Stage cut (MESITA-2090), so there is nothing to buy
// here today. Every account is on Free, and Premium wears the same "Soon"
// tag as the Pay tab, so the two make one promise. When a subscription EF
// exists again, the Premium row becomes the action.

import { Check, Sparkles } from "lucide-react";

import { MeScreen } from "@/components/consumer/me/MeScreen";
import { IconCircle, RowDivider, SettingsGroup } from "./settings-rows";

export function PlanModal() {
  return (
    <MeScreen title="Plan">
      <SettingsGroup>
        <div className="flex items-center gap-3 px-4 py-3">
          <IconCircle tint="primary">
            <Check className="h-[18px] w-[18px]" />
          </IconCircle>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Free</span>
            <span className="text-muted-foreground type-label block">
              Your plan. Browse, save and reserve.
            </span>
          </span>
        </div>
        <RowDivider />
        <div className="flex items-center gap-3 px-4 py-3">
          <IconCircle tint="muted">
            <Sparkles className="h-[18px] w-[18px]" />
          </IconCircle>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Premium</span>
            <span className="text-muted-foreground type-label block">
              The paid plan, coming to Mesita.
            </span>
          </span>
          <span className="bg-muted text-muted-foreground type-meta rounded-full px-2 py-0.5 font-semibold">
            Soon
          </span>
        </div>
      </SettingsGroup>
    </MeScreen>
  );
}

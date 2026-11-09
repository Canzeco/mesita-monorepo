"use client";

// /me/refunds — Mesita's promise on prepaid credit (Pato, MESITA-3517: "In
// the weird but possible case the place bankrupts and your credits are gone.
// Mesita will give you a refund. just create the view, but leave it empty or
// not functional"). NOT BUILT: no refund is read or requested here, no EF is
// called, and the page offers no button. It states the promise and an empty
// list, as Cards and Connector say Soon.

import { LifeBuoy, Undo2 } from "lucide-react";

import { MeScreen } from "@/components/consumer/me/MeScreen";
import { EmptyState } from "@/components/shared";
import { IconChip, SettingsGroup } from "./settings-rows";

export function RefundsModal() {
  return (
    <MeScreen title="Refunds">
      <SettingsGroup>
        <div className="flex items-start gap-3 px-4 py-3" data-refunds>
          <IconChip>
            <LifeBuoy className="h-[18px] w-[18px]" />
          </IconChip>
          <div className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Your credit is protected</span>
            <span className="text-muted-foreground type-label block">
              If a place closes for good before you spend your credit there, Mesita refunds what
              you have left.
            </span>
          </div>
        </div>
      </SettingsGroup>
      <EmptyState
        icon={Undo2}
        title="No refunds"
        description="Any refund Mesita gives you shows up here."
      />
    </MeScreen>
  );
}

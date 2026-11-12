"use client";

// Activity › Refunds (MESITA-3771, Pato: "Refunds also in Activity"; Me's
// /me/refunds page from MESITA-3517 until then, which now 308s here).
// Mesita's promise on prepaid credit: if a place closes for good with the
// guest's credit unspent, Mesita refunds it. NOT BUILT: no refund is read or
// requested, no EF is called, no button. The promise, then an empty list.

import { LifeBuoy, Undo2 } from "lucide-react";

import { EmptyState } from "@/components/shared";
import { IconChip, SettingsGroup } from "@/components/consumer/me/settings-rows";

export function RefundsPanel() {
  return (
    <div className="flex flex-col gap-2">
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
    </div>
  );
}

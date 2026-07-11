"use client";

import { UserPlus } from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { GiftCardDeck } from "@/components/consumer/share/GiftCardDeck";

// Share sheet opened from the Me page's Share box. Renders the full five-card
// referral deck (friend · business · influencer · marketing agency · modeling
// agency) — the same GiftCardDeck as the /share page, so the two never drift.

export function ShareModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Share Mesita">
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="bg-pink-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white">
            <UserPlus className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Share Mesita
            </h2>
            <p className="text-muted-foreground text-[12px]">
              Your seat at the table — pass it on
            </p>
          </div>
        </div>

        <GiftCardDeck />
      </div>
    </LocalSheet>
  );
}

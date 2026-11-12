"use client";

// Activity › Refunds (MESITA-3771, Pato: "Refunds also in Activity"; Me's
// /me/refunds page from MESITA-3517 until then, which now 308s here).
// Mesita's promise on prepaid credit: if a place closes for good with the
// guest's credit unspent, Mesita refunds it. NOT BUILT: no refund is read or
// requested, no EF is called, no button. The promise (ChipIntro, kept word
// for word: "that is important", MESITA-3782), then an empty list.

import { Undo2 } from "lucide-react";

import { EmptyState } from "@/components/shared";

export function RefundsPanel() {
  return (
    <EmptyState
      icon={Undo2}
      title="No refunds"
      description="Any refund Mesita gives you shows up here, with the place and the amount."
    />
  );
}

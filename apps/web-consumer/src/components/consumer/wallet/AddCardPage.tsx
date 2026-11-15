"use client";

import { useRouter } from "next/navigation";

import {
  AddCardFields,
  CARD_KEPT_LINE,
  CARD_SAVED_LINE,
  SaveCardButton,
  useAddCard,
} from "@/components/consumer/AddCardSheet";
import { Screen } from "@/components/consumer/nav/Screen";
import { Panel } from "@/components/shared/Panel";
import { WALLET_CACHE_KEY } from "@/lib/api/wallet";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { goBack } from "@/lib/navigate";
import { invalidateCached } from "@/lib/screen-cache";
import { toast } from "@/lib/toast";

// /wallet/cards/new, ADD A CARD ON ITS OWN PAGE (Pato, 2026-11-15,
// MESITA-4092: "ADD CARD MUST HAVE ITS OWN SUBPAGE ... NOT A MODAL FLOATING
// 80% COVERING VERTICAL. OWN SUBPAGES IS CLEANER"), pushed from Wallet's Add
// a card row. The same form as the sheet (useAddCard: one SetupIntent,
// Stripe's Payment Element, nothing charged), in a Panel, with Save card
// pinned under a hairline (Screen's footer). Saved: back to Wallet, which
// reads again and lists the card.
export function AddCardPage() {
  const router = useRouter();
  const form = useAddCard({
    active: true,
    onSaved: () => {
      toast.success("Card saved.");
      invalidateCached(WALLET_CACHE_KEY);
      goBack(router, CONSUMER_ROUTES.wallet);
    },
  });
  return (
    <Screen
      title="Add a card"
      paper
      scrolls
      footer={
        <div className="flex flex-col gap-2">
          <SaveCardButton form={form} />
          <p className="text-muted-foreground text-center text-xs">{CARD_SAVED_LINE}</p>
        </div>
      }
    >
      <div className="flex flex-col pt-4 pb-8" data-add-card-page>
        <Panel className="p-4">
          <p className="text-muted-foreground mb-4 text-sm">{CARD_KEPT_LINE}</p>
          <AddCardFields form={form} />
        </Panel>
      </div>
    </Screen>
  );
}

"use client";

// /me/cards — the guest's saved ways to pay (Pato, MESITA-3465: "or the other
// 2 boxes as pending ... invent something"). NOT BUILT: today a card is typed
// on Stripe's own page at each payment and Mesita keeps none, so every line
// is tagged Soon and the page offers no button, as Connector does.
// MESITA-3523: saving a card is live on the Wallet's Money rail (Add), so
// that line is no longer Soon and the page links there.

import Link from "next/link";
import { CreditCard } from "lucide-react";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

import { MeScreen } from "@/components/consumer/me/MeScreen";
import { PerkList } from "@/components/consumer/me/perk-list";
import { IconChip, SettingsGroup } from "./settings-rows";

export function CardsModal() {
  return (
    <MeScreen title="Cards">
      <SettingsGroup>
        <div className="flex items-start gap-3 px-4 py-3" data-cards>
          <IconChip>
            <CreditCard className="h-[18px] w-[18px]" />
          </IconChip>
          <div className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Your ways to pay</span>
            <span className="text-muted-foreground type-label block">
              Save a card once and pay any Mesita place in one tap.
            </span>
            <PerkList
              label="What it will do"
              items={[
                { text: "Save a card" },
                { text: "Apple Pay", soon: true },
                { text: "Google Pay", soon: true },
              ]}
            />
            <Link
              href={CONSUMER_ROUTES.wallet}
              className="mt-3 inline-block text-sm font-semibold underline-offset-4 hover:underline"
              data-cards-wallet
            >
              Your cards are in Wallet
            </Link>
          </div>
        </div>
      </SettingsGroup>
    </MeScreen>
  );
}

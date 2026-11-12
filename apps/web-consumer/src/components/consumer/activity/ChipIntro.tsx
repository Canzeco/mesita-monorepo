"use client";

// WHAT EACH ACTIVITY CHIP HOLDS, IN WORDS (MESITA-3782, Pato: "in refunds do
// leave the explanations. that is important"): every chip but Notifications
// opens with one card that says what lands there and how it works, in the
// shape Refunds' "Your credit is protected" card has had since MESITA-3517.

import {
  CalendarCheck,
  Gift,
  LifeBuoy,
  UtensilsCrossed,
  BadgeDollarSign,
  type LucideIcon,
} from "lucide-react";
import { IconChip, SettingsGroup } from "@/components/consumer/me/settings-rows";
import type { ActivityType } from "@/lib/activity-types";

const INTRO: Record<Exclude<ActivityType, "notifications">, { Icon: LucideIcon; title: string; text: string }> = {
  reservations: {
    Icon: CalendarCheck,
    title: "Tables Mesita booked for you",
    text: "Mesita calls the place and books your table. Each one shows its time, party, reference and where it stands.",
  },
  visits: {
    Icon: UtensilsCrossed,
    title: "Every bill you paid with Mesita",
    text: "Each visit shows the bill, the tip, how you paid it (credits, card or cash) and the cashback you got back.",
  },
  vouchers: {
    Icon: BadgeDollarSign,
    title: "Credit you prepaid at a place",
    text: "Buy credit at a place, often with a bonus, and spend it there later with Pay. It pays the bill, never the tip.",
  },
  gifts: {
    Icon: Gift,
    title: "Credit you sent or got",
    text: "Send credit you hold at a place to a friend with a link. They spend it there. A link nobody opens can be taken back.",
  },
  refunds: {
    Icon: LifeBuoy,
    title: "Your credit is protected",
    text: "If a place closes for good before you spend your credit there, Mesita refunds what you have left.",
  },
};

export function ChipIntro({ type }: { type: Exclude<ActivityType, "notifications"> }) {
  const { Icon, title, text } = INTRO[type];
  return (
    <SettingsGroup>
      <div className="flex items-start gap-3 px-4 py-3" data-chip-intro={type}>
        <IconChip>
          <Icon className="h-[18px] w-[18px]" />
        </IconChip>
        <div className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="text-muted-foreground type-label block">{text}</span>
        </div>
      </div>
    </SettingsGroup>
  );
}

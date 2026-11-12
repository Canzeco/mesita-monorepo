"use client";

// WHAT EACH ACTIVITY CHIP HOLDS, IN WORDS (MESITA-3782, Pato: "in refunds do
// leave the explanations. that is important"): every chip (Notifications too since MESITA-3801)
// opens with one card that says what lands there and how it works, in the
// shape Refunds' "Your credit is protected" card has had since MESITA-3517.

import {
  Bell,
  CalendarCheck,
  Gift,
  LifeBuoy,
  UtensilsCrossed,
  BadgeDollarSign,
  type LucideIcon,
} from "lucide-react";
import { IconChip, SettingsGroup } from "@/components/consumer/me/settings-rows";
import type { ActivityType } from "@/lib/activity-types";

const INTRO: Record<ActivityType, { Icon: LucideIcon; title: string; text: string }> = {
  notifications: {
    Icon: Bell,
    title: "What Mesita told you",
    text: "Answers to your bookings and credit that turned available, newest first under the day they happened.",
  },
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

export function ChipIntro({ type }: { type: ActivityType }) {
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

"use client";

import { Fragment } from "react";

import { CLASSES, CLASS_ICONS } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { baseRateForClass } from "@/lib/reward-segments";
import { toast } from "@/lib/toast";
import { ClimbCard, type ClimbCardData } from "./ClimbCard";
import { InstagramConnectedSummary } from "./InstagramConnectedSummary";

// Premium and Magnetic share ONE perk set (Pato, 2026-07-27) — the two
// elevated classes differ only in how you get in (paid vs earned with reach),
// which is the `premium <= magnetic` ladder. Keep this a single constant so
// the two cards can never drift apart.
const ELEVATED_PERKS = [
  "Better recommendations",
  `Up to ${baseRateForClass("premium")}% discount rewards — double Standard's`,
  "10 reservations a month",
];

export function WaysToClimb({
  onConnectInstagram,
}: {
  onConnectInstagram: () => void;
}) {
  const premium = CLASSES.find((c) => c.id === "premium")!;
  const magnetic = CLASSES.find((c) => c.id === "magnetic")!;
  const { key, origin, followers } = useConsumerClass();
  const isStandard = key === "standard";

  const cards: ClimbCardData[] = [
    {
      key: "standard",
      icon: CLASS_ICONS.standard,
      iconBg: "bg-muted text-foreground",
      title: "Standard",
      price: "$0",
      priceNote: "always free",
      desc: "Your default account at no cost — every guest starts here.",
      perks: [
        `Up to ${baseRateForClass("standard")}% discount rewards at Verified Partners`,
        "Standard recommendations",
        "2 reservations a month",
      ],
      reached: isStandard,
      reachedLabel: "Current class",
      note: isStandard ? undefined : "Included in every account",
    },
    {
      key: "premium",
      icon: CLASS_ICONS.premium,
      iconBg: "bg-tier-premium text-white",
      title: "Premium",
      via: "Subscription",
      accent: true,
      price: `$${premium.priceMxn} MXN`,
      priceNote: "per month · cancel anytime",
      desc: "Subscribe and unlock full Premium instantly. No follower count needed; cancel whenever you want.",
      perks: ELEVATED_PERKS,
      reached: key === "premium",
      reachedLabel: "Active",
      actions: [{ label: "Join with subscription", href: "/subscribe/premium" }],
    },
    {
      key: "magnetic",
      icon: CLASS_ICONS.magnetic,
      iconBg: "bg-tier-gold text-white",
      title: "Magnetic",
      via: "Instagram or invitation",
      accent: true,
      price: `${magnetic.followerThreshold.toLocaleString("en-US")}+ followers`,
      priceNote: "no payment — earned with reach, or invited by Mesita",
      desc: `Connect an Instagram with ${magnetic.followerThreshold.toLocaleString("en-US")}+ followers and post a story each time you visit — Mesita's top, invite-only tier, without paying a peso.`,
      perks: ELEVATED_PERKS,
      reached: key === "magnetic",
      reachedLabel: origin === "instagram" ? "Connected" : "Active",
      actions: [
        { label: "Join with Instagram", onClick: onConnectInstagram },
        {
          label: "Join via invitation",
          secondary: true,
          // No invite-code flow yet — invitations are extended by Mesita.
          onClick: () =>
            toast(
              "Magnetic invitations come directly from Mesita — there's nothing to claim here yet.",
            ),
        },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {cards.map((c) => (
        <Fragment key={c.key}>
          <ClimbCard data={c} />
          {c.key === "instagram" && origin === "instagram" && (
            <InstagramConnectedSummary followers={followers} />
          )}
        </Fragment>
      ))}
    </div>
  );
}

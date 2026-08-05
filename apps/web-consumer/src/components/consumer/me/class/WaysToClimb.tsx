"use client";

import { Fragment } from "react";

import { CLASSES, CLASS_ICONS } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { toast } from "@/lib/toast";
import { ClimbCard, type ClimbCardData } from "./ClimbCard";
import { InstagramConnectedSummary } from "./InstagramConnectedSummary";

// Elevated classes share core perks; the meter carries the discount signal
// (MESITA-907 qualitative). Story Bonus is not a class perk — it lives on
// Instagram connect / Rewards (MESITA-909).
const ELEVATED_PERKS = [
  "Personalized picks",
  "10 reservations / mo",
];

export function WaysToClimb({
  onConnectInstagram,
}: {
  onConnectInstagram: () => void;
}) {
  const premium = CLASSES.find((c) => c.id === "premium")!;
  const influencer = CLASSES.find((c) => c.id === "influencer")!;
  const { key, origin, followers } = useConsumerClass();
  const isStandard = key === "standard";

  const cards: ClimbCardData[] = [
    {
      key: "standard",
      icon: CLASS_ICONS.standard,
      iconBg: "bg-muted text-foreground",
      title: "Standard",
      via: "Free",
      discountLevel: "LOW",
      perks: ["Basic place picks", "2 AI reservations / mo"],
      reached: isStandard,
      reachedLabel: "Current class",
      note: isStandard ? undefined : "Included",
    },
    {
      key: "influencer",
      icon: CLASS_ICONS.influencer,
      iconBg: "bg-sky-600 text-white",
      title: "Influencer",
      via: "Instagram",
      accent: true,
      door: `${influencer.followerThreshold.toLocaleString("en-US")}+ followers · automatic`,
      discountLevel: "HIGH",
      perks: [...ELEVATED_PERKS],
      reached: key === "influencer",
      reachedLabel: origin === "instagram" ? "Connected" : "Active",
      actions: [{ label: "Join with Instagram", onClick: onConnectInstagram }],
    },
    {
      key: "premium",
      icon: CLASS_ICONS.premium,
      iconBg: "bg-tier-premium text-white",
      title: "Premium",
      via: "Subscription",
      accent: true,
      door: `$${premium.priceMxn} MXN / mo · cancel anytime`,
      discountLevel: "EXTRA",
      perks: [...ELEVATED_PERKS],
      reached: key === "premium",
      reachedLabel: "Active",
      actions: [
        { label: "Join with subscription", href: CONSUMER_ROUTES.subscribe },
      ],
    },
    {
      key: "aura",
      icon: CLASS_ICONS.aura,
      iconBg: "bg-tier-gold text-white",
      title: "Aura",
      via: "Invite",
      accent: true,
      door: "Invitation only · no payment",
      discountLevel: "MAX",
      perks: [...ELEVATED_PERKS],
      reached: key === "aura",
      reachedLabel: "Active",
      actions: [
        {
          label: "Request invite",
          secondary: true,
          onClick: () =>
            toast(
              "Invitation requests open soon — Mesita curates Aura personally.",
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
          {c.key === "influencer" && origin === "instagram" && (
            <InstagramConnectedSummary followers={followers} />
          )}
        </Fragment>
      ))}
    </div>
  );
}

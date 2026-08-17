"use client";

import { Fragment } from "react";

import { CLASSES, CLASS_ICONS } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { toast } from "@/lib/toast";
import { ClimbCard, type ClimbCardData } from "./ClimbCard";
import { InstagramConnectedSummary } from "./InstagramConnectedSummary";

// Elevated classes share core perks; the meter carries the discount signal
// (MESITA-907 qualitative). Story Bonus is not a class perk — it lives on
// Instagram connect / Rewards (MESITA-909).
const ELEVATED_PERKS = ["Personalized picks", "10 reservations / mo"];

// THE CLASS LADDER, AND NOTHING ELSE (decision: Pato, MESITA-1122).
//
// This screen has twice failed the same way. v1 listed Premium as the third
// "way to climb", which read as pay-to-outrank. v2 kept it, demoted to its own
// "Your plan" heading — still a purchasable card on the surface that is
// supposed to prove classes are earned, and still the loudest thing on it.
// The plan now has its own box on Me and its own page at /subscribe/premium,
// so it is gone from here entirely: nothing on the class surface may be
// bought.
export function WaysToClimb({
  onConnectInstagram,
}: {
  onConnectInstagram: () => void;
}) {
  const silver = CLASSES.find((c) => c.id === "silver")!;
  const { key, origin, followers } = useConsumerClass();

  const classCards: ClimbCardData[] = [
    {
      key: "bronze",
      icon: CLASS_ICONS.bronze,
      iconBg: "bg-tier-bronze text-white",
      title: "Bronze",
      via: "Default",
      discountLevel: "LOW",
      perks: ["Basic place picks", "2 AI reservations / mo"],
      reached: key === "bronze",
      reachedLabel: "Current class",
      note: key === "bronze" ? undefined : "Included",
    },
    {
      key: "silver",
      icon: CLASS_ICONS.silver,
      iconBg: "bg-tier-silver text-foreground",
      title: "Silver",
      via: "Instagram",
      accent: true,
      door: `${silver.followerThreshold.toLocaleString("en-US")}+ followers · automatic`,
      discountLevel: "HIGH",
      perks: [...ELEVATED_PERKS],
      reached: key === "silver",
      reachedLabel: origin === "instagram" ? "Connected" : "Active",
      actions: [{ label: "Join with Instagram", onClick: onConnectInstagram }],
    },
    {
      key: "gold",
      icon: CLASS_ICONS.gold,
      iconBg: "bg-tier-gold text-white",
      title: "Gold",
      via: "Instagram",
      accent: true,
      // The band above Silver, deliberately unquantified: Notion Main puts the
      // reach bands in Admin → Rewards Config, "never hardcoded". Nothing
      // grants Gold today (no legacy class key maps to it), so it carries the
      // same Instagram door as Silver rather than a CTA that can't fire.
      door: "A higher reach band · automatic",
      discountLevel: "EXTRA",
      perks: [...ELEVATED_PERKS],
      reached: key === "gold",
      reachedLabel: "Active",
      actions: [{ label: "Join with Instagram", onClick: onConnectInstagram }],
    },
    {
      key: "diamond",
      icon: CLASS_ICONS.diamond,
      iconBg: "bg-tier-diamond text-white",
      title: "Diamond",
      via: "Invite",
      accent: true,
      door: "Aura-list invitation · no payment",
      discountLevel: "MAX",
      perks: [...ELEVATED_PERKS],
      reached: key === "diamond",
      reachedLabel: "Active",
      actions: [
        {
          label: "Request invite",
          secondary: true,
          onClick: () =>
            toast(
              "Invitation requests open soon — Mesita curates the Aura list personally.",
            ),
        },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {classCards.map((c) => (
        <Fragment key={c.key}>
          <ClimbCard data={c} />
          {c.key === "silver" && origin === "instagram" && (
            <InstagramConnectedSummary followers={followers} />
          )}
        </Fragment>
      ))}
    </div>
  );
}

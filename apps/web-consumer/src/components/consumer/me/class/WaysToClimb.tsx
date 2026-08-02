"use client";

import { Fragment } from "react";

import { CLASSES, CLASS_ICONS } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { baseRateForClass, peakRateForClass } from "@/lib/reward-segments";
import { toast } from "@/lib/toast";
import { ClimbCard, type ClimbCardData } from "./ClimbCard";
import { InstagramConnectedSummary } from "./InstagramConnectedSummary";

// Every elevated class (Premium / Influencer / Aura) shares ONE core perk set —
// they differ in the door (paid / reach / invited) and in how their money is
// made (flat rate vs the Story action vs the highest flat rate). Keep the
// shared lines a single constant so the cards can never drift apart.
const ELEVATED_PERKS = [
  "Better recommendations",
  "10 reservations a month",
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
      perks: [
        `Up to ${baseRateForClass("premium")}% discount rewards — double Standard's`,
        ...ELEVATED_PERKS,
      ],
      reached: key === "premium",
      reachedLabel: "Active",
      actions: [{ label: "Join with subscription", href: "/subscribe/premium" }],
    },
    {
      key: "influencer",
      icon: CLASS_ICONS.influencer,
      iconBg: "bg-sky-600 text-white",
      title: "Influencer",
      via: "Instagram",
      accent: true,
      price: `${influencer.followerThreshold.toLocaleString("en-US")}+ followers`,
      priceNote: "no payment — earned with reach, automatic",
      // The Influencer class's real money is per-post: the Instagram Story
      // action is EXCLUSIVE to this class (segments v6) and pays the story
      // rung on any visit where a tagged story is verified.
      desc: `Connect an Instagram with ${influencer.followerThreshold.toLocaleString("en-US")}+ followers. The Instagram Story reward is yours alone — post a tagged story on any visit and take up to ${peakRateForClass("influencer")}% off.`,
      perks: [
        `Up to ${baseRateForClass("influencer")}% base discount`,
        "Instagram Story bonus — exclusive to Influencers",
        ...ELEVATED_PERKS,
      ],
      reached: key === "influencer",
      reachedLabel: origin === "instagram" ? "Connected" : "Active",
      actions: [{ label: "Join with Instagram", onClick: onConnectInstagram }],
    },
    {
      key: "aura",
      icon: CLASS_ICONS.aura,
      iconBg: "bg-tier-gold text-white",
      title: "Aura",
      via: "Invitation",
      accent: true,
      price: "By invitation only",
      priceNote: "no payment — Mesita curates Aura personally",
      // Aura is the presence class: the highest flat rate, paid for showing
      // up. No follower count, no posting — the invite is the whole door.
      desc: `Mesita's invite-only class. The highest base discount — up to ${baseRateForClass("aura")}% on every visit — just for being you. No followers required, nothing to post.`,
      perks: [
        `Up to ${baseRateForClass("aura")}% base discount — the highest of any class`,
        ...ELEVATED_PERKS,
      ],
      reached: key === "aura",
      reachedLabel: "Active",
      actions: [
        // No invite-code or request flow exists yet — both are placeholders
        // until the curation door gets a consumer-side backend (grants are
        // admin-console only for launch).
        {
          label: "Request invitation",
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

"use client";

import { Fragment } from "react";

import {
  CLASSES,
  CLASS_ICONS,
  PLANS,
  PREMIUM_PLAN_ICON,
} from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { toast } from "@/lib/toast";
import { ClimbCard, type ClimbCardData } from "./ClimbCard";
import { InstagramConnectedSummary } from "./InstagramConnectedSummary";

// Elevated classes share core perks; the meter carries the discount signal
// (MESITA-907 qualitative). Story Bonus is not a class perk — it lives on
// Instagram connect / Rewards (MESITA-909).
const ELEVATED_PERKS = ["Personalized picks", "10 reservations / mo"];

// TWO SECTIONS, because there are two axes (Classes v2, MESITA-1079). This
// screen used to list four "ways to climb" with Premium third, which read as
// "pay to outrank an Influencer" — the exact merge v2 removes. The class
// ladder is what you EARN; the plan is what you BUY, and it is filed under its
// own heading so no card can be mistaken for a rung.
export function WaysToClimb({
  onConnectInstagram,
}: {
  onConnectInstagram: () => void;
}) {
  const silver = CLASSES.find((c) => c.id === "silver")!;
  const premiumPlan = PLANS.find((p) => p.id === "premium")!;
  const { key, plan, origin, followers } = useConsumerClass();

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

  const planCard: ClimbCardData = {
    key: "premium",
    icon: PREMIUM_PLAN_ICON,
    iconBg: "bg-tier-premium text-white",
    title: "Premium",
    via: "Subscription",
    accent: true,
    door: `$${premiumPlan.priceMxn} MXN / mo · cancel anytime`,
    discountLevel: "EXTRA",
    perks: [...ELEVATED_PERKS],
    reached: plan === "premium",
    reachedLabel: "Active",
    actions: [
      { label: "Join with subscription", href: CONSUMER_ROUTES.subscribe },
    ],
  };

  return (
    <div className="flex flex-col gap-5">
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

      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-[11px] font-bold tracking-[0.14em] uppercase">
            Your plan
          </h3>
          <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
            A separate axis — Premium raises your discount at every place and
            never changes your class.
          </p>
        </div>
        <ClimbCard data={planCard} />
      </div>
    </div>
  );
}

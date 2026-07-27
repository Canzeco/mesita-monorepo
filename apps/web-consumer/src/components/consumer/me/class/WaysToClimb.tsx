"use client";

import { Fragment } from "react";
import { Crown, Instagram, Smile } from "lucide-react";

import { CLASSES } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { INSTAGRAM_ICON_GRADIENT_CLASS } from "@/lib/ui-classes";
import { ClimbCard, type ClimbCardData } from "./ClimbCard";
import { InstagramConnectedSummary } from "./InstagramConnectedSummary";

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
      icon: Smile,
      iconBg: "bg-muted text-foreground",
      title: "Standard",
      price: "$0",
      priceNote: "always free",
      desc: "Your default account at no cost. Get a base discount at Verified Partners, standard recommendations, and book up to 2 reservations every month.",
      reached: isStandard,
      reachedLabel: "Current class",
      note: isStandard ? undefined : "Included in every account",
    },
    {
      key: "subscription",
      icon: Crown,
      iconBg: "bg-pink-gradient text-white",
      title: "Premium",
      via: "Subscription",
      accent: true,
      price: `$${premium.priceMxn} MXN`,
      priceNote: "per month · cancel anytime",
      desc: "Subscribe and unlock full Premium instantly — boosted discounts, personalized recommendations, and unlimited reservations. No follower count needed; cancel whenever you want.",
      reached: origin === "subscription",
      reachedLabel: "Active",
      action: { label: "Subscribe", href: "/subscribe/premium" },
    },
    {
      key: "instagram",
      icon: Instagram,
      iconBg: [INSTAGRAM_ICON_GRADIENT_CLASS, "text-white"].join(" "),
      title: "Magnetic",
      via: "Instagram",
      accent: true,
      price: `${magnetic.followerThreshold.toLocaleString("en-US")}+ followers`,
      priceNote: "no payment — earned with reach",
      desc: `Connect an Instagram with ${magnetic.followerThreshold.toLocaleString("en-US")}+ followers and post a story each time you visit. You unlock Magnetic — Mesita's top, invite-only tier — with the biggest discounts, personalized recommendations, and unlimited reservations, without paying a peso.`,
      reached: origin === "instagram",
      reachedLabel: "Connected",
      action: { label: "Connect", onClick: onConnectInstagram },
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

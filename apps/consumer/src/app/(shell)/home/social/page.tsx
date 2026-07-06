"use client";

import { SocialFeed } from "@/components/consumer/home/SocialFeed";
import { useHomeDeck } from "@/components/consumer/home/HomeDeckContext";

// Social — activity feed resolved against the shared deck.
export default function HomeSocialPage() {
  const { places } = useHomeDeck();
  return <SocialFeed places={places} />;
}

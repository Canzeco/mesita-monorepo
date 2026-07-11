import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Social feed is temporarily BLOCKED while we finish Swipe / Favorites / Search
// first. The route is kept (not deleted) so un-parking is a one-file revert:
// restore the SocialFeed render below and flip `soon: false` in HomeModeNav.
// The nav pill is disabled; this redirect also blocks direct URLs.
//
//   import { SocialFeed } from "@/components/consumer/home/SocialFeed";
//   import { useHomeDeck } from "@/components/consumer/home/HomeDeckContext";
//   const { places } = useHomeDeck();
//   return <SocialFeed places={places} />;
export default function HomeSocialPage() {
  redirect(CONSUMER_ROUTES.homeDefault);
}

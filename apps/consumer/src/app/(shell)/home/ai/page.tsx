import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Ask AI (Memo concierge) is temporarily BLOCKED while we finish Swipe /
// Favorites / Search first. The route is kept (not deleted) so un-parking is a
// one-file revert: restore the AskAiTab render below and flip `soon: false` in
// HomeModeNav. The nav pill is disabled; this redirect also blocks direct URLs.
//
//   import { AskAiTab } from "@/components/consumer/home/AskAiTab";
//   import { useHomeDeck } from "@/components/consumer/home/HomeDeckContext";
//   const { places } = useHomeDeck();
//   return <div className="min-h-0 flex-1 overflow-hidden"><AskAiTab places={places} /></div>;
export default function HomeAiPage() {
  redirect(CONSUMER_ROUTES.homeDefault);
}

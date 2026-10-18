import { FavoritesList } from "@/components/consumer/home/FavoritesList";

// FAVORITES — the guest's saved places (Pato, MESITA-2368: "Places, Social,
// Chat, Favorites"). The saved grid resolves each save from its stored
// preview; there is no deck fetch on this tab.
export default function DiscoverFavsPage() {
  return <FavoritesList deckPlaces={[]} />;
}

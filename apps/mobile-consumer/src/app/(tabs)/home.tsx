import { SwipeDeck } from "@/components/swipe/SwipeDeck";
import { HOME_RAIL, TabFrame } from "@/components/ui/TabRail";

// Visit › Home (MESITA-2050) — web's /discover/scroll. Mobile still deals the
// card-stack deck; web's vertical Scroll deck is not ported. The old in-screen
// segment row (Swipe · Catalog · Memo · Social · Favorites) is gone: Chat and
// Favs are pills of their own now, and Catalog/Social stay on disk, unmounted.
export default function HomeScreen() {
  return (
    <TabFrame items={HOME_RAIL} value="home">
      <SwipeDeck />
    </TabFrame>
  );
}

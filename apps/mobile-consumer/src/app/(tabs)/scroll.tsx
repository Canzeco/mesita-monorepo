import { SwipeDeck } from "@/components/swipe/SwipeDeck";
import { HOME_RAIL, TabFrame } from "@/components/ui/TabRail";

// Home › Scroll (MESITA-2081) — web's /discover/scroll. Mobile still deals the
// card-stack deck; web's vertical Scroll deck is not ported. This was the Home
// pill's body until Feed came back as Home.
export default function ScrollScreen() {
  return (
    <TabFrame items={HOME_RAIL} value="scroll">
      <SwipeDeck />
    </TabFrame>
  );
}

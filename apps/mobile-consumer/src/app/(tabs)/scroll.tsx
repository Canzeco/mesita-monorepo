import { ScrollFeed } from "@/components/scroll/ScrollFeed";
import { HOME_RAIL, TabFrame } from "@/components/ui/TabRail";

// Home › Scroll (MESITA-2081) — web's /discover/scroll. Since MESITA-2105 it
// is the same vertical TikTok feed as web (ScrollFeed), replacing the
// left/right card stack this tab used to deal.
export default function ScrollScreen() {
  return (
    <TabFrame items={HOME_RAIL} value="scroll">
      <ScrollFeed />
    </TabFrame>
  );
}

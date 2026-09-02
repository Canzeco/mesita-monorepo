import { GalleryHorizontalEnd } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";
import { DISCOVERY_MODE_SOURCES } from "./catalog";
import { ModeSourceChips } from "./ModeSourceChips";

// Swipe box — empty Soon (Pato, 2026-08-28). Home is parked. Knobs stay
// on the blob (`discovery_config.swipe`); this file must not render them.
export function SwipeConfigClient() {
  return (
    <ConfigSoon
      Icon={GalleryHorizontalEnd}
      title="Swipe is coming soon"
      body="Home › Swipe is the ranked deck. Home is parked, so there is nothing to configure."
      doc="Notion Docs › Discovery"
      footer={<ModeSourceChips sources={DISCOVERY_MODE_SOURCES.swipe} />}
    />
  );
}

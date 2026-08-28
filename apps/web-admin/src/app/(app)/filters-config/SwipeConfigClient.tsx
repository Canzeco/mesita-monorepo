import { GalleryHorizontalEnd } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";
import { DISCOVERY_MODE_MODULES } from "./catalog";
import { ModeModuleChips } from "./ModeModuleChips";

// Swipe box — empty Soon (Pato, 2026-08-28). Home is parked. Knobs stay
// on the blob (`discovery_config.swipe`); this file must not render them.
export function SwipeConfigClient() {
  return (
    <ConfigSoon
      Icon={GalleryHorizontalEnd}
      title="Swipe is coming soon"
      body="Home › Swipe is the ranked deck. Home is parked, so there is nothing to configure."
      doc="Notion Docs › Discovery"
      footer={<ModeModuleChips modules={DISCOVERY_MODE_MODULES.swipe} />}
    />
  );
}

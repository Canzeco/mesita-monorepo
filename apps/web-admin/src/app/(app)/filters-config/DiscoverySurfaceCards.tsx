import { Heart } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";
import { DISCOVERY_MODE_SOURCES } from "./catalog";
import { ModeSourceChips } from "./ModeSourceChips";

// Favorites box — empty Soon (Pato, 2026-08-28). Home is parked. No knobs
// on the blob. Icon stays in this module so the server page never passes
// Lucide nodes across the RSC boundary.
export function FavsConfigCard() {
  return (
    <ConfigSoon
      Icon={Heart}
      title="Favorites is coming soon"
      body="Home › Favorites is the saved-places grid. Home is parked, so there is nothing to configure."
      doc="Notion Docs › Discovery"
      footer={<ModeSourceChips sources={DISCOVERY_MODE_SOURCES.favorites} />}
    />
  );
}

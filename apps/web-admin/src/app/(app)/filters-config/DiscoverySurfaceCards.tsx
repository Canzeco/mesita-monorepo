import { Heart } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";
import { DISCOVERY_MODE_SOURCES } from "./catalog";
import { ModeSourceChips } from "./ModeSourceChips";
import { NoWeightsNote } from "./NoWeightsNote";

// Favorites box — empty Soon (Pato, 2026-08-28). No knobs on the blob. Icon
// stays in this module so the server page never passes Lucide nodes across
// the RSC boundary.
//
// Its weights line is the strongest of the three (MESITA-1859): Favorites'
// signal mask is EMPTY, so weights would never arrive even if an engine did.
export function FavsConfigCard() {
  return (
    <ConfigSoon
      Icon={Heart}
      title="Favorites is coming soon"
      body="Home › Favorites is the saved-places grid. It ranks nothing — a bookmark list is the guest's own order — so there is nothing to configure."
      doc="Notion Docs › Discovery"
      footer={
        <>
          <NoWeightsNote reason="This mode's signal mask is empty, so weights would never arrive even with an engine behind it." />
          <ModeSourceChips sources={DISCOVERY_MODE_SOURCES.favorites} />
        </>
      }
    />
  );
}

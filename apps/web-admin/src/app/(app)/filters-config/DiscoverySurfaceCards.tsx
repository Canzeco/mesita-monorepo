"use client";

// Favs — presentational Discovery box. Parked. Icon stays in this client so
// the server page never passes Lucide nodes across the RSC boundary.
// Swipe is a live knob box (`SwipeConfigClient`), not this file.

import { Heart } from "lucide-react";
import { KnobStatus, SectionCard } from "@/components/admin-ui/config";

export function FavsConfigCard() {
  return (
    <SectionCard
      icon={<Heart className="text-primary h-4 w-4" />}
      title="Favs"
      subtitle="The saved-places grid only. Recency of the save, no ranking, no similar-places rail. Home › Favs is parked."
      status={<KnobStatus kind="not-wired" reason="Home Soon" />}
    >
      <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
        No knobs until that tab is live.
      </p>
    </SectionCard>
  );
}

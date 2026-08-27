"use client";

// Favs — presentational Discovery box. Home › Favorites is live; this box
// has no knobs. Icon stays in this client so the server page never passes
// Lucide nodes across the RSC boundary.

import { Heart } from "lucide-react";
import { KnobStatus, SectionCard } from "@/components/admin-ui/config";

export function FavsConfigCard() {
  return (
    <SectionCard
      icon={<Heart className="text-primary h-4 w-4" />}
      title="Favs"
      subtitle="The saved-places grid only. Recency of the save, no ranking, no similar-places rail. Home › Favorites is live."
      status={<KnobStatus kind="not-wired" reason="no knobs" />}
    >
      <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
        No knobs. Right-swipe on Swipe writes the same local save list this tab reads.
      </p>
    </SectionCard>
  );
}

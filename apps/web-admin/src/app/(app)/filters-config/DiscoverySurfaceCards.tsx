"use client";

// Name · Swipe · Favs — presentational Discovery boxes. No knobs: Name and
// Swipe are live readers of other slices; Favs is parked. Icons stay in this
// client so the server page never passes Lucide nodes across the RSC boundary.

import { Flame, Heart, Type } from "lucide-react";
import { KnobStatus, SectionCard } from "@/components/admin-ui/config";

export function NameConfigCard() {
  return (
    <SectionCard
      icon={<Type className="text-primary h-4 w-4" />}
      title="Name"
      subtitle="Entity resolution in Map's searchbar. Autocomplete while typing, one Text Search on idle, plus Mesita name and summary embeddings. Merge by Place ID. Not a standalone engine — floors and types live on Map."
      status={
        <KnobStatus kind="enforced" reason="consumer-web-suggest-places" />
      }
    >
      <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
        No knobs. Changing Map floors changes which name hits may appear.
      </p>
    </SectionCard>
  );
}

export function SwipeConfigCard() {
  return (
    <SectionCard
      icon={<Flame className="text-primary h-4 w-4" />}
      title="Swipe"
      subtitle="Home deck of listed Mesita places. Ranks from the last-saved signal blob, then slots bought cards. Admission uses Map type batteries and floors. Ranking knobs stay on Signals when that box returns."
      status={
        <KnobStatus kind="enforced" reason="consumer-web-recommend-swipe" />
      }
    >
      <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
        No knobs here. Off-ranked still applies filters; it just serves pool
        order.
      </p>
    </SectionCard>
  );
}

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

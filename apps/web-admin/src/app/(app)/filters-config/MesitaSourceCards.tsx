import Link from "next/link";
import { GalleryHorizontal, MapPin, PartyPopper, Type } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";
import { KnobState, SectionCard } from "@/components/admin-ui/config";
import {
  FiltersFloorOwner,
  FloorMirror,
  FloorSoonNote,
  type FloorSeed,
} from "./SourceFloor";
import {
  FILTERS_FLOOR_OWNER,
  floorNumber,
  GENERAL_FLOOR_OWNER,
} from "./source-floor-copy";

// The four Mesita sources, in taxonomy order: Name, Nearby, and Catalog over
// Places, then Social Catalog.
//
// Browse and Flexible are gone (Pato, 2026-10-13). Catalog is the one door.
//
// FLOORS (MESITA-1681). Name Search mirrors `general`: `fetchEmbedPool` in
// consumer-search-lane.ts gates the `name_embedding` query with the same wipe
// the Google boxes name, which is why the floor does NOT split by vendor.
// Nearby Search owns `filters`, the listed-pool floor, and its effective cut
// is max(filters, map) via listedMapFilters.
//
// Social Catalog is the one Soon source. It gets a sentence, never a field.
// Pato, 2026-08-21: an engine that does not exist gets its knobs DELETED from
// the markup, not staged — and a field here would have to write another
// source's key.

export function MesitaSourceCards({ seed }: { seed: FloorSeed }) {
  const g = seed.initialConfig.general;
  const generalRows = [
    { label: "Only active places", value: g.requireActive ? "On" : "Off" },
    { label: "Minimum Google reviews", value: floorNumber(g.minReviews) },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div id="s-mesita-name" className="scroll-mt-16">
        <SectionCard
          icon={<Type className="text-primary h-4 w-4" />}
          title="Mesita Places Name Search"
          subtitle="Cosine match on `places.name_embedding` — the Mesita name, never `google_name` and never the summary. Admits on a raw-cosine floor, then Lineup orders on the Name signal alone."
          state={
            <KnobState kind="enforced" reason="suggest-places · Word (Deep) · Pay" />
          }
        >
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            Used by Word. Counts live on the Word (Deep Search) box; Pay runs
            this lane on its own with a floor of 10.
          </p>
          <FloorMirror
            rows={generalRows}
            ownedBy={GENERAL_FLOOR_OWNER}
            note="A Google key cuts this Mesita source: the same wipe rides the WHERE clause of the name-embedding pool."
          />
        </SectionCard>
      </div>
      <div id="s-mesita-nearby" className="scroll-mt-16">
        <SectionCard
          icon={<MapPin className="text-primary h-4 w-4" />}
          title={FILTERS_FLOOR_OWNER}
          subtitle="Closest N listed Mesita Places around the camera centre. Always runs; the Google lane beside it is the opt-in one."
          state={<KnobState kind="enforced" reason="list-places · Map" />}
        >
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            Used by Map. N is the guest&apos;s How many, never a console
            number. Lineup ranks listed pins under the Map mask only when
            Google adds none; otherwise distance.
          </p>
          <FiltersFloorOwner seed={seed} />
        </SectionCard>
      </div>
      <div id="s-mesita-catalog" className="scroll-mt-16">
        <SectionCard
          icon={<GalleryHorizontal className="text-primary h-4 w-4" />}
          title="Mesita Places Catalog Search"
          subtitle="The catalog's retriever. Seven family lists share one ranking profile: Name, Description, Proximity, Popularity, Selected, and Randomness. Family and Enriched admit; they do not score. Timing is not in this profile."
          state={
            <KnobState
              kind="enforced"
              reason="consumer-web-list-catalog ranks the seven family lists with this profile"
            />
          }
        >
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            Used by Catalog, Scroll, and Chat. The exponents live on the
            Catalog tab, once, and every list reads that same profile.
          </p>
          <Link
            href="/filters-config/catalog"
            className="text-foreground mt-3 inline-block text-sm font-medium underline"
          >
            Open the ranking profile
          </Link>
        </SectionCard>
      </div>
      <div id="s-social-catalog" className="scroll-mt-16">
        <ConfigSoon
          Icon={PartyPopper}
          title="Mesita Social Catalog Search is coming soon"
          body="Events a place hosts, not places. Catalog rails them and Chat is asked about them. Never one list with places. There is still no events engine."
          doc="Notion Docs › Discovery"
          footer={<FloorSoonNote />}
        />
      </div>
    </div>
  );
}

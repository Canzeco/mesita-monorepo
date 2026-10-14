import { LayoutGrid } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";
import { DISCOVERY_MODE_SOURCES } from "./catalog";
import { ModeSourceChips } from "./ModeSourceChips";
import { NoWeightsNote } from "./NoWeightsNote";

// Catalog mode card. The guest surface is still Soon (Home's Places pill).
// Ranking is not on this card: Discovery › Catalog holds one shared profile,
// and consumer-web-list-catalog ranks the seven family lists with it. This
// card stays out of the global weights table because that vector is a
// different set of signals.
export function CatalogConfigClient() {
  return (
    <ConfigSoon
      Icon={LayoutGrid}
      title="Catalog is coming soon"
      body="The guest surface is still Soon. Ranking lives on Discovery › Catalog: seven family lists, one shared profile."
      doc="Notion Docs › Discovery"
      footer={
        <>
          <NoWeightsNote reason="Catalog ranks on its own profile, not the global signal blend, so there is nothing to weight on this card." />
          <ModeSourceChips sources={DISCOVERY_MODE_SOURCES.catalog} />
        </>
      }
    />
  );
}

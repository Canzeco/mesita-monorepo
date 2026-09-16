import { LayoutGrid } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";
import { DISCOVERY_MODE_SOURCES } from "./catalog";
import { ModeSourceChips } from "./ModeSourceChips";
import { NoWeightsNote } from "./NoWeightsNote";

// Feed box — empty Soon. Home shipped, but the Catalog ENGINE did not: Feed's
// rails come back from consumer-web-list-catalog ranked by cosine, and the
// seed / rail counts on `discovery_config.catalog` still have no reader. So
// the box stays Soon and this file must not render them.
//
// Its weights line says so out loud (MESITA-1859): Feed ranks by cosine
// similarity, not by the signal blend, so it gets no column in the weights
// table and never will unless the engine changes.
export function CatalogConfigClient() {
  return (
    <ConfigSoon
      Icon={LayoutGrid}
      title="Catalog is coming soon"
      body="Catalog is stacked rails over listed Mesita places, and the home of Social\u2019s event rails now that Social is not a mode. Parked, so there is nothing to configure."
      doc="Notion Docs › Discovery"
      footer={
        <>
          <NoWeightsNote reason="Feed's rails come back ranked by cosine similarity, not by the signal blend, so there is nothing to weight." />
          <ModeSourceChips sources={DISCOVERY_MODE_SOURCES.catalog} />
        </>
      }
    />
  );
}

import { LayoutGrid } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";
import { DISCOVERY_MODE_SOURCES } from "./catalog";
import { ModeSourceChips } from "./ModeSourceChips";

// Catalog box — empty Soon. Home is parked (Pato, 2026-08-28). Knobs stay
// on the blob (`discovery_config.catalog`); this file must not render them.
export function CatalogConfigClient() {
  return (
    <ConfigSoon
      Icon={LayoutGrid}
      title="Catalog is coming soon"
      body="Catalog is stacked rails over listed Mesita places, and the home of Social\u2019s event rails now that Social is not a mode. Parked, so there is nothing to configure."
      doc="Notion Docs › Discovery"
      footer={<ModeSourceChips sources={DISCOVERY_MODE_SOURCES.catalog} />}
    />
  );
}

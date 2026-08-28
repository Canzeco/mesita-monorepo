import { LayoutGrid } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";
import { DISCOVERY_MODE_MODULES } from "./catalog";
import { ModeModuleChips } from "./ModeModuleChips";

// Catalog box — empty Soon. Home is parked (Pato, 2026-08-28). Knobs stay
// on the blob (`discovery_config.catalog`); this file must not render them.
export function CatalogConfigClient() {
  return (
    <ConfigSoon
      Icon={LayoutGrid}
      title="Catalog is coming soon"
      body="Home Catalog is stacked rails over listed Mesita places. Home is parked, so there is nothing to configure."
      doc="Notion Docs › Discovery"
      footer={<ModeModuleChips modules={DISCOVERY_MODE_MODULES.catalog} />}
    />
  );
}

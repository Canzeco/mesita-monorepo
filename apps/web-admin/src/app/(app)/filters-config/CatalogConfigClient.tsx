import { LayoutGrid } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";

// Catalog box — empty Soon (Pato, 2026-08-27). Home Catalog stays parked
// until the listed set is thick enough for rails. Knobs stay on the blob
// (`discovery_config.catalog`); this file must not render them. Same
// pattern as Orders: delete the HTML, do not hide it.
export function CatalogConfigClient() {
  return (
    <ConfigSoon
      Icon={LayoutGrid}
      title="Catalog is coming soon"
      body="Home Catalog is stacked rails over listed Mesita places. Swipe is the live deck until that catalog is thick enough to fill rails. Nothing to configure until the tab is live."
      doc="Notion Docs › Discovery"
    />
  );
}

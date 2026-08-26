import { Compass } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";

// Discovery — EMPTY on purpose while Search/Map is recut (MESITA-1326).
// Signals · Engines knobs dual-architected the page against a live Swipe
// blob and an unranked map. The BLOB IS UNTOUCHED: discovery_config, its
// normalizer and admin-web-{get,update}-discovery-config stay, so Swipe
// still ranks from last-saved weights. Rebuild the UI after Search/Map
// is stable. catalog.ts still names vendor APIs for each engine.
export const dynamic = "force-dynamic";

export default function DiscoveryPage() {
  return (
    <ConfigSoon
      Icon={Compass}
      title="Discovery is coming soon"
      body="Swipe still ranks from the last-saved blob. Search is a name bar plus an unranked map viewport — those engines are recut in code, not from this page. Knobs return when that architecture is stable."
      doc="Notion Docs › Discovery"
    />
  );
}

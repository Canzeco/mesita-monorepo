import { Users } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";

// Social box — empty Soon. Home is parked (Pato, 2026-08-28). Knobs stay
// on the blob (`discovery_config.social`); this file must not render them.
export function SocialConfigClient() {
  return (
    <ConfigSoon
      Icon={Users}
      title="Social is coming soon"
      body="Home › Social will query events a place hosts, not places. Home is parked, so there is nothing to configure."
      doc="Notion Docs › Discovery"
    />
  );
}

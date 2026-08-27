import { Users } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";

// Social box — empty Soon (Pato, 2026-08-27). Home › Social needs an events
// engine that does not exist. Knobs stay on the blob (`discovery_config.social`);
// this file must not render them.
export function SocialConfigClient() {
  return (
    <ConfigSoon
      Icon={Users}
      title="Social is coming soon"
      body="Home › Social will query events a place hosts, not places. There is no events engine yet, so there is nothing to configure."
      doc="Notion Docs › Discovery"
    />
  );
}

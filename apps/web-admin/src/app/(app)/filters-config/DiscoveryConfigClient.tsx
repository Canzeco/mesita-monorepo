import { MessageSquare } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";

// Chat box — empty Soon (Pato, 2026-08-28). Home is parked. The prompt
// stays on the blob (`discovery_config.chat`); this file must not render it.
export function DiscoveryConfigClient() {
  return (
    <ConfigSoon
      Icon={MessageSquare}
      title="Chat is coming soon"
      body="Home › Chat is Don Memo. Home is parked, so there is nothing to configure."
      doc="Notion Docs › Discovery"
    />
  );
}

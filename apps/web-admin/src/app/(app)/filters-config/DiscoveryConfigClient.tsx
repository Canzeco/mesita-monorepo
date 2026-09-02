import { MessageSquare } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";
import { DISCOVERY_MODE_SOURCES } from "./catalog";
import { ModeSourceChips } from "./ModeSourceChips";

// Chat box — empty Soon (Pato, 2026-08-28). The prompt
// stays on the blob (`discovery_config.chat`); this file must not render it.
export function DiscoveryConfigClient() {
  return (
    <ConfigSoon
      Icon={MessageSquare}
      title="Chat is coming soon"
      body="Discover › Chat is Don Memo. Mesita Places Flexible Search answers with places; Mesita Social Flexible Search answers with events. Never one mixed list."
      doc="Notion Docs › Discovery"
      footer={<ModeSourceChips sources={DISCOVERY_MODE_SOURCES.chat} />}
    />
  );
}

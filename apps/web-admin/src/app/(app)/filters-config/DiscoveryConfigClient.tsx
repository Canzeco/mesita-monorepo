import { MessageSquare } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";
import { DISCOVERY_MODE_MODULES } from "./catalog";
import { ModeModuleChips } from "./ModeModuleChips";

// Chat box — empty Soon (Pato, 2026-08-28). Home is parked. The prompt
// stays on the blob (`discovery_config.chat`); this file must not render it.
export function DiscoveryConfigClient() {
  return (
    <ConfigSoon
      Icon={MessageSquare}
      title="Chat is coming soon"
      body="Home › Chat is Don Memo. Places Lineup feeds Places; Social Lineup feeds Social; Perplexity feeds the web. Never one mixed list."
      doc="Notion Docs › Discovery"
      footer={<ModeModuleChips modules={DISCOVERY_MODE_MODULES.chat} />}
    />
  );
}

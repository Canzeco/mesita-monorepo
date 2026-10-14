import { MessageSquare } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";
import { DISCOVERY_MODE_SOURCES } from "./catalog";
import { ModeSourceChips } from "./ModeSourceChips";
import { NoWeightsNote } from "./NoWeightsNote";

// Chat box — empty Soon (Pato, 2026-08-28). The prompt
// stays on the blob (`discovery_config.chat`); this file must not render it.
// No engine ranks Chat, so it gets no weight column either (MESITA-1859).
export function DiscoveryConfigClient() {
  return (
    <ConfigSoon
      Icon={MessageSquare}
      title="Chat is coming soon"
      body="Home › Chat is Don Memo. Mesita Places Catalog Search answers with places; Mesita Social Catalog Search answers with events. Never one mixed list."
      doc="Notion Docs › Discovery"
      footer={
        <>
          <NoWeightsNote reason="No engine ranks this mode yet, so there is nothing to weight." />
          <ModeSourceChips sources={DISCOVERY_MODE_SOURCES.chat} />
        </>
      }
    />
  );
}

import { IntegrationsModal } from "@/components/consumer/me/IntegrationsModal";

// /me/integrations — Calendar (MCP is Soon on Pro, MESITA-3976), behind Me's Integrations cell
// (MESITA-3954; the cell read "MCP" under MESITA-3867).
export default function Page() {
  return <IntegrationsModal />;
}

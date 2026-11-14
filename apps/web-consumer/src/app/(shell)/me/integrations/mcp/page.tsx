import { McpModal } from "@/components/consumer/me/McpModal";

// /me/integrations/mcp — the guest's connector link for Claude and ChatGPT
// (MESITA-3971).
export const dynamic = "force-dynamic";

export default function Page() {
  return <McpModal />;
}

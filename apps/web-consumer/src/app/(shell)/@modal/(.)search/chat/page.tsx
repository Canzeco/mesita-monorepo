import { RouteSheetHeader } from "@/components/consumer/overlay/RouteSheetShell";
import { AskAiSoon } from "@/components/consumer/search/AskAiSoon";

// Intercepted soft-nav variant of /search/chat: Ask AI as a sheet over
// Search, Soon for the moment (MESITA-2168). Same body as the page.
export default function AskAiSheetPage() {
  return (
    <>
      <RouteSheetHeader title="Ask AI" />
      <AskAiSoon />
    </>
  );
}

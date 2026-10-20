import { BotMessageSquare } from "lucide-react";
import { HomeSoon } from "@/components/consumer/home/HomeSoon";
import { RouteSheetHeader } from "@/components/consumer/overlay/RouteSheetShell";

// Intercepted soft-nav variant of /search/chat: Ask AI as a sheet over
// Search, Soon for the moment (MESITA-2168).
export default function AskAiSheetPage() {
  return (
    <>
      <RouteSheetHeader title="Ask AI" />
      <HomeSoon
        icon={BotMessageSquare}
        name="Ask AI"
        description="Asking Don Memo lands here shortly — thanks for waiting."
      />
    </>
  );
}

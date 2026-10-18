import { Sparkles } from "lucide-react";
import { HomeSoon } from "@/components/consumer/home/HomeSoon";
import { SearchHeader } from "@/components/consumer/search/SearchHeader";

// CHAT — Search's second pill (Pato, MESITA-2401), Soon for the moment
// (MESITA-2168). Memo stays in AskAiTab; this page does not mount it.
export default function SearchChatPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SearchHeader />
      <HomeSoon
        icon={Sparkles}
        name="Chat"
        description="Asking Don Memo lands here shortly — thanks for waiting."
      />
    </div>
  );
}

import { Sparkles } from "lucide-react";
import { HomeSoon } from "@/components/consumer/home/HomeSoon";

// CHAT — Soon for the moment (Pato, MESITA-2168). Memo stays in AskAiTab;
// this page does not mount it.
export default function DiscoverChatPage() {
  return (
    <HomeSoon
      icon={Sparkles}
      name="Chat"
      description="Asking Don Memo lands here shortly — thanks for waiting."
    />
  );
}

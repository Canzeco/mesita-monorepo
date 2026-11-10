import { Screen } from "@/components/consumer/nav/Screen";
import { AskAiSoon } from "@/components/consumer/search/AskAiSoon";

// ASK AI, cold-loaded. Search's Ask AI button opens it as a sheet over the
// map instead (@modal/(.)search/chat, MESITA-2475). Soon for the moment
// (MESITA-2168); Memo stays in AskAiTab, which this page does not mount. It
// wears the pushed-page frame (MESITA-3647): Back lands on Search, its parent
// in the route map, when there is nothing of ours under it.
export default function SearchChatPage() {
  return (
    <Screen title="Ask AI" flush>
      <AskAiSoon />
    </Screen>
  );
}

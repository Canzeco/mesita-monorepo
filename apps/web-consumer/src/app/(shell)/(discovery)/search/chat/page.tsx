import { Screen } from "@/components/consumer/nav/Screen";
import { AskAiSoon } from "@/components/consumer/search/AskAiSoon";

// ASK AI, its own page however it is reached (Pato, MESITA-3991: "it must
// have own route and page, not mid modal"); the sheet over Search that
// MESITA-2475 added is gone. Soon for the moment
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

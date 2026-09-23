import { AskAiTab } from '@/components/memo/AskAiTab';
import { TabFrame, VISIT_RAIL } from '@/components/ui/TabRail';

// Visit › Chat (MESITA-2050) — Don Memo, web's /discover/chat. Un-parked here
// in the same change: web's Chat has been live since 2026-09-01, and the
// parked-vs-live parity rule does not let one platform hold a pill the other
// ships.
export default function ChatScreen() {
  return (
    <TabFrame items={VISIT_RAIL} value="chat">
      <AskAiTab />
    </TabFrame>
  );
}

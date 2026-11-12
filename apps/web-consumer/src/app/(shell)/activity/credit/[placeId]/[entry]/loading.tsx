import { Screen } from "@/components/consumer/nav/Screen";
import { CreditEntrySkeleton } from "@/components/consumer/activity/CreditEntry";

// The page's own frame while its read is out (MESITA-2701).
export default function Loading() {
  return (
    <Screen title="Credit">
      <CreditEntrySkeleton />
    </Screen>
  );
}

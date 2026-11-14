import { Screen } from "@/components/consumer/nav/Screen";
import { VisitSummarySkeleton } from "@/components/consumer/activity/VisitSummary";

// The page's own frame while its read is out (MESITA-2701).
export default function Loading() {
  return (
    <Screen title="Visit">
      <VisitSummarySkeleton />
    </Screen>
  );
}

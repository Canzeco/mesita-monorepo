import { MeScreen } from "@/components/consumer/me/MeScreen";
import { VisitSummarySkeleton } from "@/components/consumer/activity/VisitSummary";

// The page's own frame while its read is out (MESITA-2701).
export default function Loading() {
  return (
    <MeScreen title="Visit">
      <VisitSummarySkeleton />
    </MeScreen>
  );
}

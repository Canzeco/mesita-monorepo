import { MeScreen } from "@/components/consumer/me/MeScreen";
import { CreditEntrySkeleton } from "@/components/consumer/activity/CreditEntry";

// The page's own frame while its read is out (MESITA-2701).
export default function Loading() {
  return (
    <MeScreen title="Credit">
      <CreditEntrySkeleton />
    </MeScreen>
  );
}

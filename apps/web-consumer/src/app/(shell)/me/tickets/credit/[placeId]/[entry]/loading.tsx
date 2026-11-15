import { MeScreen } from "@/components/consumer/me/MeScreen";
import { TicketSkeleton } from "@/components/consumer/activity/TicketParts";

// The page's own frame while its read is out (MESITA-2701).
export default function Loading() {
  return (
    <MeScreen title="Credit">
      <TicketSkeleton />
    </MeScreen>
  );
}

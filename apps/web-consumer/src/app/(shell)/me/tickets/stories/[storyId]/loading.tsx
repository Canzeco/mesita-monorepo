import { MeScreen } from "@/components/consumer/me/MeScreen";
import { StoryTicketSkeleton } from "@/components/consumer/activity/StoryTicket";

// The page's own frame while its read is out (MESITA-2701): the top box,
// then the five steps' bones (MESITA-4747).
export default function Loading() {
  return (
    <MeScreen title="Story">
      <StoryTicketSkeleton />
    </MeScreen>
  );
}

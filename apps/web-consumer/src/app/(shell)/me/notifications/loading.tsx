import { MeScreen } from "@/components/consumer/me/MeScreen";
import { NotificationsSkeleton } from "@/components/consumer/NotificationsClient";

// The page's own frame while its read is out (MESITA-2701), flush like the
// page (MESITA-4607): the rows' bones edge to edge, no box.
export default function Loading() {
  return (
    <MeScreen title="Notifications" flush>
      <NotificationsSkeleton />
      <p role="status" className="sr-only">
        Loading notifications
      </p>
    </MeScreen>
  );
}

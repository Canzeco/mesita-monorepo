import { NotificationsFrame } from "@/components/consumer/me/ActivityModals";
import { NotificationsSkeleton } from "@/components/consumer/NotificationsClient";

// /me/notifications' fallback: ActivityModals' AlertsModal as it first
// paints — its own frame (MeScreen's bar, the column), then the
// feed's four row silhouettes (Pato, MESITA-2701: "the placeholders must be
// similar to the page you are loading, like the sizes"). The frame is
// NotificationsFrame and the feed is NotificationsSkeleton, the ones the
// page draws, so the two hand over without a jump.
export default function NotificationsLoading() {
  return (
    <NotificationsFrame>
      <NotificationsSkeleton />
      <p role="status" className="sr-only">
        Loading notifications
      </p>
    </NotificationsFrame>
  );
}

import { MeScreen } from "@/components/consumer/me/MeScreen";
import { NotificationsSkeleton } from "@/components/consumer/NotificationsClient";

// /me/notifications' fallback: ActivityModals' AlertsModal as it first
// paints — MeScreen's bar, the blurb (fixed words, so drawn as themselves),
// then the feed's four row silhouettes (Pato, MESITA-2701: "the placeholders
// must be similar to the page you are loading, like the sizes"). The blurb
// and the column are ActivityPage's classes.
export default function NotificationsLoading() {
  return (
    <MeScreen title="Notifications" flush>
      <p className="text-muted-foreground shrink-0 px-5 pt-4 pb-3 text-xs">
        Notifications and updates
      </p>
      <div className="flex min-h-0 flex-1 flex-col">
        <NotificationsSkeleton />
      </div>
      <p role="status" className="sr-only">
        Loading notifications
      </p>
    </MeScreen>
  );
}

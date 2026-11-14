import { NotificationsPage } from "@/components/consumer/activity/MeLists";

// /me/notifications — what Mesita told you (MESITA-3855; Activity's
// Notifications chip until then). Opening it clears the bar's red dot.
export default function Page() {
  return <NotificationsPage />;
}
